import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, GlobalAiProviderEntry, ModelOption } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsSubsection,
  SettingsToggleRow,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { FileEditorCard } from "@/features/shared/components/FileEditorCard";
import type { SettingsCodexSectionProps } from "@settings/hooks/useSettingsCodexSection";

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

type ProviderEditorDraft = {
  id: string;
  baseUrl: string;
  apiKey: string;
};

const getProviderDisplayLabel = (provider: GlobalAiProviderEntry): string =>
  provider.builtIn ? provider.name : provider.id;

function CustomProviderRow(props: {
  provider: GlobalAiProviderEntry;
  isEditing: boolean;
  isBusy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  draft: ProviderEditorDraft;
  onDraftChange: (next: ProviderEditorDraft) => void;
  onSave: () => void;
}) {
  const locale = useAppLocale();
  const {
    provider,
    isEditing,
    isBusy,
    onStartEdit,
    onCancelEdit,
    onDelete,
    draft,
    onDraftChange,
    onSave,
  } = props;

  if (!isEditing) {
    return (
      <div className="settings-field">
        <div className="settings-field-label">{provider.id}</div>
        <div className="settings-help">
          {provider.baseUrl ?? m.settings_codex_provider_no_base_url({}, { locale })}
        </div>
        <div className="settings-help">
          {provider.apiKey
            ? m.settings_codex_provider_api_key_configured({}, { locale })
            : m.settings_codex_provider_no_api_key({}, { locale })}
        </div>
        <div className="settings-field-row">
          <button
            type="button"
            className="ghost"
            onClick={onStartEdit}
            aria-label={m.settings_codex_provider_edit_aria(
              { value: provider.id },
              { locale },
            )}
          >
            {m.action_edit({}, { locale })}
          </button>
          <button
            type="button"
            className="ghost destructive"
            onClick={onDelete}
            disabled={isBusy}
            aria-label={m.settings_codex_provider_delete_aria(
              { value: provider.id },
              { locale },
            )}
          >
            {m.action_delete({}, { locale })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-field">
      <label className="settings-field-label" htmlFor={`provider-base-url-${provider.id}`}>
        {m.settings_codex_provider_edit_base_url_label({}, { locale })}
      </label>
      <input
        id={`provider-base-url-${provider.id}`}
        className="settings-input"
        value={draft.baseUrl}
        onChange={(event) => onDraftChange({ ...draft, baseUrl: event.target.value })}
        aria-label={m.settings_codex_provider_edit_base_url_aria({}, { locale })}
      />
      <label className="settings-field-label" htmlFor={`provider-env-key-${provider.id}`}>
        {m.settings_codex_provider_edit_api_key_label({}, { locale })}
      </label>
      <input
        id={`provider-env-key-${provider.id}`}
        className="settings-input"
        type="password"
        autoComplete="off"
        value={draft.apiKey}
        onChange={(event) => onDraftChange({ ...draft, apiKey: event.target.value })}
        aria-label={m.settings_codex_provider_edit_api_key_aria({}, { locale })}
      />
      <div className="settings-field-row">
        <button
          type="button"
          className="ghost"
          onClick={onSave}
          disabled={isBusy}
          aria-label={m.settings_codex_provider_save_aria(
            { value: provider.id },
            { locale },
          )}
        >
          {m.action_save({}, { locale })}
        </button>
        <button type="button" className="ghost" onClick={onCancelEdit}>
          {m.action_cancel({}, { locale })}
        </button>
      </div>
    </div>
  );
}

export function SettingsCodexSection({
  appSettings,
  onUpdateAppSettings,
  aiSettings,
  aiSettingsLoading,
  aiSettingsError,
  updatingSessionDefaults,
  updatingOpenAiBaseUrl,
  creatingProvider,
  updatingProviderId,
  deletingProviderId,
  defaultModels,
  defaultModelsLoading,
  defaultModelsError,
  defaultModelsConnectedWorkspaceCount,
  onRefreshDefaultModels,
  onRefreshAiSettings,
  onUpdateSessionDefaults,
  onUpdateOpenAiBaseUrl,
  onCreateProvider,
  onUpdateProvider,
  onDeleteProvider,
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
  const [providerDraft, setProviderDraft] = useState(
    aiSettings?.sessionDefaults.modelProvider ?? "openai",
  );
  const [modelDraft, setModelDraft] = useState(aiSettings?.sessionDefaults.model ?? "");
  const [effortDraft, setEffortDraft] = useState(
    aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
  );
  const [openAiBaseUrlDraft, setOpenAiBaseUrlDraft] = useState(
    aiSettings?.openaiBaseUrl ?? "",
  );
  const [creatingDraft, setCreatingDraft] = useState<ProviderEditorDraft>({
    id: "",
    baseUrl: "",
    apiKey: "",
  });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ProviderEditorDraft>({
    id: "",
    baseUrl: "",
    apiKey: "",
  });
  const sessionDefaultsDraftRef = useRef({
    modelProvider: aiSettings?.sessionDefaults.modelProvider ?? "openai",
    model: aiSettings?.sessionDefaults.model ?? "",
    modelReasoningEffort: aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
  });

  useEffect(() => {
    const nextSessionDefaults = {
      modelProvider: aiSettings?.sessionDefaults.modelProvider ?? "openai",
      model: aiSettings?.sessionDefaults.model ?? "",
      modelReasoningEffort:
        aiSettings?.sessionDefaults.modelReasoningEffort ?? "medium",
    };
    sessionDefaultsDraftRef.current = nextSessionDefaults;
    setProviderDraft(nextSessionDefaults.modelProvider);
    setModelDraft(nextSessionDefaults.model);
    setEffortDraft(nextSessionDefaults.modelReasoningEffort);
    setOpenAiBaseUrlDraft(aiSettings?.openaiBaseUrl ?? "");
  }, [aiSettings]);

  const selectedModel = useMemo(
    () => findModelOption(defaultModels, modelDraft),
    [defaultModels, modelDraft],
  );
  const reasoningOptions = useMemo(
    () => buildReasoningOptions(selectedModel),
    [selectedModel],
  );
  const customProviders = aiSettings?.providers.filter((provider) => !provider.builtIn) ?? [];

  const handleProviderChange = async (nextProvider: string) => {
    sessionDefaultsDraftRef.current = {
      ...sessionDefaultsDraftRef.current,
      modelProvider: nextProvider,
    };
    setProviderDraft(nextProvider);
    await onUpdateSessionDefaults(sessionDefaultsDraftRef.current);
  };

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
        title={<label htmlFor="ai-provider">{m.settings_codex_provider_label({}, { locale })}</label>}
        subtitle={m.settings_codex_provider_subtitle({}, { locale })}
      >
        <select
          id="ai-provider"
          className="settings-select"
          value={providerDraft}
          onChange={(event) => void handleProviderChange(event.target.value)}
          disabled={aiSettingsLoading || updatingSessionDefaults}
          aria-label={m.settings_codex_provider_aria({}, { locale })}
        >
          {(aiSettings?.providers ?? []).map((provider) => (
            <option key={provider.id} value={provider.id}>
              {getProviderDisplayLabel(provider)}
            </option>
          ))}
        </select>
      </SettingsToggleRow>

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

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="openai-base-url">
          {m.settings_codex_openai_base_url_label({}, { locale })}
        </label>
        <input
          id="openai-base-url"
          className="settings-input"
          value={openAiBaseUrlDraft}
          onChange={(event) => setOpenAiBaseUrlDraft(event.target.value)}
          aria-label={m.settings_codex_openai_base_url_aria({}, { locale })}
        />
        <div className="settings-field-row">
          <button
            type="button"
            className="ghost"
            onClick={() => void onUpdateOpenAiBaseUrl(openAiBaseUrlDraft.trim() || null)}
            disabled={updatingOpenAiBaseUrl}
          >
            {m.settings_codex_openai_base_url_save({}, { locale })}
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
      </div>

      {customProviders.map((provider) => (
        <CustomProviderRow
          key={provider.id}
          provider={provider}
          isEditing={editingProviderId === provider.id}
          isBusy={updatingProviderId === provider.id || deletingProviderId === provider.id}
          onStartEdit={() => {
            setEditingProviderId(provider.id);
            setEditingDraft({
              id: provider.id,
              baseUrl: provider.baseUrl ?? "",
              apiKey: provider.apiKey ?? "",
            });
          }}
          onCancelEdit={() => setEditingProviderId(null)}
          onDelete={() => {
            void onDeleteProvider({ id: provider.id });
          }}
          draft={editingDraft}
          onDraftChange={setEditingDraft}
          onSave={() => {
            void onUpdateProvider({
              originalId: provider.id,
              id: editingDraft.id.trim() || provider.id,
              baseUrl: editingDraft.baseUrl.trim() || null,
              apiKey: editingDraft.apiKey.trim() || null,
            }).then((success) => {
              if (success) {
                setEditingProviderId(null);
              }
            });
          }}
        />
      ))}

      <div className="settings-field">
        <div className="settings-field-label">
          {m.settings_codex_add_provider_title({}, { locale })}
        </div>
        <label className="settings-field-label" htmlFor="provider-id">
          {m.settings_codex_provider_id_label({}, { locale })}
        </label>
        <input
          id="provider-id"
          className="settings-input"
          value={creatingDraft.id}
          onChange={(event) =>
            setCreatingDraft((current) => ({ ...current, id: event.target.value }))
          }
          aria-label={m.settings_codex_provider_id_aria({}, { locale })}
        />
        <label className="settings-field-label" htmlFor="provider-base-url">
          {m.settings_codex_provider_base_url_label({}, { locale })}
        </label>
        <input
          id="provider-base-url"
          className="settings-input"
          value={creatingDraft.baseUrl}
          onChange={(event) =>
            setCreatingDraft((current) => ({ ...current, baseUrl: event.target.value }))
          }
          aria-label={m.settings_codex_provider_base_url_aria({}, { locale })}
        />
        <label className="settings-field-label" htmlFor="provider-env-key">
          {m.settings_codex_provider_api_key_label({}, { locale })}
        </label>
        <input
          id="provider-env-key"
          className="settings-input"
          type="password"
          autoComplete="off"
          value={creatingDraft.apiKey}
          onChange={(event) =>
            setCreatingDraft((current) => ({ ...current, apiKey: event.target.value }))
          }
          aria-label={m.settings_codex_provider_api_key_aria({}, { locale })}
        />
        <button
          type="button"
          className="ghost"
          disabled={creatingProvider}
          onClick={() => {
            void onCreateProvider({
              id: creatingDraft.id.trim(),
              baseUrl: creatingDraft.baseUrl.trim() || null,
              apiKey: creatingDraft.apiKey.trim() || null,
            }).then((success) => {
              if (success) {
                setCreatingDraft({ id: "", baseUrl: "", apiKey: "" });
              }
            });
          }}
        >
          {m.settings_codex_add_provider_action({}, { locale })}
        </button>
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
