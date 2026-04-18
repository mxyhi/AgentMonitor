import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, ModelOption } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsSubsection,
  SettingsToggleRow,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { FileEditorCard } from "@/features/shared/components/FileEditorCard";
import type { SettingsCodexSectionProps } from "@settings/hooks/useSettingsCodexSection";
import {
  getDefaultGlobalAiProviderBaseUrl,
  isGlobalAiProviderApiKeyOptional,
  listFixedGlobalAiProviders,
  normalizeGlobalAiProviderId,
  resolveSelectedGlobalAiProvider,
} from "@/utils/globalAiProvider";

const FALLBACK_REASONING_OPTIONS = ["minimal", "low", "medium", "high", "xhigh"];

const normalizeEffortValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const findModelOption = (
  models: ModelOption[],
  idOrModel: string | null | undefined,
): ModelOption | null => {
  const value = (idOrModel ?? "").trim();
  if (!value) {
    return null;
  }
  return models.find((model) => model.model === value || model.id === value) ?? null;
};

const buildReasoningOptions = (model: ModelOption | null): string[] => {
  if (!model) {
    return FALLBACK_REASONING_OPTIONS;
  }
  const supported = model.supportedReasoningEfforts
    .map((effort) => normalizeEffortValue(effort.reasoningEffort))
    .filter((effort): effort is string => Boolean(effort));
  if (supported.length > 0) {
    return Array.from(new Set(supported));
  }
  const fallback = normalizeEffortValue(model.defaultReasoningEffort);
  return fallback ? [fallback] : FALLBACK_REASONING_OPTIONS;
};

export function SettingsCodexSection({
  appSettings,
  onUpdateAppSettings,
  aiSettings,
  aiSettingsLoading,
  aiSettingsError,
  updatingSessionDefaults,
  updatingAiProviderSettings,
  defaultModels,
  defaultModelsLoading,
  defaultModelsError,
  defaultModelsConnectedWorkspaceCount,
  onRefreshDefaultModels,
  onRefreshAiSettings,
  onUpdateSessionDefaults,
  onUpdateAiProviderSettings,
  globalAgentsPath: _globalAgentsPath,
  globalAgentsMeta,
  globalAgentsError,
  globalAgentsContent,
  globalAgentsLoading,
  globalAgentsRefreshDisabled,
  globalAgentsSaveDisabled,
  globalAgentsSaveLabel,
  onSetGlobalAgentsContent,
  onRefreshGlobalAgents,
  onSaveGlobalAgents,
}: SettingsCodexSectionProps) {
  const locale = useAppLocale();
  const resolvedProviderState = useMemo(
    () => resolveSelectedGlobalAiProvider(aiSettings),
    [aiSettings],
  );
  const fixedProviders = useMemo(
    () => listFixedGlobalAiProviders(aiSettings),
    [aiSettings],
  );
  const selectedProvider = resolvedProviderState.provider;
  const selectedProviderBaseUrl =
    selectedProvider?.baseUrl ??
    getDefaultGlobalAiProviderBaseUrl(resolvedProviderState.providerId);
  const selectedProviderApiKey = selectedProvider?.apiKey ?? "";
  const [modelDraft, setModelDraft] = useState(aiSettings?.sessionDefaults.model ?? "");
  const [effortDraft, setEffortDraft] = useState(
    aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
  );
  const [providerDraft, setProviderDraft] = useState(resolvedProviderState.providerId);
  const [providerBaseUrlDraft, setProviderBaseUrlDraft] = useState(
    selectedProvider?.baseUrl ??
      getDefaultGlobalAiProviderBaseUrl(resolvedProviderState.providerId),
  );
  const [providerApiKeyDraft, setProviderApiKeyDraft] = useState(
    selectedProvider?.apiKey ?? "",
  );
  const [providerDraftDirty, setProviderDraftDirty] = useState(false);
  const sessionDefaultsDraftRef = useRef({
    modelProvider: resolvedProviderState.providerId,
    model: aiSettings?.sessionDefaults.model ?? "",
    modelReasoningEffort: aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
  });

  useEffect(() => {
    const nextSessionDefaults = {
      modelProvider: resolvedProviderState.providerId,
      model: aiSettings?.sessionDefaults.model ?? "",
      modelReasoningEffort:
        aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
    };
    sessionDefaultsDraftRef.current = nextSessionDefaults;
    setModelDraft(nextSessionDefaults.model);
    setEffortDraft(nextSessionDefaults.modelReasoningEffort);
    const shouldResetProviderInputs =
      !providerDraftDirty || providerDraft !== resolvedProviderState.providerId;
    setProviderDraft(resolvedProviderState.providerId);
    if (shouldResetProviderInputs) {
      setProviderBaseUrlDraft(selectedProviderBaseUrl);
      setProviderApiKeyDraft(selectedProviderApiKey);
      setProviderDraftDirty(false);
    }
  }, [
    aiSettings?.sessionDefaults.model,
    aiSettings?.sessionDefaults.modelReasoningEffort,
    providerDraft,
    providerDraftDirty,
    resolvedProviderState.providerId,
    selectedProviderApiKey,
    selectedProviderBaseUrl,
  ]);

  const selectedModel = useMemo(
    () => findModelOption(defaultModels, modelDraft),
    [defaultModels, modelDraft],
  );
  const reasoningOptions = useMemo(
    () => buildReasoningOptions(selectedModel),
    [selectedModel],
  );

  const handleModelChange = async (nextModel: string) => {
    sessionDefaultsDraftRef.current = {
      ...sessionDefaultsDraftRef.current,
      model: nextModel,
    };
    setModelDraft(nextModel);
    await onUpdateSessionDefaults(sessionDefaultsDraftRef.current);
  };

  const handleEffortChange = async (nextEffort: string) => {
    sessionDefaultsDraftRef.current = {
      ...sessionDefaultsDraftRef.current,
      modelReasoningEffort: nextEffort,
    };
    setEffortDraft(nextEffort);
    await onUpdateSessionDefaults(sessionDefaultsDraftRef.current);
  };

  const providerApiKeyOptional = isGlobalAiProviderApiKeyOptional(
    normalizeGlobalAiProviderId(providerDraft),
  );

  return (
    <SettingsSection
      title={m.settings_nav_codex({}, { locale })}
      subtitle={m.settings_codex_subtitle({}, { locale })}
    >
      {aiSettingsError ? <div className="settings-help">{aiSettingsError}</div> : null}

      <SettingsToggleRow
        title={m.settings_features_personality_title({}, { locale })}
        subtitle={m.settings_features_personality_subtitle({}, { locale })}
      >
        <select
          id="ai-personality-select"
          className="settings-select"
          value={appSettings.personality}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              personality: event.target.value as AppSettings["personality"],
            })
          }
          aria-label={m.settings_features_personality_aria({}, { locale })}
        >
          <option value="friendly">
            {m.settings_features_personality_friendly({}, { locale })}
          </option>
          <option value="pragmatic">
            {m.settings_features_personality_pragmatic({}, { locale })}
          </option>
        </select>
      </SettingsToggleRow>

      <SettingsSubsection
        title="Session defaults"
        subtitle={m.settings_codex_session_default_field_subtitle({}, { locale })}
      />

      <SettingsToggleRow
        title={<label htmlFor="ai-model">{m.composer_meta_model({}, { locale })}</label>}
        subtitle={
          defaultModelsConnectedWorkspaceCount === 0
            ? m.settings_codex_default_model_add_workspace({}, { locale })
            : defaultModelsLoading
              ? m.settings_codex_default_model_loading({}, { locale })
              : defaultModelsError
                ? m.settings_codex_default_model_error(
                    { error: defaultModelsError },
                    { locale },
                  )
                : m.settings_codex_model_manual_entry_help({}, { locale })
        }
      >
        <div className="settings-field-row">
          <input
            id="ai-model"
            className="settings-input"
            list="ai-model-options"
            value={modelDraft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setModelDraft(nextValue);
              void handleModelChange(nextValue);
            }}
            disabled={aiSettingsLoading || updatingSessionDefaults}
            aria-label={m.composer_meta_model({}, { locale })}
          />
          <datalist id="ai-model-options">
            {defaultModels.map((model) => (
              <option key={model.model} value={model.model} />
            ))}
          </datalist>
          <button
            type="button"
            className="ghost"
            onClick={onRefreshDefaultModels}
            disabled={defaultModelsLoading || defaultModelsConnectedWorkspaceCount === 0}
          >
            {m.action_refresh({}, { locale })}
          </button>
        </div>
      </SettingsToggleRow>

      <SettingsToggleRow
        title={
          <label htmlFor="ai-reasoning-effort">
            {m.settings_codex_reasoning_effort({}, { locale })}
          </label>
        }
        subtitle={m.settings_codex_session_default_field_subtitle({}, { locale })}
      >
        <select
          id="ai-reasoning-effort"
          className="settings-select"
          value={effortDraft}
          onChange={(event) => void handleEffortChange(event.target.value)}
          disabled={aiSettingsLoading || updatingSessionDefaults}
          aria-label={m.settings_codex_reasoning_effort({}, { locale })}
        >
          {reasoningOptions.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </SettingsToggleRow>

      <SettingsToggleRow
        title={
          <label htmlFor="default-access">
            {m.settings_codex_access_mode_title({}, { locale })}
          </label>
        }
        subtitle={m.settings_codex_access_mode_help({}, { locale })}
      >
        <select
          id="default-access"
          className="settings-select"
          value={appSettings.defaultAccessMode}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              defaultAccessMode: event.target.value as AppSettings["defaultAccessMode"],
            })
          }
        >
          <option value="read-only">
            {m.composer_meta_access_read_only({}, { locale })}
          </option>
          <option value="current">
            {m.composer_meta_access_on_request({}, { locale })}
          </option>
          <option value="full-access">
            {m.composer_meta_access_full_access({}, { locale })}
          </option>
        </select>
      </SettingsToggleRow>

      <SettingsToggleRow
        title={
          <label htmlFor="review-delivery">
            {m.settings_codex_review_mode({}, { locale })}
          </label>
        }
        subtitle={m.settings_codex_review_mode_help({}, { locale })}
      >
        <select
          id="review-delivery"
          className="settings-select"
          value={appSettings.reviewDeliveryMode}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              reviewDeliveryMode: event.target.value as AppSettings["reviewDeliveryMode"],
            })
          }
        >
          <option value="inline">
            {m.settings_codex_review_inline({}, { locale })}
          </option>
          <option value="detached">
            {m.settings_codex_review_detached({}, { locale })}
          </option>
        </select>
      </SettingsToggleRow>

      <SettingsSubsection
        title={m.settings_codex_providers_title({}, { locale })}
        subtitle={m.settings_codex_providers_subtitle({}, { locale })}
      />

      <SettingsToggleRow
        title={
          <label htmlFor="ai-provider-select">
            {m.settings_codex_provider_label({}, { locale })}
          </label>
        }
        subtitle={m.settings_codex_provider_id_label({}, { locale })}
      >
        <select
          id="ai-provider-select"
          className="settings-select"
          value={providerDraft}
          onChange={(event) => {
            const nextProviderId = normalizeGlobalAiProviderId(event.target.value);
            const nextProvider =
              fixedProviders.find((provider) => provider.id === nextProviderId) ??
              fixedProviders[0];
            const nextSessionDefaults = {
              ...sessionDefaultsDraftRef.current,
              modelProvider: nextProviderId,
            };
            sessionDefaultsDraftRef.current = nextSessionDefaults;
            setProviderDraft(nextProviderId);
            setProviderBaseUrlDraft(
              nextProvider.baseUrl ??
                getDefaultGlobalAiProviderBaseUrl(nextProviderId),
            );
            setProviderApiKeyDraft(nextProvider.apiKey ?? "");
            setProviderDraftDirty(false);
            void onUpdateSessionDefaults(nextSessionDefaults);
          }}
          aria-label={m.settings_codex_provider_aria({}, { locale })}
        >
          {fixedProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </SettingsToggleRow>

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="selected-provider-id">
          {m.settings_codex_provider_id_label({}, { locale })}
        </label>
        <input
          id="selected-provider-id"
          className="settings-input"
          value={providerDraft}
          readOnly
          aria-label={m.settings_codex_provider_id_aria({}, { locale })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="selected-provider-base-url">
          {m.settings_codex_provider_base_url_label({}, { locale })}
        </label>
        <input
          id="selected-provider-base-url"
          className="settings-input"
          value={providerBaseUrlDraft}
          onChange={(event) => {
            setProviderBaseUrlDraft(event.target.value);
            setProviderDraftDirty(true);
          }}
          aria-label={m.settings_codex_provider_base_url_aria({}, { locale })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="selected-provider-api-key">
          {m.settings_codex_provider_api_key_label({}, { locale })}
        </label>
        <input
          id="selected-provider-api-key"
          className="settings-input"
          type="password"
          autoComplete="off"
          value={providerApiKeyDraft}
          placeholder={
            providerApiKeyOptional
              ? m.ai_provider_api_key_optional_placeholder({}, { locale })
              : undefined
          }
          onChange={(event) => {
            setProviderApiKeyDraft(event.target.value);
            setProviderDraftDirty(true);
          }}
          aria-label={m.settings_codex_provider_api_key_aria({}, { locale })}
        />
        <div className="settings-field-row">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void onUpdateAiProviderSettings({
                providerId: providerDraft,
                baseUrl: providerBaseUrlDraft.trim() || null,
                apiKey: providerApiKeyDraft.trim() || null,
              }).then((saved) => {
                if (saved) {
                  setProviderDraftDirty(false);
                }
              });
            }}
            disabled={updatingAiProviderSettings}
          >
            {m.action_save({}, { locale })}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onRefreshAiSettings}
            disabled={aiSettingsLoading}
          >
            {m.action_refresh({}, { locale })}
          </button>
        </div>
        {providerApiKeyOptional ? (
          <div className="settings-help">
            {m.ai_provider_api_key_optional_hint({}, { locale })}
          </div>
        ) : null}
      </div>

      <FileEditorCard
        title="AGENTS.md"
        meta={globalAgentsMeta}
        value={globalAgentsContent}
        error={globalAgentsError}
        helpText={m.settings_codex_global_agents_managed_path({}, { locale })}
        placeholder={m.settings_codex_global_agents_placeholder({}, { locale })}
        disabled={globalAgentsLoading}
        saveLabel={globalAgentsSaveLabel}
        saveDisabled={globalAgentsSaveDisabled}
        refreshDisabled={globalAgentsRefreshDisabled}
        onChange={onSetGlobalAgentsContent}
        onRefresh={onRefreshGlobalAgents}
        onSave={onSaveGlobalAgents}
        classNames={{
          container: "settings-field settings-agents",
          header: "settings-agents-header",
          title: "settings-field-label",
          actions: "settings-agents-actions",
          meta: "settings-help settings-help-inline",
          iconButton: "ghost settings-icon-button",
          error: "settings-agents-error",
          textarea: "settings-agents-textarea",
          help: "settings-help",
        }}
      />
    </SettingsSection>
  );
}
