import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  areOutputsNewerThanInputs,
  removeStaleCargoBuildScriptCaches,
  removeStaleCargoTargetProfiles,
} from "./prepare-codex-runtime.mjs";

test("removeStaleCargoBuildScriptCaches removes build dirs from previous checkout paths", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-monitor-cargo-cache-"));
  const currentSrcTauriDir = path.join(tempRoot, "AgentMonitor", "src-tauri");
  const buildRoot = path.join(currentSrcTauriDir, "target", "release", "build");
  const staleBuildDir = path.join(buildRoot, "tauri-stale");
  const freshBuildDir = path.join(buildRoot, "tauri-fresh");
  fs.mkdirSync(staleBuildDir, { recursive: true });
  fs.mkdirSync(freshBuildDir, { recursive: true });
  fs.writeFileSync(
    path.join(staleBuildDir, "output"),
    [
      "cargo:rerun-if-env-changed=TAURI_CONFIG",
      `cargo:rerun-if-changed=${path.join(tempRoot, "CodexMonitor", "src-tauri", "tauri.conf.json")}`,
      `cargo:PERMISSION_FILES_PATH=${path.join(tempRoot, "CodexMonitor", "src-tauri", "target", "release", "build", "tauri-old", "out", "app-manifest", "__app__-permission-files")}`,
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(freshBuildDir, "output"),
    `cargo:rerun-if-changed=${path.join(currentSrcTauriDir, "tauri.conf.json")}\n`,
  );

  try {
    const removed = removeStaleCargoBuildScriptCaches({
      buildRoots: [buildRoot],
      currentSrcTauriDir,
    });

    assert.deepEqual(removed, [staleBuildDir]);
    assert.equal(fs.existsSync(staleBuildDir), false);
    assert.equal(fs.existsSync(freshBuildDir), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("removeStaleCargoTargetProfiles removes stale release profiles", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-monitor-profile-"));
  const currentSrcTauriDir = path.join(tempRoot, "AgentMonitor", "src-tauri");
  const staleProfileDir = path.join(currentSrcTauriDir, "target", "release");
  const freshProfileDir = path.join(currentSrcTauriDir, "target", "debug");
  fs.mkdirSync(staleProfileDir, { recursive: true });
  fs.mkdirSync(freshProfileDir, { recursive: true });
  fs.writeFileSync(
    path.join(staleProfileDir, "codex_monitor_daemonctl.d"),
    `${path.join(tempRoot, "CodexMonitor", "src-tauri", "target", "release", "codex_monitor_daemonctl")}: ${path.join(tempRoot, "CodexMonitor", "src-tauri", "build.rs")}\n`,
  );
  fs.writeFileSync(
    path.join(freshProfileDir, "codex_monitor_daemonctl.d"),
    `${path.join(currentSrcTauriDir, "target", "debug", "codex_monitor_daemonctl")}: ${path.join(currentSrcTauriDir, "build.rs")}\n`,
  );

  try {
    const removed = removeStaleCargoTargetProfiles({
      profileDirs: [staleProfileDir, freshProfileDir],
      currentSrcTauriDir,
    });

    assert.deepEqual(removed, [staleProfileDir]);
    assert.equal(fs.existsSync(staleProfileDir), false);
    assert.equal(fs.existsSync(freshProfileDir), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("areOutputsNewerThanInputs detects fresh and stale sidecars", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-monitor-sidecar-fresh-"));
  const inputDir = path.join(tempRoot, "src");
  const inputFile = path.join(inputDir, "main.rs");
  const outputFile = path.join(tempRoot, "binaries", "codex_monitor_daemon-aarch64-apple-darwin");
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(inputFile, "fn main() {}\n");
  fs.writeFileSync(outputFile, "#!/bin/sh\nexit 0\n");

  try {
    const oldTime = new Date("2026-01-01T00:00:00Z");
    const newTime = new Date("2026-01-01T00:00:10Z");
    fs.utimesSync(inputFile, oldTime, oldTime);
    fs.utimesSync(outputFile, newTime, newTime);

    assert.equal(areOutputsNewerThanInputs([outputFile], [inputDir]), true);

    const newerInputTime = new Date("2026-01-01T00:00:20Z");
    fs.utimesSync(inputFile, newerInputTime, newerInputTime);

    assert.equal(areOutputsNewerThanInputs([outputFile], [inputDir]), false);
    assert.equal(
      areOutputsNewerThanInputs([path.join(tempRoot, "missing-sidecar")], [inputDir]),
      false,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
