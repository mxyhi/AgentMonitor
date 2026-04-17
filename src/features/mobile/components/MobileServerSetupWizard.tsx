import "../../../styles/mobile-setup-wizard.css";
import X from "lucide-react/dist/esm/icons/x";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";
import { ModalShell } from "../../design-system/components/modal/ModalShell";

export type MobileServerSetupWizardProps = {
  remoteHostDraft: string;
  remoteTokenDraft: string;
  busy: boolean;
  checking: boolean;
  statusMessage: string | null;
  statusError: boolean;
  onClose: () => void;
  onRemoteHostChange: (value: string) => void;
  onRemoteTokenChange: (value: string) => void;
  onConnectTest: () => void;
};

export function MobileServerSetupWizard({
  remoteHostDraft,
  remoteTokenDraft,
  busy,
  checking,
  statusMessage,
  statusError,
  onClose,
  onRemoteHostChange,
  onRemoteTokenChange,
  onConnectTest,
}: MobileServerSetupWizardProps) {
  const locale = useAppLocale();

  return (
    <ModalShell
      className="mobile-setup-wizard-overlay"
      cardClassName="mobile-setup-wizard-card"
      onBackdropClick={onClose}
      ariaLabel={m.mobile_setup_aria({}, { locale })}
    >
      <div className="mobile-setup-wizard-header">
        <button
          type="button"
          className="ghost icon-button mobile-setup-wizard-close"
          onClick={onClose}
          aria-label={m.mobile_setup_close({}, { locale })}
        >
          <X aria-hidden />
        </button>
        <div className="mobile-setup-wizard-kicker">
          {m.mobile_setup_kicker({}, { locale })}
        </div>
        <h2 className="mobile-setup-wizard-title">
          {m.mobile_setup_title({}, { locale })}
        </h2>
        <p className="mobile-setup-wizard-subtitle">
          {m.mobile_setup_subtitle({}, { locale })}
        </p>
      </div>

      <div className="mobile-setup-wizard-body">
        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-host">
          {m.mobile_setup_host_label({}, { locale })}
        </label>
        <input
          id="mobile-setup-host"
          className="mobile-setup-wizard-input"
          value={remoteHostDraft}
          placeholder={m.mobile_setup_host_placeholder({}, { locale })}
          onChange={(event) => onRemoteHostChange(event.target.value)}
          disabled={busy || checking}
        />

        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-token">
          {m.mobile_setup_token_label({}, { locale })}
        </label>
        <input
          id="mobile-setup-token"
          type="password"
          className="mobile-setup-wizard-input"
          value={remoteTokenDraft}
          placeholder={m.mobile_setup_token_placeholder({}, { locale })}
          onChange={(event) => onRemoteTokenChange(event.target.value)}
          disabled={busy || checking}
        />

        <button
          type="button"
          className="button primary mobile-setup-wizard-action"
          onClick={onConnectTest}
          disabled={busy || checking}
        >
          {checking
            ? m.mobile_setup_checking({}, { locale })
            : busy
              ? m.mobile_setup_connecting({}, { locale })
              : m.mobile_setup_connect_test({}, { locale })}
        </button>

        {statusMessage ? (
          <div
            className={`mobile-setup-wizard-status${
              statusError ? " mobile-setup-wizard-status-error" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="mobile-setup-wizard-hint">
          {m.mobile_setup_hint({}, { locale })}
        </div>
      </div>
    </ModalShell>
  );
}
