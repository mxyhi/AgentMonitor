import assert from "node:assert/strict";
import test from "node:test";

import { resolveBundledCodexTargetTriple } from "./codex-runtime-targets.mjs";

test("linux bundled runtime targets use gnu triples", () => {
  assert.equal(
    resolveBundledCodexTargetTriple("linux", "x64"),
    "x86_64-unknown-linux-gnu",
  );
  assert.equal(
    resolveBundledCodexTargetTriple("linux", "arm64"),
    "aarch64-unknown-linux-gnu",
  );
});

test("unsupported bundled runtime targets still fail fast", () => {
  assert.throws(
    () => resolveBundledCodexTargetTriple("linux", "ia32"),
    /Unsupported platform\/arch/,
  );
});
