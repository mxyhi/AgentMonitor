const TARGET_TRIPLES = {
  "darwin:arm64": "aarch64-apple-darwin",
  "darwin:x64": "x86_64-apple-darwin",
  "linux:arm64": "aarch64-unknown-linux-gnu",
  "linux:x64": "x86_64-unknown-linux-gnu",
  "win32:arm64": "aarch64-pc-windows-msvc",
  "win32:x64": "x86_64-pc-windows-msvc",
};

export function resolveBundledCodexTargetTriple(platform, arch) {
  const targetTriple = TARGET_TRIPLES[`${platform}:${arch}`];
  if (!targetTriple) {
    throw new Error(`Unsupported platform/arch for bundled Codex runtime: ${platform}/${arch}`);
  }
  return targetTriple;
}
