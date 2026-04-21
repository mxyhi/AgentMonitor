# 2026-04-21 Git + gh Zero-Install 设计

## 目标

把 Agent Monitor 当前依赖系统 `git` / `gh` 的 Git 与 GitHub 能力收口成尽量 zero-install 的桌面体验：

- `gh` 全平台内嵌。
- Git 在 Windows 内嵌 MinGit。
- Git 在 macOS 首版继续复用系统 Git。
- 前端现有 IPC、hooks、Git 面板交互尽量不变。
- app 与 daemon 继续共用同一套 shared runtime 解析与环境注入逻辑。

## 已确认决策

- 保留现有 CLI 语义，不把本轮改造成 `libgit2` 或 GitHub API 重写项目。
- shared 层新增两个 runtime 核心：
  - `git_runtime_core.rs`
  - `gh_runtime_core.rs`
- 所有直接 `spawn git` / `spawn gh` 的 shared 逻辑统一改走 runtime helper。
- `gh` 采用全平台 bundled sidecar。
- Git 采用分平台策略：
  - Windows：bundled MinGit
  - macOS：首版 system fallback
- 首版不做 app 内 GitHub 登录 UI。
- 首版不强制 app 私有 `GH_CONFIG_DIR`，避免用户被迫重新登录一次。
- 本地 Git 与 GitHub 功能分开降级：
  - `gh` 不可用时，只影响 PR / Issues / create-repo / checkout-pr 等 GitHub 能力
  - 本地 `status/diff/commit/branch/pull/push` 继续独立可用

## 架构边界

- 前端继续通过现有 IPC 调用 Git / GitHub 能力：
  - `src/services/tauri.ts`
  - `src/features/git/hooks/*`
  - `src/features/git/components/*`
- runtime 解析、环境变量注入、错误收口都下沉到 shared 层：
  - app 与 daemon 都只依赖 shared runtime helper
  - 不在 React 层泄漏“bundled / system / path”细节
- 现有 Git / GitHub 共享核心保持职责不变：
  - `git_core.rs` 继续负责 Git 命令执行
  - `git_ui_core/github.rs` 继续负责 GitHub CLI 结果解析
  - `git_ui_core/commands.rs` 继续负责 Git 相关动作型命令
- 运行时来源统一抽象成：
  - custom
  - bundled
  - path / system

## Runtime 设计

### `gh`

- 新增 `gh_runtime_core.rs`，职责：
  - 解析 `gh` 运行时路径
  - 构造 `gh` 运行时环境变量
  - 对外返回统一的 `ResolvedGhRuntime`
- 解析顺序：
  - 显式自定义路径
  - app bundled sidecar
  - 系统 `PATH`
- 打包设计：
  - 新增 `scripts/prepare-gh-runtime.mjs`
  - 下载并校验当前目标平台的 `gh`
  - 输出到 `src-tauri/binaries/gh-bundled-<triple>`
  - `tauri.conf.json` 增加 `binaries/gh-bundled`
- `gh` 环境变量默认注入：
  - 关闭 update notifier
  - 关闭 extension update notifier
  - 后台命令禁交互 prompt
- 首版认证策略：
  - 默认复用用户现有 GitHub CLI 登录态
  - 不强制切换到 app 私有 `GH_CONFIG_DIR`

### Git

- 新增 `git_runtime_core.rs`，职责：
  - 解析 Git 可执行路径
  - 构造 Git 运行时环境变量
  - 屏蔽 bundled Git 与系统 Git 的差异
- 解析顺序：
  - 显式自定义路径
  - bundled Git
  - 现有系统路径解析逻辑

### Windows Git

- 不把 Git 当成单文件 sidecar。
- 把 MinGit 整个目录作为 Tauri resources 打包。
- resolver 指向资源目录中的 `cmd/git.exe`。
- 运行时环境至少注入：
  - `PATH`
  - `HOME`
  - `GIT_EXEC_PATH`
- Git 子命令、helper、模板查找都以 bundled MinGit 目录为准。

### macOS Git

- 首版不引入非官方 Git 分发源。
- 继续使用系统 Git：
  - `PATH`
  - 现有 known paths
- 如果系统 Git 缺失，不尝试隐式下载或静默安装。

## 共享命令收口

- `src-tauri/src/shared/git_core.rs`
  - 改为依赖 `git_runtime_core.rs`
- `src-tauri/src/shared/git_ui_core/github.rs`
  - 改为依赖 `gh_runtime_core.rs`
- `src-tauri/src/shared/git_ui_core/commands.rs`
  - 本地 Git 路径改走 `git_runtime_core.rs`
  - `create_github_repo` 改走 `gh_runtime_core.rs`
- app 与 daemon 不新增单独逻辑分叉，统一复用 shared runtime helper。

## 失败态与 UI 收口

### Git 失败态

- Git 相关错误继续承载在现有 Git 面板错误区。
- macOS 系统 Git 缺失时：
  - Git 面板显示明确错误
  - 文案给出安装引导
  - commit / pull / push / sync 等操作禁用
- Windows bundled Git 缺失或损坏时：
  - Git 面板显示“内置 Git 不可用”
  - 文案提示重装 app 或切到自定义 Git 路径

### GitHub 失败态

- `gh` 不可用时：
  - PR / Issues / create-repo / checkout-pr 报独立错误
  - 不影响本地 Git 面板
- GitHub 相关 hooks 继续返回 `error`，由现有 GitHub 面板 inline 展示。
- 动作型失败继续走 toast：
  - create GitHub repo
  - checkout PR
  - review actions

### GitHub 未登录

- 首版不补完整 app 内登录 UI。
- 未登录时：
  - GitHub 面板显示明确错误
  - 给最小 CTA，引导执行 `gh auth login --web`
  - 不再只显示底层 `Failed to run gh` 或 `GitHub CLI command failed.`

### 文案原则

- 错误文案按用户能理解的场景分类：
  - Git 不存在
  - bundled Git 损坏
  - `gh` 不存在
  - GitHub 未登录
  - 当前仓没有 Git remote
  - 当前 remote 不是 GitHub
- 不把底层 spawn 错误直接原样透给用户。

## 测试与验收

### Rust 单测

- `git_runtime_core.rs`
  - custom / bundled / path 解析顺序
  - Windows MinGit 路径定位
  - Git env 注入结果
- `gh_runtime_core.rs`
  - custom / bundled / path 解析顺序
  - `gh` env 注入结果

### 打包守卫

- `src-tauri/tests/tauri_config.rs`
  - `gh-bundled` 必须在 `bundle.externalBin`
  - Git resources 必须在桌面配置里声明

### 脚本测试

- `prepare-gh-runtime.mjs`
  - asset 名称
  - 目标路径
  - 已存在时跳过
- Git runtime 准备脚本
  - Windows MinGit 下载 / 解压 / 目录落点

### 前端定向测试

- GitHub hooks 在 `gh` 缺失 / 未登录时返回稳定错误态
- Git 面板在 Git 缺失时展示正确错误
- GitHub 错误不误伤本地 Git 面板

### 验收命令

- `pnpm run typecheck`
- 定向 `vitest`
- 定向 `cargo test`
- `cargo check`
- `pnpm run tauri:dev -- --help`

## 非目标

- 本轮不重写为 `libgit2`
- 本轮不重写 GitHub API 客户端
- 本轮不做 app 内 GitHub OAuth / device login UI
- 本轮不实现 macOS 自带 Git bundle
- 本轮不改变前端 Git / GitHub 功能结构与信息架构
