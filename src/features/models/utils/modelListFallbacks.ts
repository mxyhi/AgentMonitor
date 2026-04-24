import type { ModelOption } from "@/types";

const CONFIG_MODEL_DESCRIPTION = "Configured in CODEX_HOME/config.toml";
const BUILT_IN_DEFAULT_MODEL = "gpt-5.5";

const GPT_5_5_FALLBACK: ModelOption = {
  id: BUILT_IN_DEFAULT_MODEL,
  model: BUILT_IN_DEFAULT_MODEL,
  displayName: BUILT_IN_DEFAULT_MODEL,
  description: "Built-in Agent Monitor default model.",
  supportedReasoningEfforts: [
    { reasoningEffort: "low", description: "" },
    { reasoningEffort: "medium", description: "" },
    { reasoningEffort: "high", description: "" },
    { reasoningEffort: "xhigh", description: "" },
  ],
  defaultReasoningEffort: "high",
  isDefault: true,
};

export function createConfigModelOption(model: string): ModelOption {
  return {
    id: model,
    model,
    displayName: `${model} (config)`,
    description: CONFIG_MODEL_DESCRIPTION,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    isDefault: false,
  };
}

function hasModel(models: ModelOption[], modelIdOrSlug: string): boolean {
  return models.some(
    (model) => model.id === modelIdOrSlug || model.model === modelIdOrSlug,
  );
}

export function withBuiltInDefaultModelFallback(models: ModelOption[]): ModelOption[] {
  if (hasModel(models, BUILT_IN_DEFAULT_MODEL)) {
    return models;
  }
  return [GPT_5_5_FALLBACK, ...models];
}

export function withConfigModelFallback(
  models: ModelOption[],
  configModel: string | null,
): ModelOption[] {
  if (!configModel || hasModel(models, configModel)) {
    return models;
  }
  return [createConfigModelOption(configModel), ...models];
}

