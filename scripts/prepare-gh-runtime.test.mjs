import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildCurlDownloadArgs,
  buildPowerShellDownloadScript,
  getDownloadRetryConfig,
  resolveGhAssetName,
  resolveGhSidecarDestination,
} from "./prepare-gh-runtime.mjs";

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

test("resolveGhAssetName maps supported target triples", () => {
  assert.equal(
    resolveGhAssetName("x86_64-apple-darwin"),
    "gh_2.90.0_macOS_amd64.zip",
  );
  assert.equal(
    resolveGhAssetName("aarch64-pc-windows-msvc"),
    "gh_2.90.0_windows_arm64.zip",
  );
});

test("resolveGhSidecarDestination keeps tauri sidecar naming", () => {
  const destination = resolveGhSidecarDestination("x86_64-apple-darwin");
  const expectedName =
    process.platform === "win32"
      ? "gh-bundled-x86_64-apple-darwin.exe"
      : "gh-bundled-x86_64-apple-darwin";
  assert.match(
    destination,
    new RegExp(
      path
        .join("src-tauri", "binaries", expectedName)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ),
  );
});

test("buildCurlDownloadArgs enables retry for transient failures", () => {
  const args = buildCurlDownloadArgs(
    "https://example.com/gh.zip",
    "/tmp/gh.zip",
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
    "/tmp/gh.zip",
    "https://example.com/gh.zip",
  ]);
});

test("buildPowerShellDownloadScript wraps Invoke-WebRequest in retry loop", () => {
  const script = buildPowerShellDownloadScript(
    "https://example.com/gh.zip",
    "C:\\temp\\gh.zip",
  );

  assert.match(script, /\$maxAttempts = 6/);
  assert.match(script, /Invoke-WebRequest -UseBasicParsing -Uri \$uri -OutFile \$outFile/);
  assert.match(script, /Start-Sleep -Seconds \$delaySeconds/);
});
