import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import type { SelectedGitHubPort } from "./selected-github-source.ts";

const repository = "[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9][A-Za-z0-9._-]{0,99}";
const endpoint = new RegExp(
  `^(?:/user|/repos/${repository}|/repositories/[1-9][0-9]{0,15}(?:/git/ref/heads/[A-Za-z0-9._/-]{1,200}|/git/(?:blobs|commits)/[a-f0-9]{40}|/git/trees/[a-f0-9]{40}\\?recursive=1))$`,
  "u",
);

/** Internal test seams are not configurable through owner JSON or consumer tools. */
export function createSelectedGitHubPort(
  ports: {
    readonly credential?: (timeoutMs: number) => Promise<string | null>;
    readonly request?: typeof httpsRequest;
  } = {},
): SelectedGitHubPort {
  return Object.freeze({
    async get(
      input: Parameters<SelectedGitHubPort["get"]>[0],
    ): ReturnType<SelectedGitHubPort["get"]> {
      if (
        !endpoint.test(input.endpoint) ||
        input.endpoint.split("/").some((part) => part === "." || part === "..") ||
        !Number.isSafeInteger(input.maximumOutputBytes) ||
        input.maximumOutputBytes < 1 ||
        input.maximumOutputBytes > 1_048_576 ||
        !Number.isSafeInteger(input.timeoutMs) ||
        input.timeoutMs < 1 ||
        input.timeoutMs > 60_000
      )
        return { ok: false };
      const started = performance.now();
      try {
        // gh owns durable credential storage. The token remains only in this process and the TLS header.
        const token = await (ports.credential ?? readGhCredential)(input.timeoutMs);
        await input.beforeRequest?.();
        const remaining = Math.floor(input.timeoutMs - (performance.now() - started));
        if (token === null || !/^[A-Za-z0-9_]{1,4096}$/u.test(token) || remaining <= 0)
          return { ok: false };
        return await new Promise((resolve) => {
          let finished = false;
          let bytes = 0;
          const chunks: Buffer[] = [];
          const finish = (ok: boolean): void => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve(ok ? { ok: true, output: Buffer.concat(chunks) } : { ok: false });
            chunks.length = 0;
          };
          // Node HTTPS does not follow Location. Every redirect is rejected before a second request.
          const req = (ports.request ?? httpsRequest)(
            {
              hostname: "api.github.com",
              port: 443,
              protocol: "https:",
              rejectUnauthorized: true,
              method: "GET",
              path: input.endpoint,
              agent: false,
              maxHeaderSize: 16384,
              headers: {
                Accept: "application/vnd.github+json",
                "Accept-Encoding": "identity",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "fork-me-up-local-source",
                Authorization: `Bearer ${token}`,
              },
            },
            (response) => {
              if (
                response.statusCode !== 200 ||
                (response.headers["content-encoding"] !== undefined &&
                  response.headers["content-encoding"] !== "identity")
              ) {
                response.destroy();
                finish(false);
                return;
              }
              response.on("data", (chunk: Buffer) => {
                if (finished) return;
                bytes += chunk.byteLength;
                if (bytes > input.maximumOutputBytes) {
                  response.destroy();
                  req.destroy();
                  finish(false);
                } else chunks.push(chunk);
              });
              response.on("error", () => finish(false));
              response.on("aborted", () => finish(false));
              response.on("end", () => finish(true));
            },
          );
          const timer = setTimeout(() => {
            req.destroy();
            finish(false);
          }, remaining);
          req.on("error", () => finish(false));
          req.end();
        });
      } catch {
        return { ok: false };
      }
    },
  });
}
export const nodeSelectedGitHubPort = createSelectedGitHubPort();

export async function readGhCredential(
  timeoutMs: number,
  spawnPort: typeof spawn = spawn,
): Promise<string | null> {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "TEMP",
    "TMP",
    "GH_CONFIG_DIR",
    "GH_TOKEN",
    "GITHUB_TOKEN",
  ]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  Object.assign(env, { GH_PROMPT_DISABLED: "1", GH_PAGER: "cat", PAGER: "cat", NO_COLOR: "1" });
  return new Promise((resolve) => {
    let finished = false;
    let bytes = 0;
    const chunks: Buffer[] = [];
    const child = spawnPort("gh", ["auth", "token", "--hostname", "github.com"], {
      env,
      cwd: tmpdir(),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (ok: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(ok ? Buffer.concat(chunks).toString("utf8").trim() : null);
      for (const chunk of chunks) chunk.fill(0);
      chunks.length = 0;
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(false);
    }, timeoutMs);
    const consume = (chunk: Buffer, retain: boolean): void => {
      if (finished) return;
      bytes += chunk.byteLength;
      if (bytes > 8192) {
        chunk.fill(0);
        child.kill();
        finish(false);
      } else if (retain) chunks.push(chunk);
      else chunk.fill(0);
    };
    child.stdout.on("data", (chunk: Buffer) => consume(chunk, true));
    child.stderr.on("data", (chunk: Buffer) => consume(chunk, false));
    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });
}
