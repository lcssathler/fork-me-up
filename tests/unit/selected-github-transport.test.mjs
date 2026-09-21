import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers";
import test from "node:test";
import {
  createSelectedGitHubPort,
  readGhCredential,
} from "../../packages/community-provider/src/selected-github-transport.ts";

/** @param {{status?: number, encoding?: string, body?: string, hang?: boolean, error?: boolean}} [behavior] */
function fixture(behavior = {}) {
  /** @type {import('node:https').RequestOptions[]} */
  const calls = [];
  let destroyed = false;
  const request = /** @type {typeof import('node:https').request} */ (
    /** @type {unknown} */ (
      /** @param {import('node:https').RequestOptions} options @param {(response: unknown) => void} callback */
      (options, callback) => {
        calls.push(options);
        const response = Object.assign(new EventEmitter(), {
          statusCode: behavior.status ?? 200,
          headers: {
            location: "https://excluded.example/SECRET_CANARY",
            ...(behavior.encoding ? { "content-encoding": behavior.encoding } : {}),
          },
          destroy() {
            destroyed = true;
          },
        });
        return Object.assign(new EventEmitter(), {
          destroy() {
            destroyed = true;
          },
          end() {
            setImmediate(() => {
              callback(response);
              if (destroyed || behavior.hang) return;
              if (behavior.error) response.emit("error", new Error("ERROR_CANARY"));
              else {
                response.emit("data", Buffer.from(behavior.body ?? "{}"));
                response.emit("end");
              }
            });
          },
        });
      }
    )
  );
  const port = createSelectedGitHubPort({ request, credential: async () => "CREDENTIAL_CANARY" });
  return { calls, port, destroyed: () => destroyed, request };
}
const input = { endpoint: "/user", maximumOutputBytes: 128, timeoutMs: 1000 };
test("authority is rechecked after credential acquisition and before opening TLS", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.port.get({
      ...input,
      beforeRequest: async () => {
        throw new Error("revoked");
      },
    }),
    { ok: false },
  );
  assert.equal(f.calls.length, 0);
});
test("transport uses only fixed TLS GET; credential reaches only its Authorization header", async () => {
  const fixtureValue = fixture();
  const result = await fixtureValue.port.get(input);
  assert.equal(result.ok, true);
  assert.equal(fixtureValue.calls.length, 1);
  const request = fixtureValue.calls[0];
  assert.ok(request);
  assert.equal(request?.hostname, "api.github.com");
  assert.equal(request?.port, 443);
  assert.equal(request?.protocol, "https:");
  assert.equal(request?.rejectUnauthorized, true);
  assert.equal(request?.method, "GET");
  assert.equal(request?.path, "/user");
  assert.equal(
    /** @type {Record<string,string>} */ (request.headers)["Authorization"],
    "Bearer CREDENTIAL_CANARY",
  );
  assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
});
test("all redirects and failed authentication stop without requesting Location or returning body", async () => {
  for (const status of [301, 302, 303, 307, 308, 401, 403, 404, 429, 500]) {
    const f = fixture({ status, body: "BODY_CANARY" });
    assert.deepEqual(await f.port.get(input), { ok: false });
    assert.equal(f.calls.length, 1);
    assert.equal(f.destroyed(), true);
  }
});
test("response overflow, compression, abort/error and deadline are bounded and content-free", async () => {
  for (const behavior of [
    { body: "x".repeat(129) },
    { encoding: "gzip" },
    { error: true },
    { hang: true },
  ]) {
    const f = fixture(behavior);
    assert.deepEqual(await f.port.get({ ...input, timeoutMs: 30 }), { ok: false });
  }
});
test("missing, malformed or failed credential acquisition opens no HTTP request", async () => {
  for (const token of [null, "", "Bearer secret", "abc\r\nInjected: secret", "x".repeat(4097)]) {
    const f = fixture();
    const port = createSelectedGitHubPort({ request: f.request, credential: async () => token });
    assert.deepEqual(await port.get(input), { ok: false });
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  assert.deepEqual(
    await createSelectedGitHubPort({
      request: f.request,
      credential: async () => {
        throw new Error("TOKEN_CANARY");
      },
    }).get(input),
    { ok: false },
  );
  assert.equal(f.calls.length, 0);
});

test("credential subprocess is fixed, noninteractive and bounded without exposing stderr", async () => {
  for (const mode of ["success", "overflow", "error", "hang", "nonzero"]) {
    let killed = false;
    const fakeSpawn = /** @type {typeof import('node:child_process').spawn} */ (
      /** @type {unknown} */ (
        /** @param {string} command @param {string[]} args @param {import('node:child_process').SpawnOptions} options */
        (command, args, options) => {
          assert.equal(command, "gh");
          assert.deepEqual(args, ["auth", "token", "--hostname", "github.com"]);
          assert.equal(options.shell, false);
          assert.equal(options.windowsHide, true);
          assert.equal(options.env?.["GH_PROMPT_DISABLED"], "1");
          assert.equal(options.env?.["GH_DEBUG"], undefined);
          const child = Object.assign(new EventEmitter(), {
            stdout: new EventEmitter(),
            stderr: new EventEmitter(),
            kill() {
              killed = true;
            },
          });
          setImmediate(() => {
            if (mode === "hang") return;
            if (mode === "error") {
              child.emit("error", new Error("CREDENTIAL_CANARY"));
              return;
            }
            child.stdout.emit(
              "data",
              Buffer.from(mode === "overflow" ? "x".repeat(8193) : "SYNTHETIC_TOKEN\n"),
            );
            child.stderr.emit("data", Buffer.from("DIAGNOSTIC_CANARY"));
            child.emit("close", mode === "nonzero" ? 1 : 0);
          });
          return child;
        }
      )
    );
    assert.equal(
      await readGhCredential(30, fakeSpawn),
      mode === "success" ? "SYNTHETIC_TOKEN" : null,
    );
    if (mode === "overflow" || mode === "hang") assert.equal(killed, true);
  }
});
