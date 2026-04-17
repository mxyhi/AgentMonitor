import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const hasUpdaterSigningKey = Boolean(
  process.env.TAURI_SIGNING_PRIVATE_KEY ||
    process.env.TAURI_SIGNING_PRIVATE_KEY_PATH,
);

const tauriArgs = ["exec", "tauri", "build", ...forwardedArgs];

if (!hasUpdaterSigningKey) {
  console.log(
    "TAURI_SIGNING_PRIVATE_KEY not set. Disabling updater artifact generation for local build.",
  );
  tauriArgs.push(
    "--config",
    JSON.stringify({
      bundle: {
        createUpdaterArtifacts: false,
      },
    }),
  );
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, tauriArgs, {
  stdio: "inherit",
  env: process.env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
