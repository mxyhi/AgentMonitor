import assert from "node:assert/strict";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTauriDevArgs,
  DEFAULT_TAURI_DEV_PORT,
  findAvailableDevPort,
  parsePort,
} from "./run-tauri-dev.mjs";

function withListeningServer(port, callback) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, async () => {
      try {
        resolve(await callback());
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
  });
}

test("parsePort falls back for invalid env values", () => {
  assert.equal(parsePort(undefined, 3000), 3000);
  assert.equal(parsePort("", 3000), 3000);
  assert.equal(parsePort("bad", 3000), 3000);
  assert.equal(parsePort("0", 3000), 3000);
  assert.equal(parsePort("65536", 3000), 3000);
  assert.equal(parsePort("1440", 3000), 1440);
});

test("findAvailableDevPort advances when preferred port is occupied", async () => {
  const preferredPort = 15932;
  await withListeningServer(preferredPort, async () => {
    assert.equal(
      await findAvailableDevPort({ preferredPort, maxPortProbes: 2 }),
      preferredPort + 1,
    );
  });
});

test("buildTauriDevArgs preserves caller config and appends devUrl override", () => {
  const args = buildTauriDevArgs(
    ["--config", "src-tauri/tauri.windows.conf.json"],
    "http://localhost:1432",
  );

  assert.deepEqual(args.slice(0, 5), [
    "exec",
    "tauri",
    "dev",
    "--config",
    "src-tauri/tauri.windows.conf.json",
  ]);
  assert.equal(args.at(-2), "--config");
  assert.deepEqual(JSON.parse(args.at(-1)), {
    build: {
      devUrl: "http://localhost:1432",
    },
  });
});

test("package and Tauri config use fast Tauri dev command path", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

  assert.equal(packageJson.scripts["dev:tauri"], "vite");
  assert.equal(packageJson.scripts["tauri:dev"], "pnpm doctor:strict && node scripts/run-tauri-dev.mjs");
  assert.equal(
    packageJson.scripts["tauri:dev:win"],
    "pnpm doctor:win && node scripts/run-tauri-dev.mjs --config src-tauri/tauri.windows.conf.json",
  );
  assert.match(packageJson.scripts["pretauri:dev"], /pnpm i18n:compile/);
  assert.match(packageJson.scripts["pretauri:dev:win"], /pnpm i18n:compile/);
  assert.equal(tauriConfig.build.beforeDevCommand, "pnpm dev:tauri");
  assert.equal(tauriConfig.build.devUrl, `http://localhost:${DEFAULT_TAURI_DEV_PORT}`);
});
