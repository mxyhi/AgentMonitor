# 2026-04-21 Git Zero-Install 设计

## 目标

把 Agent Monitor 的 Git 运行时收口成面向 release 的稳定方案：

- Windows 内嵌 MinGit。
- macOS 继续复用系统 Git。
- `gh` 不再内嵌，继续走系统 PATH 或显式自定义路径。
- 前端现有 IPC、hooks、Git 面板交互尽量不变。
- app 与 daemon 继续共用同一套 shared runtime 解析与环境注入逻辑。

## 已确认决策

- 保留现有 CLI 语义，不改造成 `libgit2` 或 GitHub API 重写。
- shared 层继续分别维护：
  - `git_runtime_core.rs`
  - `gh_runtime_core.rs`
- 所有直接 `spawn git` / `spawn gh` 的 shared 逻辑统一走 runtime helper。
- Git 采用分平台策略：
  - Windows：bundled MinGit
  - macOS：system fallback
- `gh` 不参与打包，不要求 app 私有 `GH_CONFIG_DIR`，默认复用用户现有登录态。

## Runtime 设计

### Git

- `git_runtime_core.rs` 负责：
  - 解析 Git 可执行路径
  - 构造 Git 运行时环境变量
  - 屏蔽 x64 / arm64 MinGit 目录结构差异
- 解析顺序：
  - 显式自定义路径
  - bundled Git
  - 系统路径解析逻辑
- Windows bundled Git 不走单文件 sidecar。
- MinGit 作为 Tauri resources 打包到 `git-bundled/<target-triple>`。
- resolver 必须按磁盘真实布局动态探测：
  - 可执行文件
  - `libexec/git-core`
  - `share/git-core/templates`
  - PATH 注入目录

### GitHub CLI

- `gh_runtime_core.rs` 仅负责：
  - 显式自定义路径
  - 系统 PATH 解析
  - 禁交互/禁更新提示环境变量
- release 与桌面打包不再准备 `gh` sidecar。
- GitHub 功能仍可用，但前提是宿主机存在可用 `gh`。

## 打包与 Release 适配

- `scripts/prepare-codex-runtime.mjs` 仅准备：
  - bundled Codex
  - bundled Git
  - daemon sidecars
- `scripts/prepare-git-runtime.mjs` 必须支持：
  - 经典 x64 MinGit：`cmd + mingw64 + usr`
  - 新 arm64 MinGit：toolchain 根切到 `clangarm64`
- `src-tauri/tauri.conf.json`
  - `bundle.externalBin` 不再声明 `gh-bundled`
  - `bundle.resources` 保留 `git-bundled`

## 失败态与降级

- Git 不可用：
  - 本地 Git 功能报错
  - Windows 提示重装 app 或切自定义 Git 路径
  - macOS 提示安装系统 Git
- `gh` 不可用：
  - 仅影响 GitHub 能力
  - 本地 Git 能力不受影响
- GitHub 未登录：
  - 继续提示执行 `gh auth login --web`

## 测试与验收

- `scripts/prepare-git-runtime.test.mjs`
  - 覆盖 classic x64 / nested arm64 layout
- `src-tauri/src/shared/git_runtime_core.rs`
  - 覆盖 classic x64 / nested arm64 runtime env
- `src-tauri/tests/tauri_config.rs`
  - `codex-bundled` sidecar 存在
  - `git-bundled` resources 存在
  - 不再要求 `gh-bundled`
- 验收命令：
  - `node --test scripts/prepare-git-runtime.test.mjs scripts/prepare-codex-runtime.test.mjs`
  - `pnpm prepare:codex-runtime`
  - `pnpm run typecheck`
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib`
  - `cargo test --manifest-path src-tauri/Cargo.toml --test tauri_config`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `pnpm run tauri:dev -- --help`

## 非目标

- 本轮不重写为 `libgit2`
- 本轮不内嵌 `gh`
- 本轮不做 app 内 GitHub 登录 UI
- 本轮不改变前端 Git / GitHub 功能结构与信息架构
