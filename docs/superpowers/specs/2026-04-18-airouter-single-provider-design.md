# 2026-04-18 固定 AI Provider 设计

## 目标

把当前多 provider AI 配置收口成固定三 provider 视图：`airouter`、`openai`、`local`。删除内置 provider 大列表和 custom provider CRUD，同时把启动时的 AI 快速配置弹窗改成单弹窗内联配置，并保留 `登录 OpenAI` 快捷入口。

## 已确认决策

- 固定 provider id 只保留三个：
  - `airouter`
  - `openai`
  - `local`
- 默认选中 `airouter`。
- 默认 `Base URL`：
  - `airouter = "https://airouter.mxyhi.com/v1"`
  - `openai = "https://api.openai.com/v1"`
  - `local = "http://127.0.0.1:9208/v1"`
- 启动弹窗保留 `登录 OpenAI` 按钮。
- 主流程按钮保持 `配置 API Key`。
- 点击 `配置 API Key` 后，不跳 Settings，直接在当前弹窗内切到表单。
- `Base URL` 白名单按 provider 收口：
  - `airouter`：`https://airouter.mxyhi.com`、`http://airouter.mxyhi.com`
  - `openai`：`https://api.openai.com`
  - `local`：`http://127.0.0.1[:任意端口]`、`http://localhost[:任意端口]`
- 对上述 host 仅接受空路径或 `/v1`。

## 配置模型

继续沿用全局 `config.toml`，但 AI 设置模型改成固定三 provider 视图：

- `model_provider` 只能是：
  - `airouter`
  - `openai`
  - `local`
- `[model_providers.airouter]`
- `[model_providers.openai]`
- `[model_providers.local]`
- 三个表都由宿主 app 管理：
  - `name`
  - `base_url`
  - `experimental_bearer_token`

前端 `GlobalAiSettings` 继续保留 `sessionDefaults`，但 provider 列表固定只返回这三个固定项，不再暴露多 provider 编辑能力。

## 启动弹窗行为

- 弹窗默认显示 `airouter`，但允许切换到 `openai` / `local`。
- 弹窗显示条件收口为：当前选中 provider 还不可用。
- “配置完成”定义：
  - `airouter`：`base_url` 合法且 `api_key` 非空
  - `openai`：`base_url` 合法，且满足 `OpenAI 已登录` 或 `api_key` 非空
  - `local`：`base_url` 合法；`api_key` 可空
- 弹窗默认显示说明态：
  - provider 选择器
  - 当前 provider 状态
  - `登录 OpenAI`
  - `配置 API Key`
  - `本次先跳过`
- 点击 `配置 API Key` 后切到表单态：
  - provider 选择器
  - `API Key`
  - `Base URL`
  - `保存`
  - `返回`
- 保存成功后：
  - 将 `model_provider` 切到当前选择的 provider
  - 关闭表单态
  - 刷新全局 AI 设置
  - 若配置完整则隐藏弹窗

## 设置页行为

`Settings > AI` 改为固定 provider 配置页：

- 删除 built-in provider 大列表展示
- 删除 custom provider 新增/编辑/删除
- 删除 `OpenAI Base URL` 专项输入
- 保留：
  - 默认模型
  - 默认 reasoning effort
  - access mode
  - review mode
  - personality
  - 全局 `AGENTS.md`
- 新增固定 provider 配置块：
  - provider 选择器（`airouter/openai/local`）
  - `Provider ID` 只读显示当前值
  - `Base URL`
  - `API Key`
  - `保存`
  - `刷新`
- `Base URL` placeholder / 当前值 / 校验规则随 provider 切换。
- `API Key` placeholder 随 provider 切换；`local` 标记为可留空。

## 发送前拦截

- 发送前只在以下条件同时满足时做 OpenAI 登录拦截：
  - 当前 `model_provider = "openai"`
  - 当前 `openai` provider 没有配置 `api_key`
  - `account/read` 仍要求 OpenAI 登录
- `airouter` 与 `local` 发送链不再因 OpenAI 未登录被拦住。

## 非目标

- 不做旧 provider 数据迁移兼容。
- 不保留 provider CRUD API。
- 不做 workspace/thread 级 AI 配置覆盖。
