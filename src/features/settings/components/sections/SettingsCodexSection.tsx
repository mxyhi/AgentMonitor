import { useEffect, useMemo, useRef } from "react";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppLanguage,
  AppSettings,
  CodexDoctorResult,
  CodexUpdateResult,
  ModelOption,
} from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsToggleRow,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { FileEditorCard } from "@/features/shared/components/FileEditorCard";

type SettingsCodexSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  defaultModels: ModelOption[];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  codexPathDraft: string;
  codexArgsDraft: string;
  codexDirty: boolean;
  isSavingSettings: boolean;
  doctorState: {
    status: "idle" | "running" | "done";
    result: CodexDoctorResult | null;
  };
  globalAgentsPath: string | null;
  codexUpdateState: {
    status: "idle" | "running" | "done";
    result: CodexUpdateResult | null;
  };
  globalConfigPath: string | null;
  globalAgentsMeta: string;
  globalAgentsError: string | null;
  globalAgentsContent: string;
  globalAgentsLoading: boolean;
  globalAgentsRefreshDisabled: boolean;
  globalAgentsSaveDisabled: boolean;
  globalAgentsSaveLabel: string;
  globalConfigMeta: string;
  globalConfigError: string | null;
  globalConfigContent: string;
  globalConfigLoading: boolean;
  globalConfigRefreshDisabled: boolean;
  globalConfigSaveDisabled: boolean;
  globalConfigSaveLabel: string;
  onSetCodexPathDraft: Dispatch<SetStateAction<string>>;
  onSetCodexArgsDraft: Dispatch<SetStateAction<string>>;
  onSetGlobalAgentsContent: (value: string) => void;
  onSetGlobalConfigContent: (value: string) => void;
  onBrowseCodex: () => Promise<void>;
  onSaveCodexSettings: () => Promise<void>;
  onRunDoctor: () => Promise<void>;
  onRunCodexUpdate: () => Promise<void>;
  onRefreshGlobalAgents: () => void;
  onSaveGlobalAgents: () => void;
  onRefreshGlobalConfig: () => void;
  onSaveGlobalConfig: () => void;
};

const DEFAULT_REASONING_EFFORT = "medium";

const normalizeEffortValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

function coerceSavedModelSlug(value: string | null, models: ModelOption[]): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const bySlug = models.find((model) => model.model === trimmed);
  if (bySlug) {
    return bySlug.model;
  }
  const byId = models.find((model) => model.id === trimmed);
  return byId ? byId.model : null;
}

const getReasoningSupport = (model: ModelOption | null): boolean => {
  if (!model) {
    return false;
  }
  return model.supportedReasoningEfforts.length > 0 || model.defaultReasoningEffort !== null;
};

const getReasoningOptions = (model: ModelOption | null): string[] => {
  if (!model) {
    return [];
  }
  const supported = model.supportedReasoningEfforts
    .map((effort) => normalizeEffortValue(effort.reasoningEffort))
    .filter((effort): effort is string => Boolean(effort));
  if (supported.length > 0) {
    return Array.from(new Set(supported));
  }
  const fallback = normalizeEffortValue(model.defaultReasoningEffort);
  return fallback ? [fallback] : [];
};

const getDoctorRuntimeSourceLabel = (
  runtimeSource: CodexDoctorResult["runtimeSource"],
  locale: AppLanguage,
) => {
  switch (runtimeSource) {
    case "custom":
      return m.settings_codex_runtime_source_custom({}, { locale });
    case "bundled":
      return m.settings_codex_runtime_source_bundled({}, { locale });
    case "path":
      return m.settings_codex_runtime_source_path({}, { locale });
  }
};

const getCodexUpdateMethodLabel = (
  method: CodexUpdateResult["method"],
  locale: AppLanguage,
) => {
  switch (method) {
    case "brew_formula":
      return m.settings_codex_method_brew_formula({}, { locale });
    case "brew_cask":
      return m.settings_codex_method_brew_cask({}, { locale });
    case "npm":
      return m.settings_codex_method_npm({}, { locale });
    case "bundled":
      return m.settings_codex_method_bundled({}, { locale });
    case "unknown":
      return m.settings_codex_method_unknown({}, { locale });
  }
};

export function SettingsCodexSection({
  appSettings,
  onUpdateAppSettings,
  defaultModels,
  defaultModelsLoading,
  defaultModelsError,
  defaultModelsConnectedWorkspaceCount,
  onRefreshDefaultModels,
  codexPathDraft,
  codexArgsDraft,
  codexDirty,
  isSavingSettings,
  doctorState,
  globalAgentsPath,
  codexUpdateState,
  globalConfigPath,
  globalAgentsMeta,
  globalAgentsError,
  globalAgentsContent,
  globalAgentsLoading,
  globalAgentsRefreshDisabled,
  globalAgentsSaveDisabled,
  globalAgentsSaveLabel,
  globalConfigMeta,
  globalConfigError,
  globalConfigContent,
  globalConfigLoading,
  globalConfigRefreshDisabled,
  globalConfigSaveDisabled,
  globalConfigSaveLabel,
  onSetCodexPathDraft,
  onSetCodexArgsDraft,
  onSetGlobalAgentsContent,
  onSetGlobalConfigContent,
  onBrowseCodex,
  onSaveCodexSettings,
  onRunDoctor,
  onRunCodexUpdate,
  onRefreshGlobalAgents,
  onSaveGlobalAgents,
  onRefreshGlobalConfig,
  onSaveGlobalConfig,
}: SettingsCodexSectionProps) {
  const locale = useAppLocale();
  const globalAgentsResolvedPath =
    globalAgentsPath ?? m.settings_codex_global_agents_managed_path({}, { locale });
  const globalConfigResolvedPath =
    globalConfigPath ?? m.settings_codex_global_config_managed_path({}, { locale });
  const latestModelSlug = defaultModels[0]?.model ?? null;
  const savedModelSlug = useMemo(
    () => coerceSavedModelSlug(appSettings.lastComposerModelId, defaultModels),
    [appSettings.lastComposerModelId, defaultModels],
  );
  const selectedModelSlug = savedModelSlug ?? latestModelSlug ?? "";
  const selectedModel = useMemo(
    () => defaultModels.find((model) => model.model === selectedModelSlug) ?? null,
    [defaultModels, selectedModelSlug],
  );
  const reasoningSupported = useMemo(
    () => getReasoningSupport(selectedModel),
    [selectedModel],
  );
  const reasoningOptions = useMemo(
    () => getReasoningOptions(selectedModel),
    [selectedModel],
  );
  const savedEffort = useMemo(
    () => normalizeEffortValue(appSettings.lastComposerReasoningEffort),
    [appSettings.lastComposerReasoningEffort],
  );
  const selectedEffort = useMemo(() => {
    if (!reasoningSupported) {
      return "";
    }
    if (savedEffort && reasoningOptions.includes(savedEffort)) {
      return savedEffort;
    }
    if (reasoningOptions.includes(DEFAULT_REASONING_EFFORT)) {
      return DEFAULT_REASONING_EFFORT;
    }
    const fallback = normalizeEffortValue(selectedModel?.defaultReasoningEffort);
    if (fallback && reasoningOptions.includes(fallback)) {
      return fallback;
    }
    return reasoningOptions[0] ?? "";
  }, [reasoningOptions, reasoningSupported, savedEffort, selectedModel]);

  const didNormalizeDefaultsRef = useRef(false);
  useEffect(() => {
    if (didNormalizeDefaultsRef.current) {
      return;
    }
    if (!defaultModels.length) {
      return;
    }
    const savedRawModel = (appSettings.lastComposerModelId ?? "").trim();
    const savedRawEffort = (appSettings.lastComposerReasoningEffort ?? "").trim();
    const shouldNormalizeModel = savedRawModel.length === 0 || savedModelSlug === null;
    const shouldNormalizeEffort =
      reasoningSupported &&
      (savedRawEffort.length === 0 ||
        savedEffort === null ||
        !reasoningOptions.includes(savedEffort));
    if (!shouldNormalizeModel && !shouldNormalizeEffort) {
      didNormalizeDefaultsRef.current = true;
      return;
    }

    const next: AppSettings = {
      ...appSettings,
      lastComposerModelId: shouldNormalizeModel ? selectedModelSlug : appSettings.lastComposerModelId,
      lastComposerReasoningEffort: shouldNormalizeEffort
        ? selectedEffort
        : appSettings.lastComposerReasoningEffort,
    };
    didNormalizeDefaultsRef.current = true;
    void onUpdateAppSettings(next);
  }, [
    appSettings,
    defaultModels.length,
    onUpdateAppSettings,
    reasoningOptions,
    reasoningSupported,
    savedEffort,
    savedModelSlug,
    selectedModelSlug,
    selectedEffort,
  ]);

  return (
    <SettingsSection
      title={m.settings_nav_codex({}, { locale })}
      subtitle={m.settings_codex_subtitle({}, { locale })}
    >
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="codex-path">
          {m.settings_codex_path_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="codex-path"
            className="settings-input"
            value={codexPathDraft}
            placeholder="codex"
            onChange={(event) => onSetCodexPathDraft(event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void onBrowseCodex();
            }}
          >
            {m.action_browse({}, { locale })}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => onSetCodexPathDraft("")}
          >
            {m.settings_codex_use_path({}, { locale })}
          </button>
        </div>
        <div className="settings-help">{m.settings_codex_path_help({}, { locale })}</div>
        <label className="settings-field-label" htmlFor="codex-args">
          {m.settings_codex_args_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="codex-args"
            className="settings-input"
            value={codexArgsDraft}
            placeholder="--profile personal"
            onChange={(event) => onSetCodexArgsDraft(event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => onSetCodexArgsDraft("")}
          >
            {m.action_clear({}, { locale })}
          </button>
        </div>
        <div className="settings-help">
          {m.settings_codex_args_help({}, { locale })}
        </div>
        <div className="settings-help">
          {m.settings_codex_shared_help({}, { locale })}
        </div>
        <div className="settings-help">
          {m.settings_codex_unsupported_flags_help({}, { locale })}
        </div>
        <div className="settings-field-actions">
          {codexDirty && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                void onSaveCodexSettings();
              }}
              disabled={isSavingSettings}
            >
              {isSavingSettings
                ? m.action_saving({}, { locale })
                : m.action_save({}, { locale })}
            </button>
          )}
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void onRunDoctor();
            }}
            disabled={doctorState.status === "running"}
          >
            <Stethoscope aria-hidden />
            {doctorState.status === "running"
              ? m.settings_codex_running_doctor({}, { locale })
              : m.settings_codex_run_doctor({}, { locale })}
          </button>
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void onRunCodexUpdate();
            }}
            disabled={codexUpdateState.status === "running"}
            title={m.settings_codex_update_title({}, { locale })}
          >
            <Stethoscope aria-hidden />
            {codexUpdateState.status === "running"
              ? m.settings_codex_updating({}, { locale })
              : m.settings_codex_update({}, { locale })}
          </button>
        </div>

        {doctorState.result && (
          <div className={`settings-doctor ${doctorState.result.ok ? "ok" : "error"}`}>
            <div className="settings-doctor-title">
              {doctorState.result.ok
                ? m.settings_codex_doctor_ok({}, { locale })
                : m.settings_codex_doctor_issue({}, { locale })}
            </div>
            <div className="settings-doctor-body">
              <div>
                {m.settings_codex_source({}, { locale })}:{" "}
                {getDoctorRuntimeSourceLabel(doctorState.result.runtimeSource, locale)}
              </div>
              <div>
                {m.settings_codex_version({}, { locale })}:{" "}
                {doctorState.result.version ?? m.settings_codex_unknown({}, { locale })}
              </div>
              <div>
                {m.settings_codex_app_server({}, { locale })}:{" "}
                {doctorState.result.appServerOk
                  ? m.settings_codex_status_ok({}, { locale })
                  : m.settings_codex_status_failed({}, { locale })}
              </div>
              <div>
                {m.settings_codex_node({}, { locale })}:{" "}
                {doctorState.result.runtimeSource === "bundled"
                  ? m.settings_codex_node_not_required({}, { locale })
                  : doctorState.result.nodeOk
                    ? doctorState.result.nodeVersion
                      ? m.settings_codex_status_ok_with_version(
                          { version: doctorState.result.nodeVersion },
                          { locale },
                        )
                      : m.settings_codex_status_ok({}, { locale })
                    : m.settings_codex_node_missing({}, { locale })}
              </div>
              {doctorState.result.details && <div>{doctorState.result.details}</div>}
              {doctorState.result.nodeDetails && <div>{doctorState.result.nodeDetails}</div>}
              {doctorState.result.path && (
                <div className="settings-doctor-path">PATH: {doctorState.result.path}</div>
              )}
            </div>
          </div>
        )}

        {codexUpdateState.result && (
          <div
            className={`settings-doctor ${codexUpdateState.result.ok ? "ok" : "error"}`}
          >
            <div className="settings-doctor-title">
              {codexUpdateState.result.ok
                ? codexUpdateState.result.upgraded
                  ? m.settings_codex_updated({}, { locale })
                  : m.settings_codex_up_to_date({}, { locale })
                : m.settings_codex_update_failed({}, { locale })}
            </div>
            <div className="settings-doctor-body">
              <div>
                {m.settings_codex_method({}, { locale })}:{" "}
                {getCodexUpdateMethodLabel(codexUpdateState.result.method, locale)}
              </div>
              {codexUpdateState.result.package && (
                <div>
                  {m.settings_codex_package({}, { locale })}:{" "}
                  {codexUpdateState.result.package}
                </div>
              )}
              <div>
                {m.settings_codex_version({}, { locale })}:{" "}
                {codexUpdateState.result.afterVersion ??
                  codexUpdateState.result.beforeVersion ??
                  m.settings_codex_unknown({}, { locale })}
              </div>
              {codexUpdateState.result.details && <div>{codexUpdateState.result.details}</div>}
              {codexUpdateState.result.output && (
                <details>
                  <summary>{m.settings_codex_output({}, { locale })}</summary>
                  <pre>{codexUpdateState.result.output}</pre>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="settings-divider" />
      <div className="settings-field-label settings-field-label--section">
        {m.settings_codex_default_parameters({}, { locale })}
      </div>

      <SettingsToggleRow
        title={
          <label htmlFor="default-model">
            {m.composer_meta_model({}, { locale })}
          </label>
        }
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
                : m.settings_codex_default_model_help({}, { locale })
        }
      >
        <div className="settings-field-row">
          <select
            id="default-model"
            className="settings-select"
            value={selectedModelSlug}
            disabled={!defaultModels.length || defaultModelsLoading}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                lastComposerModelId: event.target.value,
              })
            }
            aria-label={m.composer_meta_model({}, { locale })}
          >
            {defaultModels.map((model) => (
              <option key={model.model} value={model.model}>
                {model.displayName?.trim() || model.model}
              </option>
            ))}
          </select>
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
          <label htmlFor="default-effort">
            {m.settings_codex_reasoning_effort({}, { locale })}
          </label>
        }
        subtitle={
          reasoningSupported
            ? m.settings_codex_reasoning_effort_help({}, { locale })
            : m.settings_codex_reasoning_effort_unavailable({}, { locale })
        }
      >
        <select
          id="default-effort"
          className="settings-select"
          value={selectedEffort}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              lastComposerReasoningEffort: event.target.value,
            })
          }
          aria-label={m.settings_codex_reasoning_effort({}, { locale })}
          disabled={!reasoningSupported}
        >
          {!reasoningSupported && (
            <option value="">{m.settings_codex_not_supported({}, { locale })}</option>
          )}
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
          <option value="read-only">{m.composer_meta_access_read_only({}, { locale })}</option>
          <option value="current">{m.composer_meta_access_on_request({}, { locale })}</option>
          <option value="full-access">{m.composer_meta_access_full_access({}, { locale })}</option>
        </select>
      </SettingsToggleRow>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="review-delivery">
          {m.settings_codex_review_mode({}, { locale })}
        </label>
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
          <option value="inline">{m.settings_codex_review_inline({}, { locale })}</option>
          <option value="detached">{m.settings_codex_review_detached({}, { locale })}</option>
        </select>
        <div className="settings-help">
          {m.settings_codex_review_mode_help({}, { locale })}
        </div>
      </div>

      <FileEditorCard
        title={m.settings_codex_global_agents_title({}, { locale })}
        meta={globalAgentsMeta}
        error={globalAgentsError}
        value={globalAgentsContent}
        placeholder={m.settings_codex_global_agents_placeholder({}, { locale })}
        disabled={globalAgentsLoading}
        refreshDisabled={globalAgentsRefreshDisabled}
        saveDisabled={globalAgentsSaveDisabled}
        saveLabel={globalAgentsSaveLabel}
        onChange={onSetGlobalAgentsContent}
        onRefresh={onRefreshGlobalAgents}
        onSave={onSaveGlobalAgents}
        helpText={
          <>
            {m.settings_codex_global_agents_help(
              { path: globalAgentsResolvedPath },
              { locale },
            )}{" "}
            <code>{globalAgentsResolvedPath}</code>.
          </>
        }
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

      <FileEditorCard
        title={m.settings_codex_global_config_title({}, { locale })}
        meta={globalConfigMeta}
        error={globalConfigError}
        value={globalConfigContent}
        placeholder={m.settings_codex_global_config_placeholder({}, { locale })}
        disabled={globalConfigLoading}
        refreshDisabled={globalConfigRefreshDisabled}
        saveDisabled={globalConfigSaveDisabled}
        saveLabel={globalConfigSaveLabel}
        onChange={onSetGlobalConfigContent}
        onRefresh={onRefreshGlobalConfig}
        onSave={onSaveGlobalConfig}
        helpText={
          <>
            {m.settings_codex_global_config_help(
              { path: globalConfigResolvedPath },
              { locale },
            )}{" "}
            <code>{globalConfigResolvedPath}</code>.
          </>
        }
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
