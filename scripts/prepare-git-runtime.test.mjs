import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildCurlDownloadArgs,
  buildPowerShellDownloadScript,
  findExtractedBundledGitRoot,
  getDownloadRetryConfig,
  resolveBundledGitLayout,
  resolveBundledGitRoot,
  resolveMinGitAssetName,
} from "./prepare-git-runtime.mjs";

test("getDownloadRetryConfig falls back for invalid env", () => {
  process.env.CODEX_RUNTIME_DOWNLOAD_RETRIES = "0";
  process.env.CODEX_RUNTIME_DOWNLOAD_RETRY_DELAY_SECONDS = "-1";
  process.env.CODEX_RUNTIME_DOWNLOAD_RETRY_MAX_TIME_SECONDS = "nope";

  assert.deepEqual(getDownloadRetryConfig(), {
    attempts: 6,
    delaySeconds: 2,
    maxTimeSeconds: 120,
  });

  delete process.env.CODEX_RUNTIME_DOWNLOAD_RETRIES;
  delete process.env.CODEX_RUNTIME_DOWNLOAD_RETRY_DELAY_SECONDS;
  delete process.env.CODEX_RUNTIME_DOWNLOAD_RETRY_MAX_TIME_SECONDS;
});

test("resolveMinGitAssetName maps supported target triples", () => {
  assert.equal(
    resolveMinGitAssetName("x86_64-pc-windows-msvc"),
    "MinGit-2.54.0-64-bit.zip",
  );
  assert.equal(
    resolveMinGitAssetName("aarch64-pc-windows-msvc"),
    "MinGit-2.54.0-arm64.zip",
  );
});

test("resolveBundledGitRoot keeps resource directory layout", () => {
  const destination = resolveBundledGitRoot("x86_64-pc-windows-msvc");
  assert.match(
    destination,
    new RegExp(
      path
        .join("src-tauri", "git-bundled", "x86_64-pc-windows-msvc")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ),
  );
});

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFakeClassicGitRuntime(root) {
  for (const relative of [
    "cmd",
    "mingw64/bin",
    "mingw64/libexec/git-core",
    "mingw64/share/git-core/templates",
    "usr/bin",
  ]) {
    fs.mkdirSync(path.join(root, relative), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "cmd", "git.exe"), "");
  fs.writeFileSync(path.join(root, "mingw64", "bin", "git.exe"), "");
}

function createFakeArm64GitRuntime(root) {
  for (const relative of [
    "clangarm64/bin",
    "clangarm64/libexec/git-core",
    "clangarm64/share/git-core/templates",
  ]) {
    fs.mkdirSync(path.join(root, relative), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "clangarm64", "bin", "git.exe"), "");
}

test("resolveBundledGitLayout keeps classic x64 cmd wrapper layout", (t) => {
  const root = createTempDir("agent-monitor-git-layout-classic-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createFakeClassicGitRuntime(root);

  const layout = resolveBundledGitLayout(root);
  assert.ok(layout);
  assert.equal(layout.program, path.join(root, "cmd", "git.exe"));
  assert.equal(layout.execPath, path.join(root, "mingw64", "libexec", "git-core"));
  assert.equal(
    layout.templateDir,
    path.join(root, "mingw64", "share", "git-core", "templates"),
  );
  assert.deepEqual(layout.pathEntries, [
    path.join(root, "cmd"),
    path.join(root, "mingw64", "bin"),
    path.join(root, "usr", "bin"),
  ]);
});

test("resolveBundledGitLayout supports nested arm64 clang runtime layout", (t) => {
  const root = createTempDir("agent-monitor-git-layout-arm64-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createFakeArm64GitRuntime(root);

  const layout = resolveBundledGitLayout(root);
  assert.ok(layout);
  assert.equal(layout.program, path.join(root, "clangarm64", "bin", "git.exe"));
  assert.equal(
    layout.execPath,
    path.join(root, "clangarm64", "libexec", "git-core"),
  );
  assert.equal(
    layout.templateDir,
    path.join(root, "clangarm64", "share", "git-core", "templates"),
  );
  assert.deepEqual(layout.pathEntries, [
    path.join(root, "clangarm64", "bin"),
  ]);
});

test("findExtractedBundledGitRoot returns outer extracted root for arm64 bundles", (t) => {
  const tempRoot = createTempDir("agent-monitor-git-layout-extracted-");
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const wrappedRoot = path.join(tempRoot, "wrapped");
  fs.mkdirSync(wrappedRoot, { recursive: true });
  createFakeArm64GitRuntime(wrappedRoot);

  assert.equal(findExtractedBundledGitRoot(tempRoot), wrappedRoot);
});

test("buildCurlDownloadArgs enables retry for transient failures", () => {
  const args = buildCurlDownloadArgs(
    "https://example.com/mingit.zip",
    "/tmp/mingit.zip",
  );

  assert.deepEqual(args, [
    "-L",
    "--fail",
    "--retry",
    "6",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    "--retry-max-time",
    "120",
    "--retry-connrefused",
    "-o",
    "/tmp/mingit.zip",
    "https://example.com/mingit.zip",
  ]);
});

test("buildPowerShellDownloadScript wraps Invoke-WebRequest in retry loop", () => {
  const script = buildPowerShellDownloadScript(
    "https://example.com/mingit.zip",
    "C:\\temp\\mingit.zip",
  );

  assert.match(script, /\$maxAttempts = 6/);
  assert.match(script, /Invoke-WebRequest -UseBasicParsing -Uri \$uri -OutFile \$outFile/);
  assert.match(script, /Start-Sleep -Seconds \$delaySeconds/);
});
