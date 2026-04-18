import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import "../../../styles/startup-ai-setup-wizard.css";
import X from "lucide-react/dist/esm/icons/x";
import type { AppLanguage, GlobalAiProviderEntry } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "@/features/design-system/components/modal/ModalShell";
import {
  getDefaultGlobalAiProviderBaseUrl,
  isGlobalAiProviderApiKeyOptional,
  normalizeGlobalAiProviderId,
} from "@/utils/globalAiProvider";

const AIROUTER_BUY_URL = "https://airouter.mxyhi.com";

type StartupAiSetupWizardProps = {
  providers: GlobalAiProviderEntry[];
  appLanguage: AppLanguage;
  selectedProviderId: string;
  selectedProviderName: string;
  configuredBaseUrl: string | null;
  apiKeyConfigured: boolean;
  loginRequired: boolean;
  loginBusy: boolean;
  loginAvailable: boolean;
  settingsBusy: boolean;
  settingsError: string | null;
  onSignIn: () => void;
  onSaveSettings: (input: {
    providerId: string;
    baseUrl: string | null;
    apiKey: string | null;
  }) => Promise<boolean>;
  onUpdateAppLanguage: (next: AppLanguage) => Promise<void> | void;
  onDismiss: () => void;
};

export function StartupAiSetupWizard({
  providers,
  appLanguage,
  selectedProviderId,
  configuredBaseUrl,
  loginRequired,
  loginBusy,
  loginAvailable,
  settingsBusy,
  settingsError,
  onSignIn,
  onSaveSettings,
  onUpdateAppLanguage,
  onDismiss,
}: StartupAiSetupWizardProps) {
  const locale = useAppLocale();
  const [mode, setMode] = useState<"summary" | "configure">("summary");
  const [providerDraft, setProviderDraft] = useState(
    normalizeGlobalAiProviderId(selectedProviderId),
  );
  const [baseUrlDraft, setBaseUrlDraft] = useState(
    configuredBaseUrl?.trim() ||
      getDefaultGlobalAiProviderBaseUrl(normalizeGlobalAiProviderId(selectedProviderId)),
  );
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const selectedDraftProvider =
    providers.find((provider) => provider.id === providerDraft) ?? providers[0];
  const providerApiKeyOptional = isGlobalAiProviderApiKeyOptional(providerDraft);

  useEffect(() => {
    const normalizedProviderId = normalizeGlobalAiProviderId(selectedProviderId);
    setProviderDraft(normalizedProviderId);
    setBaseUrlDraft(
      configuredBaseUrl?.trim() ||
        getDefaultGlobalAiProviderBaseUrl(normalizedProviderId),
    );
    setApiKeyDraft("");
  }, [configuredBaseUrl, selectedProviderId]);

  return (
    <ModalShell
      className="startup-ai-setup-overlay"
      cardClassName="startup-ai-setup-card"
      onBackdropClick={onDismiss}
      ariaLabel={m.startup_ai_setup_aria({}, { locale })}
    >
      <div className="startup-ai-setup-header">
        <button
          type="button"
          className="ghost icon-button startup-ai-setup-close"
          onClick={onDismiss}
          aria-label={m.startup_ai_setup_close({}, { locale })}
        >
          <X aria-hidden />
        </button>
        <div className="startup-ai-setup-kicker">
          {m.startup_ai_setup_kicker({}, { locale })}
        </div>
        <h2 className="startup-ai-setup-title">
          {m.startup_ai_setup_title({}, { locale })}
        </h2>
        <p className="startup-ai-setup-subtitle">
          {m.startup_ai_setup_subtitle({}, { locale })}
        </p>
      </div>

      <div className="startup-ai-setup-body">
        <div className="startup-ai-setup-form">
          <label className="startup-ai-setup-field-label" htmlFor="startup-ai-language">
            {m.display_language_label({}, { locale })}
          </label>
          <select
            id="startup-ai-language"
            className="settings-select startup-ai-setup-input"
            value={appLanguage}
            onChange={(event) => {
              const nextLanguage = event.target.value;
              if (nextLanguage === "en" || nextLanguage === "zh-CN") {
                void onUpdateAppLanguage(nextLanguage);
              }
            }}
          >
            <option value="en">{m.display_language_option_en({}, { locale })}</option>
            <option value="zh-CN">{m.display_language_option_zh_cn({}, { locale })}</option>
          </select>
        </div>
        {mode === "summary" ? (
          <>
            <div className="startup-ai-setup-actions">
              <button
                type="button"
                className="button primary startup-ai-setup-action"
                onClick={() => setMode("configure")}
              >
                {m.startup_ai_setup_action_configure_api_key({}, { locale })}
              </button>
              <button
                type="button"
                className="button secondary startup-ai-setup-action"
                onClick={onSignIn}
                disabled={loginBusy || !loginAvailable}
              >
                {loginBusy
                  ? m.startup_ai_setup_action_signing_in({}, { locale })
                  : m.startup_ai_setup_action_sign_in({}, { locale })}
              </button>
              <a
                className="startup-ai-setup-link"
                href={AIROUTER_BUY_URL}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  void openUrl(AIROUTER_BUY_URL);
                }}
              >
                {m.startup_ai_setup_action_buy_api_key({}, { locale })}
              </a>
            </div>

            <div className="startup-ai-setup-hint">
              {loginRequired
                ? m.startup_ai_setup_hint_login({}, { locale })
                : m.startup_ai_setup_hint_provider({}, { locale })}
            </div>
          </>
        ) : (
          <div className="startup-ai-setup-form">
            <label className="startup-ai-setup-field-label" htmlFor="startup-ai-provider">
              {m.settings_codex_provider_label({}, { locale })}
            </label>
            <select
              id="startup-ai-provider"
              className="settings-select startup-ai-setup-input"
              value={providerDraft}
              onChange={(event) => {
                const nextProviderId = normalizeGlobalAiProviderId(event.target.value);
                const nextProvider =
                  providers.find((provider) => provider.id === nextProviderId) ?? providers[0];
                setProviderDraft(nextProviderId);
                setBaseUrlDraft(
                  nextProvider?.baseUrl?.trim() ||
                    getDefaultGlobalAiProviderBaseUrl(nextProviderId),
                );
                setApiKeyDraft(nextProvider?.apiKey?.trim() || "");
              }}
              aria-label={m.settings_codex_provider_aria({}, { locale })}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <label className="startup-ai-setup-field-label" htmlFor="startup-ai-base-url">
              {m.startup_ai_setup_form_base_url_label({}, { locale })}
            </label>
            <input
              id="startup-ai-base-url"
              className="settings-input startup-ai-setup-input"
              value={baseUrlDraft}
              onChange={(event) => setBaseUrlDraft(event.target.value)}
              aria-label={m.startup_ai_setup_form_base_url_label({}, { locale })}
            />
            <label className="startup-ai-setup-field-label" htmlFor="startup-ai-api-key">
              <span>{m.startup_ai_setup_form_api_key_label({}, { locale })}</span>
              {providerDraft === "airouter" ? (
                <a
                  className="startup-ai-setup-inline-link"
                  href={AIROUTER_BUY_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault();
                    void openUrl(AIROUTER_BUY_URL);
                  }}
                >
                  {m.startup_ai_setup_action_buy_api_key({}, { locale })}
                </a>
              ) : null}
            </label>
            <input
              id="startup-ai-api-key"
              className="settings-input startup-ai-setup-input"
              type="password"
              autoComplete="off"
              placeholder={
                providerApiKeyOptional
                  ? m.ai_provider_api_key_optional_placeholder({}, { locale })
                  : undefined
              }
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              aria-label={m.startup_ai_setup_form_api_key_label({}, { locale })}
            />
            {providerApiKeyOptional ? (
              <div className="startup-ai-setup-hint">
                {m.ai_provider_api_key_optional_hint({}, { locale })}
              </div>
            ) : null}
            {settingsError ? (
              <div className="startup-ai-setup-error">{settingsError}</div>
            ) : null}
            <div className="startup-ai-setup-actions">
              <button
                type="button"
                className="button primary startup-ai-setup-action"
                disabled={settingsBusy}
                onClick={() => {
                  void onSaveSettings({
                    providerId: selectedDraftProvider?.id ?? providerDraft,
                    baseUrl: baseUrlDraft.trim() || null,
                    apiKey: apiKeyDraft.trim() || null,
                  });
                }}
              >
                {settingsBusy
                  ? m.action_saving({}, { locale })
                  : m.startup_ai_setup_action_save_configuration({}, { locale })}
              </button>
              <button
                type="button"
                className="ghost startup-ai-setup-skip"
                disabled={settingsBusy}
                onClick={() => setMode("summary")}
              >
                {m.startup_ai_setup_action_back({}, { locale })}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
