import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildCurlDownloadArgs,
  buildPowerShellDownloadScript,
  getDownloadRetryConfig,
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
