import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function resolveTargetTriple() {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-musl";
  if (platform === "linux" && arch === "arm64") return "aarch64-unknown-linux-musl";
  if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
  if (platform === "win32" && arch === "arm64") return "aarch64-pc-windows-msvc";
  throw new Error(`Unsupported platform/arch for bundled Codex runtime: ${platform}/${arch}`);
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

function downloadFile(url, destination) {
  if (process.platform === "win32") {
    run("powershell", [
      "-NoProfile",
      "-Command",
      `Invoke-WebRequest -UseBasicParsing -Uri "${url}" -OutFile "${destination}"`,
    ]);
    return;
  }

  run("curl", ["-L", "--fail", "-o", destination, url]);
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

await ensureBundledRuntime();
ensureInternalDaemonSidecars();
