import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const srcTauriDir = path.join(repoRoot, "src-tauri");
const trackedSystemSkillsRoot = path.join(srcTauriDir, "bundled-skills", ".system");
const generatedBundledSkillsRoot = path.join(srcTauriDir, "generated-bundled-skills");
const trackedOkSkillsFallbackRoot = path.join(srcTauriDir, "bundled-skills", "ok-skills");
const defaultSystemSkillsRepo = "https://github.com/openai/skills.git";
const defaultSystemSkillsRef = "main";
const defaultOkSkillsRepo = "https://github.com/mxyhi/ok-skills.git";
const defaultOkSkillsRef = "main";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
    shell: options.shell ?? false,
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    );
  }

  return result;
}

function removeAndRecreateDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
}

export function copyDirectory(sourceRoot, destinationRoot) {
  const metadata = fs.statSync(sourceRoot, { throwIfNoEntry: true });
  if (!metadata.isDirectory()) {
    throw new Error(`Expected directory: ${sourceRoot}`);
  }

  fs.mkdirSync(destinationRoot, { recursive: true });

  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (entry.name === ".git") {
      continue;
    }

    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

export function resolveBundledSkillsConfig(env = process.env) {
  return {
    repo: env.CODEX_MONITOR_OK_SKILLS_REPO?.trim() || defaultOkSkillsRepo,
    ref: env.CODEX_MONITOR_OK_SKILLS_REF?.trim() || defaultOkSkillsRef,
  };
}

export function resolveSystemSkillsConfig(env = process.env) {
  return {
    repo: env.CODEX_MONITOR_SYSTEM_SKILLS_REPO?.trim() || defaultSystemSkillsRepo,
    ref: env.CODEX_MONITOR_SYSTEM_SKILLS_REF?.trim() || defaultSystemSkillsRef,
  };
}

export function resolveStrictMode(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--strict")) {
    return true;
  }
  return env.CI === "true";
}

function ensureTrackedOkSkillsFallback() {
  if (!fs.existsSync(trackedOkSkillsFallbackRoot)) {
    throw new Error(
      `Tracked ok-skills fallback snapshot missing: ${trackedOkSkillsFallbackRoot}`,
    );
  }
}

function ensureTrackedSystemSkillsFallback() {
  if (!fs.existsSync(trackedSystemSkillsRoot)) {
    throw new Error(
      `Tracked system skills fallback snapshot missing: ${trackedSystemSkillsRoot}`,
    );
  }
}

function cloneOkSkillsSnapshot(tempRoot, config) {
  const checkoutRoot = path.join(tempRoot, "ok-skills");
  console.log(
    `[prepare:bundled-skills] fetching latest ok-skills from ${config.repo}#${config.ref}`,
  );
  run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    config.ref,
    "--single-branch",
    config.repo,
    checkoutRoot,
  ]);
  const commit = run("git", ["-C", checkoutRoot, "rev-parse", "HEAD"]).stdout.trim();
  return {
    root: checkoutRoot,
    commit,
    mode: "remote",
  };
}

function resolveOkSkillsSource(strict) {
  ensureTrackedOkSkillsFallback();
  const config = resolveBundledSkillsConfig();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-monitor-ok-skills-"));

  try {
    const snapshot = cloneOkSkillsSnapshot(tempRoot, config);
    return {
      ...snapshot,
      cleanup() {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      },
      description: `${config.repo}#${config.ref}@${snapshot.commit}`,
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (strict) {
      throw error;
    }

    console.warn(
      `[prepare:bundled-skills] remote sync failed, falling back to tracked snapshot: ${error.message}`,
    );
    return {
      root: trackedOkSkillsFallbackRoot,
      commit: "tracked-fallback",
      mode: "fallback",
      cleanup() {},
      description: "tracked src-tauri/bundled-skills/ok-skills fallback",
    };
  }
}

async function resolveSystemSkillsSource(strict) {
  ensureTrackedSystemSkillsFallback();
  const config = resolveSystemSkillsConfig();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-monitor-system-skills-"));

  try {
    const checkoutRoot = path.join(tempRoot, "openai-skills");
    console.log(
      `[prepare:bundled-skills] fetching latest system skills from ${config.repo}#${config.ref}`,
    );
    run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      config.ref,
      "--single-branch",
      config.repo,
      checkoutRoot,
    ]);
    const systemRoot = path.join(checkoutRoot, "skills", ".system");
    if (!fs.existsSync(systemRoot)) {
      throw new Error(`System skills path missing in upstream repo: ${systemRoot}`);
    }
    const commit = run("git", ["-C", checkoutRoot, "rev-parse", "HEAD"]).stdout.trim();
    return {
      root: systemRoot,
      description: `${config.repo}#${config.ref}@${commit}`,
      cleanup() {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (strict) {
      throw error;
    }

    console.warn(
      `[prepare:bundled-skills] system skills generation failed, falling back to tracked snapshot: ${error.message}`,
    );
    return {
      root: trackedSystemSkillsRoot,
      description: "tracked src-tauri/bundled-skills/.system fallback",
      cleanup() {},
    };
  }
}

export async function prepareBundledSkills({ strict = resolveStrictMode() } = {}) {
  const source = resolveOkSkillsSource(strict);
  const systemSource = await resolveSystemSkillsSource(strict);
  try {
    removeAndRecreateDir(generatedBundledSkillsRoot);
    copyDirectory(systemSource.root, path.join(generatedBundledSkillsRoot, ".system"));
    copyDirectory(source.root, path.join(generatedBundledSkillsRoot, "ok-skills"));
    console.log(
      `[prepare:bundled-skills] prepared ${generatedBundledSkillsRoot} using ${systemSource.description} + ${source.description}`,
    );
  } finally {
    systemSource.cleanup();
    source.cleanup();
  }
}

export async function main(argv = process.argv.slice(2)) {
  await prepareBundledSkills({ strict: resolveStrictMode(argv) });
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  await main();
}
