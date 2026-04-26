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
  "git_runtime_core.rs",
);
const runtimeCore = fs.readFileSync(runtimeCorePath, "utf8");

function readRustConst(name) {
  const match = runtimeCore.match(new RegExp(`const ${name}: &str = "([^"]+)"`));
  if (!match) {
    throw new Error(`Could not find ${name} in git_runtime_core.rs`);
  }
  return match[1];
}

const bundledVersion = readRustConst("BUNDLED_GIT_WINDOWS_VERSION");
const resourceDirName = readRustConst("BUNDLED_GIT_RESOURCE_DIR");
const releaseTag = `v${bundledVersion}`;
const defaultDownloadRetryAttempts = 6;
const defaultDownloadRetryDelaySeconds = 2;
const defaultDownloadRetryMaxTimeSeconds = 120;
const configuredCargoTargetTriple = process.env.CARGO_BUILD_TARGET?.trim() || "";
const detectedTargetTriple = resolveBundledCodexTargetTriple(process.platform, process.arch);
const cargoTargetTriple = configuredCargoTargetTriple || detectedTargetTriple;
const destinationDir = path.join(repoRoot, "src-tauri", resourceDirName);

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
  if (!archivePath.endsWith(".zip")) {
    throw new Error(`Unsupported MinGit archive format: ${archivePath}`);
  }

  if (process.platform === "win32") {
    run("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${outputDir}"`,
    ]);
    return;
  }

  run("unzip", ["-o", archivePath, "-d", outputDir]);
}

function isDirectory(candidate) {
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
}

function isFile(candidate) {
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

const preferredToolchainRootNames = ["mingw64", "clangarm64", "clang64", "ucrt64", "mingw32"];

function compareToolchainRoots(left, right) {
  const leftName = path.basename(left).toLowerCase();
  const rightName = path.basename(right).toLowerCase();
  const leftIndex = preferredToolchainRootNames.indexOf(leftName);
  const rightIndex = preferredToolchainRootNames.indexOf(rightName);
  const normalizedLeftIndex = leftIndex === -1 ? preferredToolchainRootNames.length : leftIndex;
  const normalizedRightIndex = rightIndex === -1 ? preferredToolchainRootNames.length : rightIndex;
  if (normalizedLeftIndex !== normalizedRightIndex) {
    return normalizedLeftIndex - normalizedRightIndex;
  }
  return left.localeCompare(right);
}

function isBundledGitToolchainRoot(root) {
  return (
    isFile(path.join(root, "bin", "git.exe")) &&
    isDirectory(path.join(root, "libexec", "git-core")) &&
    isDirectory(path.join(root, "share", "git-core", "templates"))
  );
}

function collectBundledGitToolchainRoots(root) {
  if (!isDirectory(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((candidate) => isBundledGitToolchainRoot(candidate))
    .sort(compareToolchainRoots);
}

function appendUniquePath(paths, candidate) {
  if (!candidate || !isDirectory(candidate) || paths.includes(candidate)) {
    return;
  }
  paths.push(candidate);
}

function createBundledGitLayout(containerRoot, toolchainRoot) {
  const wrappedGit = path.join(containerRoot, "cmd", "git.exe");
  const directGit = path.join(toolchainRoot, "bin", "git.exe");
  const program = isFile(wrappedGit) ? wrappedGit : directGit;
  const execPath = path.join(toolchainRoot, "libexec", "git-core");
  const templateDir = path.join(toolchainRoot, "share", "git-core", "templates");
  if (!isFile(program) || !isDirectory(execPath) || !isDirectory(templateDir)) {
    return null;
  }

  const pathEntries = [];
  if (isFile(wrappedGit)) {
    appendUniquePath(pathEntries, path.join(containerRoot, "cmd"));
  }
  appendUniquePath(pathEntries, path.join(toolchainRoot, "bin"));
  appendUniquePath(pathEntries, path.join(containerRoot, "usr", "bin"));

  return {
    program,
    execPath,
    templateDir,
    pathEntries,
    toolchainRoot,
  };
}

// Git for Windows 2.54 keeps x64 MinGit in the classic root layout but arm64 now ships
// under a nested clangarm64 toolchain root. Detect the usable layout from files on disk
// instead of hard-coding one directory name per architecture.
export function resolveBundledGitLayout(root) {
  const nestedToolchainRoots = collectBundledGitToolchainRoots(root);
  if (nestedToolchainRoots.length > 0) {
    return createBundledGitLayout(root, nestedToolchainRoots[0]);
  }

  if (isBundledGitToolchainRoot(root)) {
    return createBundledGitLayout(root, root);
  }

  return null;
}

function isWindowsTarget(targetTriple = cargoTargetTriple) {
  return targetTriple.endsWith("-pc-windows-msvc");
}

function bundledGitValidationEnv(layout) {
  return {
    ...process.env,
    PATH: [
      ...layout.pathEntries,
      process.env.PATH ?? "",
    ].filter(Boolean).join(path.delimiter),
    GIT_EXEC_PATH: layout.execPath,
    GIT_TEMPLATE_DIR: layout.templateDir,
  };
}

function isBundledGitUsable(root) {
  const layout = resolveBundledGitLayout(root);
  if (!layout) {
    return false;
  }
  if (process.platform !== "win32") {
    return true;
  }

  const env = bundledGitValidationEnv(layout);
  const versionResult = spawnSync(layout.program, ["--version"], { encoding: "utf8", env });
  if (versionResult.status !== 0) {
    return false;
  }
  if (!`${versionResult.stdout}\n${versionResult.stderr}`.includes(`git version ${bundledVersion}`)) {
    return false;
  }
  const execPathResult = spawnSync(layout.program, ["--exec-path"], { encoding: "utf8", env });
  if (execPathResult.status !== 0) {
    return false;
  }
  return fs.existsSync(execPathResult.stdout.trim());
}

export function resolveMinGitAssetName(targetTriple = cargoTargetTriple) {
  const assetName = {
    "x86_64-pc-windows-msvc": `MinGit-${bundledVersion.replace(".windows.1", "")}-64-bit.zip`,
    "aarch64-pc-windows-msvc": `MinGit-${bundledVersion.replace(".windows.1", "")}-arm64.zip`,
  }[targetTriple];

  if (!assetName) {
    throw new Error(`Unsupported bundled Git target triple: ${targetTriple}`);
  }

  return assetName;
}

export function resolveBundledGitRoot(targetTriple = cargoTargetTriple) {
  return path.join(destinationDir, targetTriple);
}

export function findExtractedBundledGitRoot(rootDir) {
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (resolveBundledGitLayout(current)) {
      return current;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        queue.push(path.join(current, entry.name));
      }
    }
  }

  throw new Error(`Could not find extracted MinGit root under ${rootDir}`);
}

export async function ensureBundledGitRuntime() {
  if (!isWindowsTarget()) {
    console.log(`Skipping bundled Git runtime for ${cargoTargetTriple}.`);
    return;
  }

  fs.mkdirSync(destinationDir, { recursive: true });
  const destinationRoot = resolveBundledGitRoot();
  if (isBundledGitUsable(destinationRoot)) {
    console.log(`Bundled Git runtime ready: ${destinationRoot}`);
    return;
  }

  const assetName = resolveMinGitAssetName();
  const assetUrl = `https://github.com/git-for-windows/git/releases/download/${releaseTag}/${assetName}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-monitor-git-bundled-"));
  const downloadPath = path.join(tempRoot, assetName);
  console.log(`Downloading bundled Git runtime ${bundledVersion} for ${cargoTargetTriple}...`);
  downloadFile(assetUrl, downloadPath);

  const extractedDir = path.join(tempRoot, "extracted");
  fs.mkdirSync(extractedDir, { recursive: true });
  extractArchive(downloadPath, extractedDir);
  const extractedRoot = findExtractedBundledGitRoot(extractedDir);

  console.log(`Installing bundled Git runtime to ${destinationRoot}...`);
  fs.rmSync(destinationRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinationRoot), { recursive: true });
  fs.cpSync(extractedRoot, destinationRoot, { recursive: true });

  if (!isBundledGitUsable(destinationRoot)) {
    throw new Error(`Prepared bundled Git runtime failed validation: ${destinationRoot}`);
  }

  console.log(
    `Bundled Git runtime prepared: ${destinationRoot} (${bundledVersion}, ${cargoTargetTriple})`,
  );
}

export async function main() {
  await ensureBundledGitRuntime();
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  await main();
}
