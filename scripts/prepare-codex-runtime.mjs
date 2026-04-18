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
  "codex_runtime_core.rs",
);
const runtimeCore = fs.readFileSync(runtimeCorePath, "utf8");

function readRustConst(name) {
  const match = runtimeCore.match(new RegExp(`const ${name}: &str = "([^"]+)"`));
  if (!match) {
    throw new Error(`Could not find ${name} in codex_runtime_core.rs`);
  }
  return match[1];
}

const bundledVersion = readRustConst("BUNDLED_CODEX_VERSION");
const sidecarName = readRustConst("BUNDLED_CODEX_SIDECAR_NAME");
const releaseTag = `rust-v${bundledVersion}`;
const defaultDownloadRetryAttempts = 6;
const defaultDownloadRetryDelaySeconds = 2;
const defaultDownloadRetryMaxTimeSeconds = 120;

function resolveTargetTriple() {
  return resolveBundledCodexTargetTriple(process.platform, process.arch);
}

const detectedTargetTriple = resolveTargetTriple();
const destinationDir = path.join(repoRoot, "src-tauri", "binaries");
const srcTauriDir = path.join(repoRoot, "src-tauri");
const configuredCargoTargetTriple = process.env.CARGO_BUILD_TARGET?.trim() || "";
const cargoTargetTriple = configuredCargoTargetTriple || detectedTargetTriple;
const cargoTargetArgs =
  cargoTargetTriple === detectedTargetTriple ? [] : ["--target", cargoTargetTriple];
const rustReleaseDir =
  configuredCargoTargetTriple
    ? path.join(srcTauriDir, "target", cargoTargetTriple, "release")
    : path.join(srcTauriDir, "target", "release");

function expectedAssetName() {
  if (process.platform === "win32") {
    return `codex-${cargoTargetTriple}.exe`;
  }
  return `codex-${cargoTargetTriple}.tar.gz`;
}

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

function isBundledRuntimeUsable(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const result = spawnSync(filePath, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return false;
  return result.stdout.includes(bundledVersion);
}

function binaryFilename(baseName) {
  return process.platform === "win32" ? `${baseName}.exe` : baseName;
}

function sidecarDestinationPath(baseName) {
  const destinationName =
    process.platform === "win32"
      ? `${baseName}-${cargoTargetTriple}.exe`
      : `${baseName}-${cargoTargetTriple}`;
  return path.join(destinationDir, destinationName);
}

function builtRustBinaryPath(baseName) {
  return path.join(rustReleaseDir, binaryFilename(baseName));
}

function isExecutableUsable(filePath, args = ["--help"]) {
  if (!fs.existsSync(filePath)) return false;
  const result = spawnSync(filePath, args, { encoding: "utf8" });
  return result.status === 0;
}

export function buildCurlDownloadArgs(url, destination) {
  const retryConfig = getDownloadRetryConfig();
  return [
    "-L",
    "--fail",
    "--retry",
    String(retryConfig.attempts),
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

  // GitHub Releases asset downloads occasionally return transient 5xx responses in CI.
  // Retrying here is cheaper and safer than failing the whole Rust matrix on a single CDN blip.
  run("curl", buildCurlDownloadArgs(url, destination));
}

function extractArchive(archivePath, outputDir) {
  if (archivePath.endsWith(".tar.gz")) {
    run("tar", ["-xzf", archivePath, "-C", outputDir]);
    return;
  }

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

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

function findExtractedBinary(rootDir) {
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      const expected = process.platform === "win32" ? "codex.exe" : "codex";
      if (
        entry.name === expected ||
        entry.name.startsWith(`${expected}-`) ||
        entry.name.startsWith("codex-")
      ) {
        return fullPath;
      }
    }
  }
  throw new Error(`Could not find extracted codex binary under ${rootDir}`);
}

async function ensureBundledRuntime() {
  fs.mkdirSync(destinationDir, { recursive: true });
  const destinationPath = sidecarDestinationPath(sidecarName);
  if (isBundledRuntimeUsable(destinationPath)) {
    console.log(`Bundled Codex runtime ready: ${destinationPath}`);
    return;
  }

  const assetName = expectedAssetName();
  const assetUrl = `https://github.com/openai/codex/releases/download/${releaseTag}/${assetName}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-monitor-bundled-"));
  const downloadPath = path.join(tempRoot, assetName);
  console.log(
    `Downloading bundled Codex runtime ${bundledVersion} for ${cargoTargetTriple}...`,
  );
  downloadFile(assetUrl, downloadPath);

  let binaryPath = downloadPath;
  if (assetName.endsWith(".tar.gz") || assetName.endsWith(".zip")) {
    const extractedDir = path.join(tempRoot, "extracted");
    fs.mkdirSync(extractedDir, { recursive: true });
    extractArchive(downloadPath, extractedDir);
    binaryPath = findExtractedBinary(extractedDir);
  }

  console.log(`Installing bundled Codex runtime to ${destinationPath}...`);
  fs.copyFileSync(binaryPath, destinationPath);
  if (process.platform !== "win32") {
    fs.chmodSync(destinationPath, 0o755);
  }
  if (!isBundledRuntimeUsable(destinationPath)) {
    throw new Error(`Prepared bundled Codex runtime failed validation: ${destinationPath}`);
  }

  console.log(
    `Bundled Codex runtime prepared: ${destinationPath} (${bundledVersion}, ${cargoTargetTriple})`,
  );
}

function ensureInternalDaemonSidecars() {
  const sidecars = [
    { baseName: "codex_monitor_daemon", args: ["--help"] },
    { baseName: "codex_monitor_daemonctl", args: ["--help"] },
  ];

  console.log(
    `Building managed daemon sidecars for ${cargoTargetTriple}...`,
  );
  // Building standalone daemon bins still runs the Tauri build script for this crate.
  // Override externalBin during this step to avoid a circular dependency on not-yet-copied sidecars.
  run("cargo", [
    "build",
    "--manifest-path",
    path.join(srcTauriDir, "Cargo.toml"),
    "--release",
    ...cargoTargetArgs,
    "--bin",
    "codex_monitor_daemon",
    "--bin",
    "codex_monitor_daemonctl",
  ], {
    env: {
      TAURI_CONFIG: JSON.stringify({
        bundle: {
          externalBin: [],
        },
      }),
    },
  });

  for (const sidecar of sidecars) {
    const sourcePath = builtRustBinaryPath(sidecar.baseName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Built daemon sidecar missing: ${sourcePath}`);
    }

    const destinationPath = sidecarDestinationPath(sidecar.baseName);
    fs.copyFileSync(sourcePath, destinationPath);
    if (process.platform !== "win32") {
      fs.chmodSync(destinationPath, 0o755);
    }
    if (!isExecutableUsable(destinationPath, sidecar.args)) {
      throw new Error(`Prepared daemon sidecar failed validation: ${destinationPath}`);
    }
    console.log(`Daemon sidecar prepared: ${destinationPath}`);
  }
}

export async function main() {
  await ensureBundledRuntime();
  ensureInternalDaemonSidecars();
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  await main();
}
