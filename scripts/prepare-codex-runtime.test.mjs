import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurlDownloadArgs,
  buildPowerShellDownloadScript,
  getDownloadRetryConfig,
} from "./prepare-codex-runtime.mjs";

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

test("buildCurlDownloadArgs enables retry for transient failures", () => {
  const args = buildCurlDownloadArgs(
    "https://example.com/codex.tar.gz",
    "/tmp/codex.tar.gz",
  );

  assert.deepEqual(args, [
    "-L",
    "--fail",
    "--retry",
    "6",
    "--retry-delay",
    "2",
    "--retry-max-time",
    "120",
    "--retry-connrefused",
    "-o",
    "/tmp/codex.tar.gz",
    "https://example.com/codex.tar.gz",
  ]);
});

test("buildPowerShellDownloadScript wraps Invoke-WebRequest in retry loop", () => {
  const script = buildPowerShellDownloadScript(
    "https://example.com/codex.zip",
    "C:\\temp\\codex.zip",
  );

  assert.match(script, /\$maxAttempts = 6/);
  assert.match(script, /Invoke-WebRequest -UseBasicParsing -Uri \$uri -OutFile \$outFile/);
  assert.match(script, /Start-Sleep -Seconds \$delaySeconds/);
});
