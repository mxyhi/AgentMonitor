import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  copyDirectory,
  resolveBundledSkillsConfig,
  resolveSystemSkillsConfig,
  resolveStrictMode,
  stageDirectorySnapshot,
} from "./prepare-bundled-skills.mjs";

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("resolveBundledSkillsConfig uses repo defaults", () => {
  assert.deepEqual(resolveBundledSkillsConfig({}), {
    repo: "https://github.com/mxyhi/ok-skills.git",
    ref: "main",
  });
});

test("resolveBundledSkillsConfig honors env overrides", () => {
  assert.deepEqual(
    resolveBundledSkillsConfig({
      CODEX_MONITOR_OK_SKILLS_REPO: "https://example.com/custom.git",
      CODEX_MONITOR_OK_SKILLS_REF: "release",
    }),
    {
      repo: "https://example.com/custom.git",
      ref: "release",
    },
  );
});

test("resolveSystemSkillsConfig uses official repo defaults", () => {
  assert.deepEqual(resolveSystemSkillsConfig({}), {
    repo: "https://github.com/openai/skills.git",
    ref: "main",
  });
});

test("resolveStrictMode follows argv and CI env", () => {
  assert.equal(resolveStrictMode(["--strict"], {}), true);
  assert.equal(resolveStrictMode([], { CI: "true" }), true);
  assert.equal(resolveStrictMode([], {}), false);
});

test("copyDirectory copies nested files but skips .git metadata", (t) => {
  const sourceRoot = createTempDir("agent-monitor-copy-source-");
  const destinationRoot = createTempDir("agent-monitor-copy-destination-");
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(destinationRoot, { recursive: true, force: true }));

  fs.mkdirSync(path.join(sourceRoot, ".git"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.mkdirSync(path.join(sourceRoot, "nested"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "nested", "SKILL.md"), "---\nname: nested\n---\n");
  fs.writeFileSync(path.join(sourceRoot, "README.md"), "snapshot\n");

  copyDirectory(sourceRoot, destinationRoot);

  assert.equal(fs.existsSync(path.join(destinationRoot, ".git")), false);
  assert.equal(
    fs.readFileSync(path.join(destinationRoot, "nested", "SKILL.md"), "utf8"),
    "---\nname: nested\n---\n",
  );
  assert.equal(
    fs.readFileSync(path.join(destinationRoot, "README.md"), "utf8"),
    "snapshot\n",
  );
});

test("stageDirectorySnapshot copies source into temp snapshot and cleans up", (t) => {
  const sourceRoot = createTempDir("agent-monitor-stage-source-");
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(sourceRoot, "nested"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "nested", "SKILL.md"), "skill\n");

  const snapshot = stageDirectorySnapshot(sourceRoot, "agent-monitor-stage-copy-");
  t.after(() => snapshot.cleanup());

  assert.equal(
    fs.readFileSync(path.join(snapshot.root, "nested", "SKILL.md"), "utf8"),
    "skill\n",
  );

  const snapshotParent = path.dirname(snapshot.root);
  snapshot.cleanup();

  assert.equal(fs.existsSync(snapshotParent), false);
});
