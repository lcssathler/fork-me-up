import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { LocalPathPlatform } from "./authorized-repository-config.ts";

export type GitObjectFormat = "sha1" | "sha256";

export interface BoundedGitCommandRequest {
  readonly arguments: readonly string[];
  readonly input: Uint8Array;
  readonly objectDirectory: string;
  readonly objectFormat: GitObjectFormat;
  readonly shallowObjectIds: readonly string[];
  readonly maximumOutputBytes: number;
  readonly timeoutMs: number;
  readonly platform: LocalPathPlatform;
}

export type BoundedGitCommandFailureReason =
  "invalid-request" | "unavailable" | "failed" | "limit-exceeded" | "deadline-exceeded";

export type BoundedGitCommandResult =
  | { readonly ok: true; readonly output: Uint8Array }
  | { readonly ok: false; readonly reason: BoundedGitCommandFailureReason };

export interface BoundedGitCommandPort {
  run(request: BoundedGitCommandRequest): Promise<BoundedGitCommandResult>;
}

const maximumCommandBytes = 134_217_728;
const maximumInputBytes = 4_194_304;
const maximumTimeoutMs = 120_000;
const maximumShallowObjects = 256;

export const nodeBoundedGitCommandPort: BoundedGitCommandPort = Object.freeze({
  async run(request: BoundedGitCommandRequest) {
    if (!isValidRequest(request)) return failure("invalid-request");

    let quarantineDirectory: string | undefined;
    try {
      quarantineDirectory = await mkdtemp(path.join(tmpdir(), "fork-me-up-git-"));
      const gitDirectory = path.join(quarantineDirectory, "git-dir");
      await mkdir(gitDirectory);
      await mkdir(path.join(gitDirectory, "objects"));
      await mkdir(path.join(gitDirectory, "refs", "heads"), { recursive: true });
      const nullDevice = request.platform === "win32" ? "NUL" : "/dev/null";
      await writeFile(
        path.join(gitDirectory, "config"),
        trustedConfiguration(request.objectFormat, nullDevice),
        { encoding: "utf8", flag: "wx" },
      );
      await writeFile(path.join(gitDirectory, "HEAD"), `${emptyObjectId(request.objectFormat)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      if (request.shallowObjectIds.length > 0) {
        await writeFile(
          path.join(gitDirectory, "shallow"),
          `${request.shallowObjectIds.join("\n")}\n`,
          { encoding: "utf8", flag: "wx" },
        );
      }

      return await spawnBoundedGit(request, gitDirectory, quarantineDirectory, nullDevice);
    } catch {
      return failure("failed");
    } finally {
      if (quarantineDirectory !== undefined) {
        await rm(quarantineDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  },
});

async function spawnBoundedGit(
  request: BoundedGitCommandRequest,
  gitDirectory: string,
  quarantineDirectory: string,
  nullDevice: string,
): Promise<BoundedGitCommandResult> {
  const environment = minimalEnvironment({
    gitDirectory,
    objectDirectory: request.objectDirectory,
    quarantineDirectory,
    nullDevice,
  });
  const fixedArguments = [
    "--no-pager",
    "--no-replace-objects",
    "--no-lazy-fetch",
    "--no-optional-locks",
    "--literal-pathspecs",
    ...request.arguments,
  ];

  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let exceeded = false;
    let outputBytes = 0;
    let standardOutputBytes = 0;
    const chunks: Buffer[] = [];
    const child = spawn("git", fixedArguments, {
      cwd: quarantineDirectory,
      env: environment,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, request.timeoutMs);
    const finish = (result: BoundedGitCommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const account = (chunk: Buffer, retain: boolean): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > request.maximumOutputBytes) {
        exceeded = true;
        child.kill();
        return;
      }
      if (retain) {
        standardOutputBytes += chunk.byteLength;
        chunks.push(chunk);
      }
    };

    child.stdout.on("data", (chunk: Buffer) => account(chunk, true));
    child.stderr.on("data", (chunk: Buffer) => account(chunk, false));
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(failure(error.code === "ENOENT" ? "unavailable" : "failed"));
    });
    child.on("close", (exitCode) => {
      if (timedOut) finish(failure("deadline-exceeded"));
      else if (exceeded) finish(failure("limit-exceeded"));
      else if (exitCode !== 0) finish(failure("failed"));
      else finish({ ok: true, output: Buffer.concat(chunks, standardOutputBytes) });
    });

    child.stdin.on("error", () => undefined);
    child.stdin.end(Buffer.from(request.input));
  });
}

function minimalEnvironment(input: {
  readonly gitDirectory: string;
  readonly objectDirectory: string;
  readonly quarantineDirectory: string;
  readonly nullDevice: string;
}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    GIT_DIR: input.gitDirectory,
    GIT_OBJECT_DIRECTORY: input.objectDirectory,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: input.nullDevice,
    GIT_CONFIG_GLOBAL: input.nullDevice,
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_PROTOCOL_FROM_USER: "0",
    GIT_PAGER: "",
    PAGER: "",
    HOME: input.quarantineDirectory,
    XDG_CONFIG_HOME: input.quarantineDirectory,
    LC_ALL: "C",
    LANG: "C",
    PATH: process.env["PATH"] ?? "",
    TMP: input.quarantineDirectory,
    TEMP: input.quarantineDirectory,
    GIT_CONFIG_COUNT: "8",
    GIT_CONFIG_KEY_0: "core.hooksPath",
    GIT_CONFIG_VALUE_0: input.nullDevice,
    GIT_CONFIG_KEY_1: "core.fsmonitor",
    GIT_CONFIG_VALUE_1: "false",
    GIT_CONFIG_KEY_2: "core.untrackedCache",
    GIT_CONFIG_VALUE_2: "false",
    GIT_CONFIG_KEY_3: "core.attributesFile",
    GIT_CONFIG_VALUE_3: input.nullDevice,
    GIT_CONFIG_KEY_4: "diff.external",
    GIT_CONFIG_VALUE_4: "",
    GIT_CONFIG_KEY_5: "credential.helper",
    GIT_CONFIG_VALUE_5: "",
    GIT_CONFIG_KEY_6: "submodule.recurse",
    GIT_CONFIG_VALUE_6: "false",
    GIT_CONFIG_KEY_7: "fetch.recurseSubmodules",
    GIT_CONFIG_VALUE_7: "false",
  };
  const systemRoot = process.env["SystemRoot"];
  if (systemRoot !== undefined) environment["SystemRoot"] = systemRoot;
  const windowsDirectory = process.env["WINDIR"];
  if (windowsDirectory !== undefined) environment["WINDIR"] = windowsDirectory;
  return environment;
}

function trustedConfiguration(objectFormat: GitObjectFormat, nullDevice: string): string {
  const version = objectFormat === "sha256" ? "1" : "0";
  const extension = objectFormat === "sha256" ? "[extensions]\n\tobjectFormat = sha256\n" : "";
  return `[core]\n\trepositoryFormatVersion = ${version}\n\tbare = true\n\thooksPath = ${nullDevice}\n\tfsmonitor = false\n\tattributesFile = ${nullDevice}\n${extension}`;
}

function emptyObjectId(format: GitObjectFormat): string {
  return "0".repeat(format === "sha1" ? 40 : 64);
}

function isValidRequest(value: unknown): value is BoundedGitCommandRequest {
  if (!isRecord(value)) return false;
  const request = value as Partial<BoundedGitCommandRequest>;
  if (
    !Array.isArray(request.arguments) ||
    !request.arguments.every((argument) => typeof argument === "string") ||
    !(request.input instanceof Uint8Array) ||
    request.input.byteLength > maximumInputBytes ||
    typeof request.objectDirectory !== "string" ||
    !path.isAbsolute(request.objectDirectory) ||
    (request.objectFormat !== "sha1" && request.objectFormat !== "sha256") ||
    !Array.isArray(request.shallowObjectIds) ||
    request.shallowObjectIds.length > maximumShallowObjects ||
    !request.shallowObjectIds.every(
      (objectId) =>
        typeof objectId === "string" &&
        isObjectIdForFormat(objectId, request.objectFormat as GitObjectFormat),
    ) ||
    !Number.isSafeInteger(request.maximumOutputBytes) ||
    Number(request.maximumOutputBytes) < 1 ||
    Number(request.maximumOutputBytes) > maximumCommandBytes ||
    !Number.isSafeInteger(request.timeoutMs) ||
    Number(request.timeoutMs) < 1 ||
    Number(request.timeoutMs) > maximumTimeoutMs ||
    (request.platform !== "win32" && request.platform !== "posix")
  ) {
    return false;
  }
  return (
    isAllowedArguments(request.arguments, request.objectFormat) &&
    isAllowedInput(request.arguments, request.input, request.objectFormat)
  );
}

function isAllowedArguments(arguments_: readonly string[], objectFormat: GitObjectFormat): boolean {
  if (arguments_.length === 5 && arguments_[0] === "rev-list") {
    const count = arguments_[1]?.match(/^--max-count=([1-9][0-9]{0,3})$/u)?.[1];
    return (
      count !== undefined &&
      Number(count) <= 257 &&
      arguments_[2] === "--topo-order" &&
      arguments_[3] === "--parents" &&
      isObjectIdForFormat(arguments_[4] ?? "", objectFormat)
    );
  }
  if (arguments_.length === 2 && arguments_[0] === "cat-file") {
    return arguments_[1] === "--batch-check" || arguments_[1] === "--batch";
  }
  return (
    arguments_.length === 11 &&
    arguments_[0] === "diff-tree" &&
    arguments_[1] === "--root" &&
    arguments_[2] === "--no-commit-id" &&
    arguments_[3] === "--name-only" &&
    arguments_[4] === "-r" &&
    arguments_[5] === "-z" &&
    arguments_[6] === "--no-renames" &&
    arguments_[7] === "--no-ext-diff" &&
    arguments_[8] === "--no-textconv" &&
    arguments_[9] === "-m" &&
    isObjectIdForFormat(arguments_[10] ?? "", objectFormat)
  );
}

function isAllowedInput(
  arguments_: readonly string[],
  input: Uint8Array,
  objectFormat: GitObjectFormat,
): boolean {
  if (arguments_[0] !== "cat-file") return input.byteLength === 0;
  const text = Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString("ascii");
  if (!text.endsWith("\n") || /[^0-9a-f\n]/u.test(text)) return false;
  const lines = text.slice(0, -1).split("\n");
  return (
    lines.length > 0 &&
    lines.length <= 256 &&
    lines.every((line) => isObjectIdForFormat(line, objectFormat))
  );
}

function isObjectIdForFormat(value: string, format: GitObjectFormat): boolean {
  return value.length === (format === "sha1" ? 40 : 64) && /^[0-9a-f]+$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(reason: BoundedGitCommandFailureReason): BoundedGitCommandResult {
  return Object.freeze({ ok: false, reason });
}
