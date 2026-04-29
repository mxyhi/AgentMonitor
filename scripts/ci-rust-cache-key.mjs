import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

function normalizeAgentMonitorVersion(content) {
  return content.replace(
    /^version = ".*"$/m,
    'version = "<agent-monitor>"',
  );
}

function normalizeAgentMonitorLockVersion(content) {
  return content.replace(
    /(\[\[package\]\]\nname = "agent-monitor"\nversion = ")[^"]+(")/m,
    "$1<agent-monitor>$2",
  );
}

const cargoToml = normalizeAgentMonitorVersion(
  fs.readFileSync("src-tauri/Cargo.toml", "utf8"),
);
const cargoLock = normalizeAgentMonitorLockVersion(
  fs.readFileSync("src-tauri/Cargo.lock", "utf8"),
);

const hash = crypto
  .createHash("sha256")
  .update(cargoToml)
  .update("\0")
  .update(cargoLock)
  .digest("hex");

console.log(`hash=${hash}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `hash=${hash}${os.EOL}`);
}
