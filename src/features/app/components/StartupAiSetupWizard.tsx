import "../../../styles/startup-ai-setup-wizard.css";
import X from "lucide-react/dist/esm/icons/x";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "@/features/design-system/components/modal/ModalShell";

export function StartupAiSetupWizard({
  selectedProviderName,
  loginRequired,
  loginBusy,
  loginAvailable,
  onSignIn,
  onOpenSettings,
  onDismiss,
}: {
  selectedProviderName: string;
  loginRequired: boolean;
  loginBusy: boolean;
  loginAvailable: boolean;
  onSignIn: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  const locale = useAppLocale();

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
        <div className="startup-ai-setup-status" role="status" aria-live="polite">
          <span className="startup-ai-setup-status-label">
            {m.startup_ai_setup_current_provider_label({}, { locale })}
          </span>
          <strong>{selectedProviderName}</strong>
        </div>

        <div className="startup-ai-setup-actions">
          {loginRequired ? (
            <button
              type="button"
              className="button primary startup-ai-setup-action"
              onClick={onSignIn}
              disabled={loginBusy || !loginAvailable}
            >
              {loginBusy
                ? m.startup_ai_setup_action_signing_in({}, { locale })
                : m.startup_ai_setup_action_sign_in({}, { locale })}
            </button>
          ) : null}
          <button
            type="button"
            className="button secondary startup-ai-setup-action"
            onClick={onOpenSettings}
          >
            {m.startup_ai_setup_action_open_settings({}, { locale })}
          </button>
          <button
            type="button"
            className="ghost startup-ai-setup-skip"
            onClick={onDismiss}
          >
            {m.startup_ai_setup_action_skip({}, { locale })}
          </button>
        </div>

        <div className="startup-ai-setup-hint">
          {loginRequired
            ? m.startup_ai_setup_hint_login({}, { locale })
            : m.startup_ai_setup_hint_provider({}, { locale })}
        </div>
      </div>
    </ModalShell>
  );
}
