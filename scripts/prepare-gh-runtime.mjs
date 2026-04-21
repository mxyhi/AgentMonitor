import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolveBundledCodexTargetTriple } from "./codex-runtime-targets.mjs";

const repoRoot = process.cwd();
const runtimeCorePath = path.join(
  repoRoot,
  "src-tauri",
  "src",
  "shared",
  "gh_runtime_core.rs",
);
const runtimeCore = fs.readFileSync(runtimeCorePath, "utf8");

function readRustConst(name) {
  const match = runtimeCore.match(new RegExp(`const ${name}: &str = "([^"]+)"`));
  if (!match) {
    throw new Error(`Could not find ${name} in gh_runtime_core.rs`);
  }
  return match[1];
}

const bundledVersion = readRustConst("BUNDLED_GH_VERSION");
const sidecarName = readRustConst("BUNDLED_GH_SIDECAR_NAME");
const releaseTag = `v${bundledVersion}`;
const defaultDownloadRetryAttempts = 6;
const defaultDownloadRetryDelaySeconds = 2;
const defaultDownloadRetryMaxTimeSeconds = 120;
const destinationDir = path.join(repoRoot, "src-tauri", "binaries");
const configuredCargoTargetTriple = process.env.CARGO_BUILD_TARGET?.trim() || "";
const detectedTargetTriple = resolveBundledCodexTargetTriple(process.platform, process.arch);
const cargoTargetTriple = configuredCargoTargetTriple || detectedTargetTriple;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function readPositiveIntegerEnv(name, fallback) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function getDownloadRetryConfig() {
  return {
    attempts: readPositiveIntegerEnv(
      "CODEX_RUNTIME_DOWNLOAD_RETRIES",
      defaultDownloadRetryAttempts,
    ),
    delaySeconds: readPositiveIntegerEnv(
      "CODEX_RUNTIME_DOWNLOAD_RETRY_DELAY_SECONDS",
      defaultDownloadRetryDelaySeconds,
    ),
    maxTimeSeconds: readPositiveIntegerEnv(
      "CODEX_RUNTIME_DOWNLOAD_RETRY_MAX_TIME_SECONDS",
      defaultDownloadRetryMaxTimeSeconds,
    ),
  };
}

export function buildCurlDownloadArgs(url, destination) {
  const retryConfig = getDownloadRetryConfig();
  return [
    "-L",
    "--fail",
    "--retry",
    String(retryConfig.attempts),
    "--retry-all-errors",
    "--retry-delay",
    String(retryConfig.delaySeconds),
    "--retry-max-time",
    String(retryConfig.maxTimeSeconds),
    "--retry-connrefused",
    "-o",
    destination,
    url,
  ];
}

function escapePowerShellString(value) {
  return value.replaceAll("'", "''");
}

export function buildPowerShellDownloadScript(url, destination) {
  const retryConfig = getDownloadRetryConfig();
  const escapedUrl = escapePowerShellString(url);
  const escapedDestination = escapePowerShellString(destination);
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `$uri = '${escapedUrl}'`,
    `$outFile = '${escapedDestination}'`,
    `$maxAttempts = ${retryConfig.attempts}`,
    `$delaySeconds = ${retryConfig.delaySeconds}`,
    "for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {",
    "  try {",
    "    if (Test-Path $outFile) { Remove-Item -Force $outFile }",
    "    Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $outFile",
    "    exit 0",
    "  } catch {",
    "    if ($attempt -ge $maxAttempts) { throw }",
    "    Start-Sleep -Seconds $delaySeconds",
    "  }",
    "}",
  ].join("; ");
}

function downloadFile(url, destination) {
  if (process.platform === "win32") {
    run("powershell", [
      "-NoProfile",
      "-Command",
      buildPowerShellDownloadScript(url, destination),
    ]);
    return;
  }

  run("curl", buildCurlDownloadArgs(url, destination));
}

function extractArchive(archivePath, outputDir) {
  if (archivePath.endsWith(".zip")) {
    if (process.platform === "win32") {
      run("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${outputDir}"`,
      ]);
      return;
    }
    run("unzip", ["-o", archivePath, "-d", outputDir]);
    return;
  }

  if (archivePath.endsWith(".tar.gz")) {
    run("tar", ["-xzf", archivePath, "-C", outputDir]);
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

function expectedBinaryName() {
  return process.platform === "win32" ? "gh.exe" : "gh";
}

function findExtractedGhBinary(rootDir) {
  const queue = [rootDir];
  const expected = expectedBinaryName();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.name === expected) {
        return fullPath;
      }
    }
  }
  throw new Error(`Could not find extracted gh binary under ${rootDir}`);
}

function isBundledGhUsable(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const result = spawnSync(filePath, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return false;
  const output = `${result.stdout}\n${result.stderr}`;
  return output.includes(`gh version ${bundledVersion}`);
}

export function resolveGhAssetName(targetTriple = cargoTargetTriple) {
  const assetSuffix = {
    "x86_64-apple-darwin": "macOS_amd64.zip",
    "aarch64-apple-darwin": "macOS_arm64.zip",
    "x86_64-unknown-linux-gnu": "linux_amd64.tar.gz",
    "aarch64-unknown-linux-gnu": "linux_arm64.tar.gz",
    "x86_64-pc-windows-msvc": "windows_amd64.zip",
    "aarch64-pc-windows-msvc": "windows_arm64.zip",
  }[targetTriple];

  if (!assetSuffix) {
    throw new Error(`Unsupported bundled gh target triple: ${targetTriple}`);
  }

  return `gh_${bundledVersion}_${assetSuffix}`;
}

export function resolveGhSidecarDestination(targetTriple = cargoTargetTriple) {
  const destinationName =
    process.platform === "win32"
      ? `${sidecarName}-${targetTriple}.exe`
      : `${sidecarName}-${targetTriple}`;
  return path.join(destinationDir, destinationName);
}

export async function ensureBundledGhRuntime() {
  fs.mkdirSync(destinationDir, { recursive: true });
  const destinationPath = resolveGhSidecarDestination();
  if (isBundledGhUsable(destinationPath)) {
    console.log(`Bundled GitHub CLI ready: ${destinationPath}`);
    return;
  }

  const assetName = resolveGhAssetName();
  const assetUrl = `https://github.com/cli/cli/releases/download/${releaseTag}/${assetName}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-monitor-gh-bundled-"));
  const downloadPath = path.join(tempRoot, assetName);
  console.log(`Downloading bundled GitHub CLI ${bundledVersion} for ${cargoTargetTriple}...`);
  downloadFile(assetUrl, downloadPath);

  let binaryPath = downloadPath;
  if (assetName.endsWith(".zip") || assetName.endsWith(".tar.gz")) {
    const extractedDir = path.join(tempRoot, "extracted");
    fs.mkdirSync(extractedDir, { recursive: true });
    extractArchive(downloadPath, extractedDir);
    binaryPath = findExtractedGhBinary(extractedDir);
  }

  console.log(`Installing bundled GitHub CLI to ${destinationPath}...`);
  fs.copyFileSync(binaryPath, destinationPath);
  if (process.platform !== "win32") {
    fs.chmodSync(destinationPath, 0o755);
  }
  if (!isBundledGhUsable(destinationPath)) {
    throw new Error(`Prepared bundled GitHub CLI failed validation: ${destinationPath}`);
  }

  console.log(
    `Bundled GitHub CLI prepared: ${destinationPath} (${bundledVersion}, ${cargoTargetTriple})`,
  );
}

export async function main() {
  await ensureBundledGhRuntime();
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  await main();
}
