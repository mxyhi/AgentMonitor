import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import X from "lucide-react/dist/esm/icons/x";
import type {
  AppLanguage,
  AppSettings,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "@/features/design-system/components/modal/ModalShell";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";

type AddRemoteBackendDraft = {
  name: string;
  host: string;
  token: string;
};

const getTcpRunnerStatusText = (
  tcpDaemonStatus: TcpDaemonStatus | null,
  locale: AppLanguage,
) => {
  if (!tcpDaemonStatus) {
    return null;
  }
  const listenAddr =
    tcpDaemonStatus.listenAddr ??
    m.settings_server_configured_listen_address({}, { locale });
  if (tcpDaemonStatus.state === "running") {
    return tcpDaemonStatus.pid
      ? m.settings_server_tcp_daemon_running_with_pid(
          { pid: String(tcpDaemonStatus.pid), address: listenAddr },
          { locale },
        )
      : m.settings_server_tcp_daemon_running({ address: listenAddr }, { locale });
  }
  if (tcpDaemonStatus.state === "error") {
    return (
      tcpDaemonStatus.lastError ?? m.settings_server_tcp_daemon_error({}, { locale })
    );
  }
  return m.settings_server_tcp_daemon_stopped({ address: listenAddr }, { locale });
};

type SettingsServerSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  isMobilePlatform: boolean;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  remoteBackends: AppSettings["remoteBackends"];
  activeRemoteBackendId: string | null;
  remoteStatusText: string | null;
  remoteStatusError: boolean;
  remoteNameError: string | null;
  remoteHostError: string | null;
  remoteNameDraft: string;
  remoteHostDraft: string;
  remoteTokenDraft: string;
  nextRemoteNameSuggestion: string;
  tailscaleStatus: TailscaleStatus | null;
  tailscaleStatusBusy: boolean;
  tailscaleStatusError: string | null;
  tailscaleCommandPreview: TailscaleDaemonCommandPreview | null;
  tailscaleCommandBusy: boolean;
  tailscaleCommandError: string | null;
  tcpDaemonStatus: TcpDaemonStatus | null;
  tcpDaemonBusyAction: "start" | "stop" | "status" | null;
  onSetRemoteNameDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteHostDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteName: () => Promise<void>;
  onCommitRemoteHost: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onSelectRemoteBackend: (id: string) => Promise<void>;
  onAddRemoteBackend: (draft: AddRemoteBackendDraft) => Promise<void>;
  onMoveRemoteBackend: (id: string, direction: "up" | "down") => Promise<void>;
  onDeleteRemoteBackend: (id: string) => Promise<void>;
  onRefreshTailscaleStatus: () => void;
  onRefreshTailscaleCommandPreview: () => void;
  onUseSuggestedTailscaleHost: () => Promise<void>;
  onTcpDaemonStart: () => Promise<void>;
  onTcpDaemonStop: () => Promise<void>;
  onTcpDaemonStatus: () => Promise<void>;
  onMobileConnectTest: () => void;
};

export function SettingsServerSection({
  appSettings,
  onUpdateAppSettings,
  isMobilePlatform,
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
  remoteBackends,
  activeRemoteBackendId,
  remoteStatusText,
  remoteStatusError,
  remoteNameError,
  remoteHostError,
  remoteNameDraft,
  remoteHostDraft,
  remoteTokenDraft,
  nextRemoteNameSuggestion,
  tailscaleStatus,
  tailscaleStatusBusy,
  tailscaleStatusError,
  tailscaleCommandPreview,
  tailscaleCommandBusy,
  tailscaleCommandError,
  tcpDaemonStatus,
  tcpDaemonBusyAction,
  onSetRemoteNameDraft,
  onSetRemoteHostDraft,
  onSetRemoteTokenDraft,
  onCommitRemoteName,
  onCommitRemoteHost,
  onCommitRemoteToken,
  onSelectRemoteBackend,
  onAddRemoteBackend,
  onMoveRemoteBackend,
  onDeleteRemoteBackend,
  onRefreshTailscaleStatus,
  onRefreshTailscaleCommandPreview,
  onUseSuggestedTailscaleHost,
  onTcpDaemonStart,
  onTcpDaemonStop,
  onTcpDaemonStatus,
  onMobileConnectTest,
}: SettingsServerSectionProps) {
  const locale = useAppLocale();
  const [pendingDeleteRemoteId, setPendingDeleteRemoteId] = useState<string | null>(
    null,
  );
  const [addRemoteOpen, setAddRemoteOpen] = useState(false);
  const [addRemoteBusy, setAddRemoteBusy] = useState(false);
  const [addRemoteError, setAddRemoteError] = useState<string | null>(null);
  const [addRemoteNameDraft, setAddRemoteNameDraft] = useState("");
  const [addRemoteHostDraft, setAddRemoteHostDraft] = useState("");
  const [addRemoteTokenDraft, setAddRemoteTokenDraft] = useState("");
  const isMobileSimplified = isMobilePlatform;
  const pendingDeleteRemote = useMemo(
    () =>
      pendingDeleteRemoteId == null
        ? null
        : remoteBackends.find((entry) => entry.id === pendingDeleteRemoteId) ?? null,
    [pendingDeleteRemoteId, remoteBackends],
  );
  const tcpRunnerStatusText = getTcpRunnerStatusText(tcpDaemonStatus, locale);

  const openAddRemoteModal = () => {
    setAddRemoteError(null);
    setAddRemoteNameDraft(nextRemoteNameSuggestion);
    setAddRemoteHostDraft(remoteHostDraft);
    setAddRemoteTokenDraft("");
    setAddRemoteOpen(true);
  };

  const closeAddRemoteModal = () => {
    if (addRemoteBusy) {
      return;
    }
    setAddRemoteOpen(false);
    setAddRemoteError(null);
  };

  const handleAddRemoteConfirm = () => {
    void (async () => {
      if (addRemoteBusy) {
        return;
      }
      setAddRemoteBusy(true);
      setAddRemoteError(null);
      try {
        await onAddRemoteBackend({
          name: addRemoteNameDraft,
          host: addRemoteHostDraft,
          token: addRemoteTokenDraft,
        });
        setAddRemoteOpen(false);
      } catch (error) {
        setAddRemoteError(
          error instanceof Error
            ? error.message
            : m.settings_server_add_remote_error({}, { locale }),
        );
      } finally {
        setAddRemoteBusy(false);
      }
    })();
  };

  return (
    <SettingsSection
      title={m.settings_nav_server({}, { locale })}
      subtitle={
        isMobileSimplified
          ? m.settings_server_subtitle_mobile({}, { locale })
          : m.settings_server_subtitle_desktop({}, { locale })
      }
    >

      {!isMobileSimplified && (
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="backend-mode">
            {m.settings_server_backend_mode_label({}, { locale })}
          </label>
          <select
            id="backend-mode"
            className="settings-select"
            value={appSettings.backendMode}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                backendMode: event.target.value as AppSettings["backendMode"],
              })
            }
          >
            <option value="local">{m.settings_server_backend_mode_local({}, { locale })}</option>
            <option value="remote">{m.settings_server_backend_mode_remote({}, { locale })}</option>
          </select>
          <div className="settings-help">
            {m.settings_server_backend_mode_help({}, { locale })}
          </div>
        </div>
      )}

      <>
        {isMobileSimplified && (
          <>
            <div className="settings-field">
              <div className="settings-field-label">
                {m.settings_server_saved_remotes({}, { locale })}
              </div>
              <div
                className="settings-mobile-remotes"
                role="list"
                aria-label={m.settings_server_saved_remotes({}, { locale })}
              >
                {remoteBackends.map((entry, index) => {
                  const isActive = entry.id === activeRemoteBackendId;
                  return (
                    <div
                      className={`settings-mobile-remote${isActive ? " is-active" : ""}`}
                      role="listitem"
                      key={entry.id}
                    >
                      <div className="settings-mobile-remote-main">
                        <div className="settings-mobile-remote-name-row">
                          <div className="settings-mobile-remote-name">{entry.name}</div>
                          {isActive && (
                            <span className="settings-mobile-remote-badge">
                              {m.settings_server_active({}, { locale })}
                            </span>
                          )}
                        </div>
                        <div className="settings-mobile-remote-meta">TCP · {entry.host}</div>
                        <div className="settings-mobile-remote-last">
                          {m.settings_server_last_connected({}, { locale })}:{" "}
                          {typeof entry.lastConnectedAtMs === "number"
                            ? new Date(entry.lastConnectedAtMs).toLocaleString(locale)
                            : m.settings_server_never({}, { locale })}
                        </div>
                      </div>
                      <div className="settings-mobile-remote-actions">
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onSelectRemoteBackend(entry.id);
                          }}
                          disabled={isActive}
                          aria-label={m.settings_server_use_remote_aria(
                            { name: entry.name },
                            { locale },
                          )}
                        >
                          {isActive
                            ? m.settings_server_using({}, { locale })
                            : m.settings_server_use_remote({}, { locale })}
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onMoveRemoteBackend(entry.id, "up");
                          }}
                          disabled={index === 0}
                          aria-label={m.settings_server_move_remote_up_aria(
                            { name: entry.name },
                            { locale },
                          )}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onMoveRemoteBackend(entry.id, "down");
                          }}
                          disabled={index === remoteBackends.length - 1}
                          aria-label={m.settings_server_move_remote_down_aria(
                            { name: entry.name },
                            { locale },
                          )}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action settings-mobile-remote-action-danger"
                          onClick={() => {
                            setPendingDeleteRemoteId(entry.id);
                          }}
                          aria-label={m.settings_server_delete_remote_aria(
                            { name: entry.name },
                            { locale },
                          )}
                        >
                          {m.action_delete({}, { locale })}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="settings-field-row">
                <button
                  type="button"
                  className="button settings-button-compact"
                  onClick={openAddRemoteModal}
                >
                  {m.settings_server_add_remote({}, { locale })}
                </button>
              </div>
              {remoteStatusText && (
                <div className={`settings-help${remoteStatusError ? " settings-help-error" : ""}`}>
                  {remoteStatusText}
                </div>
              )}
              <div className="settings-help">
                {m.settings_server_saved_remotes_help({}, { locale })}
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-field-label" htmlFor="mobile-remote-name">
                {m.settings_server_remote_name_label({}, { locale })}
              </label>
              <input
                id="mobile-remote-name"
                className="settings-input settings-input--compact"
                value={remoteNameDraft}
                placeholder={m.settings_server_remote_name_placeholder({}, { locale })}
                onChange={(event) => onSetRemoteNameDraft(event.target.value)}
                onBlur={() => {
                  void onCommitRemoteName();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCommitRemoteName();
                  }
                }}
              />
              {remoteNameError && <div className="settings-help settings-help-error">{remoteNameError}</div>}
            </div>
          </>
        )}

        {!isMobileSimplified && (
          <SettingsToggleRow
            title={m.settings_server_keep_daemon_running_title({}, { locale })}
            subtitle={m.settings_server_keep_daemon_running_subtitle({}, { locale })}
          >
            <SettingsToggleSwitch
              pressed={appSettings.keepDaemonRunningAfterAppClose}
              onClick={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  keepDaemonRunningAfterAppClose: !appSettings.keepDaemonRunningAfterAppClose,
                })
              }
            />
          </SettingsToggleRow>
        )}

          <div className="settings-field">
            <div className="settings-field-label">
              {m.settings_server_remote_backend({}, { locale })}
            </div>
          <div className="settings-field-row">
            <input
              className="settings-input settings-input--compact"
              value={remoteHostDraft}
              placeholder="127.0.0.1:4732"
              onChange={(event) => onSetRemoteHostDraft(event.target.value)}
              onBlur={() => {
                void onCommitRemoteHost();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onCommitRemoteHost();
                }
              }}
              aria-label={m.settings_server_remote_backend_host({}, { locale })}
            />
            <input
              type="password"
              className="settings-input settings-input--compact"
              value={remoteTokenDraft}
              placeholder={m.settings_server_token_required({}, { locale })}
              onChange={(event) => onSetRemoteTokenDraft(event.target.value)}
              onBlur={() => {
                void onCommitRemoteToken();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onCommitRemoteToken();
                }
              }}
              aria-label={m.settings_server_remote_backend_token({}, { locale })}
            />
          </div>
          {remoteHostError && <div className="settings-help settings-help-error">{remoteHostError}</div>}
          <div className="settings-help">
            {isMobileSimplified
              ? m.settings_server_remote_backend_help_mobile({}, { locale })
              : m.settings_server_remote_backend_help_desktop({}, { locale })}
          </div>
        </div>

        {isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">
              {m.settings_server_connection_test({}, { locale })}
            </div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onMobileConnectTest}
                disabled={mobileConnectBusy}
              >
                {mobileConnectBusy
                  ? m.settings_server_connecting({}, { locale })
                  : m.settings_server_connect_and_test({}, { locale })}
              </button>
            </div>
            {mobileConnectStatusText && (
              <div className={`settings-help${mobileConnectStatusError ? " settings-help-error" : ""}`}>
                {mobileConnectStatusText}
              </div>
            )}
            <div className="settings-help">
              {m.settings_server_connection_test_help({}, { locale })}
            </div>
          </div>
        )}

        {!isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">
              {m.settings_server_mobile_access_daemon({}, { locale })}
            </div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStart();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "start"
                  ? m.settings_server_starting_daemon({}, { locale })
                  : m.settings_server_start_daemon({}, { locale })}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStop();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "stop"
                  ? m.settings_server_stopping_daemon({}, { locale })
                  : m.settings_server_stop_daemon({}, { locale })}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStatus();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "status"
                  ? m.settings_server_refreshing_status({}, { locale })
                  : m.settings_server_refresh_status({}, { locale })}
              </button>
            </div>
            {tcpRunnerStatusText && <div className="settings-help">{tcpRunnerStatusText}</div>}
            {tcpDaemonStatus?.startedAtMs && (
              <div className="settings-help">
                {m.settings_server_started_at({}, { locale })}:{" "}
                {new Date(tcpDaemonStatus.startedAtMs).toLocaleString(locale)}
              </div>
            )}
            <div className="settings-help">
              {m.settings_server_mobile_daemon_help({}, { locale })}
            </div>
          </div>
        )}

        {!isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">
              {m.settings_server_tailscale_helper({}, { locale })}
            </div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onRefreshTailscaleStatus}
                disabled={tailscaleStatusBusy}
              >
                {tailscaleStatusBusy
                  ? m.settings_server_checking_tailscale({}, { locale })
                  : m.settings_server_detect_tailscale({}, { locale })}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onRefreshTailscaleCommandPreview}
                disabled={tailscaleCommandBusy}
              >
                {tailscaleCommandBusy
                  ? m.settings_server_refreshing_daemon_command({}, { locale })
                  : m.settings_server_refresh_daemon_command({}, { locale })}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                disabled={!tailscaleStatus?.suggestedRemoteHost}
                onClick={() => {
                  void onUseSuggestedTailscaleHost();
                }}
              >
                {m.settings_server_use_suggested_host({}, { locale })}
              </button>
            </div>
            {tailscaleStatusError && (
              <div className="settings-help settings-help-error">{tailscaleStatusError}</div>
            )}
            {tailscaleStatus && (
              <>
                <div className="settings-help">{tailscaleStatus.message}</div>
                <div className="settings-help">
                  {tailscaleStatus.installed
                    ? `${m.settings_server_tailscale_version({}, { locale })}: ${
                        tailscaleStatus.version ?? m.settings_codex_unknown({}, { locale })
                      }`
                    : m.settings_server_tailscale_install_help({}, { locale })}
                </div>
                {tailscaleStatus.suggestedRemoteHost && (
                  <div className="settings-help">
                    {m.settings_server_suggested_remote_host({}, { locale })}:{" "}
                    <code>{tailscaleStatus.suggestedRemoteHost}</code>
                  </div>
                )}
                {tailscaleStatus.tailnetName && (
                  <div className="settings-help">
                    {m.settings_server_tailnet({}, { locale })}:{" "}
                    <code>{tailscaleStatus.tailnetName}</code>
                  </div>
                )}
              </>
            )}
            {tailscaleCommandError && (
              <div className="settings-help settings-help-error">{tailscaleCommandError}</div>
            )}
            {tailscaleCommandPreview && (
              <>
                <div className="settings-help">
                  {m.settings_server_tailscale_command_template({}, { locale })}
                </div>
                <pre className="settings-command-preview">
                  <code>{tailscaleCommandPreview.command}</code>
                </pre>
                {!tailscaleCommandPreview.tokenConfigured && (
                  <div className="settings-help settings-help-error">
                    {m.settings_server_token_empty_help({}, { locale })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </>

      <div className="settings-help">
        {isMobileSimplified
          ? m.settings_server_scope_help_mobile({}, { locale })
          : m.settings_server_scope_help_desktop({}, { locale })}
      </div>
      {addRemoteOpen && (
        <ModalShell
          className="settings-add-remote-overlay"
          cardClassName="settings-add-remote-card"
          onBackdropClick={closeAddRemoteModal}
          ariaLabel={m.settings_server_add_remote({}, { locale })}
        >
          <div className="settings-add-remote-header">
            <div className="settings-add-remote-title">
              {m.settings_server_add_remote({}, { locale })}
            </div>
            <button
              type="button"
              className="ghost icon-button settings-add-remote-close"
              onClick={closeAddRemoteModal}
              aria-label={m.settings_server_close_add_remote_modal({}, { locale })}
              disabled={addRemoteBusy}
            >
              <X aria-hidden />
            </button>
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-name">
              {m.settings_server_add_remote_name_label({}, { locale })}
            </label>
            <input
              id="settings-add-remote-name"
              className="settings-input settings-input--compact"
              value={addRemoteNameDraft}
              onChange={(event) => setAddRemoteNameDraft(event.target.value)}
              disabled={addRemoteBusy}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-host">
              {m.settings_server_add_remote_host_label({}, { locale })}
            </label>
            <input
              id="settings-add-remote-host"
              className="settings-input settings-input--compact"
              value={addRemoteHostDraft}
              placeholder={m.mobile_setup_host_placeholder({}, { locale })}
              onChange={(event) => setAddRemoteHostDraft(event.target.value)}
              disabled={addRemoteBusy}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-token">
              {m.settings_server_add_remote_token_label({}, { locale })}
            </label>
            <input
              id="settings-add-remote-token"
              type="password"
              className="settings-input settings-input--compact"
              value={addRemoteTokenDraft}
              placeholder={m.mobile_setup_token_placeholder({}, { locale })}
              onChange={(event) => setAddRemoteTokenDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddRemoteConfirm();
                }
              }}
              disabled={addRemoteBusy}
            />
          </div>
          {addRemoteError && <div className="settings-help settings-help-error">{addRemoteError}</div>}
          <div className="settings-add-remote-actions">
            <button type="button" className="ghost" onClick={closeAddRemoteModal} disabled={addRemoteBusy}>
              {m.action_cancel({}, { locale })}
            </button>
            <button
              type="button"
              className="button"
              onClick={handleAddRemoteConfirm}
              disabled={addRemoteBusy}
            >
              {addRemoteBusy
                ? m.settings_server_connecting({}, { locale })
                : m.settings_server_connect_and_add({}, { locale })}
            </button>
          </div>
        </ModalShell>
      )}
      {pendingDeleteRemote && (
        <ModalShell
          className="settings-delete-remote-overlay"
          cardClassName="settings-delete-remote-card"
          onBackdropClick={() => setPendingDeleteRemoteId(null)}
          ariaLabel={m.settings_server_delete_remote_confirmation({}, { locale })}
        >
          <div className="settings-delete-remote-title">
            {m.settings_server_delete_remote_confirm({}, { locale })}
          </div>
          <div className="settings-delete-remote-message">
            {m.settings_server_delete_remote_message(
              { name: pendingDeleteRemote.name },
              { locale },
            )}
          </div>
          <div className="settings-delete-remote-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setPendingDeleteRemoteId(null)}
            >
              {m.action_cancel({}, { locale })}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                void onDeleteRemoteBackend(pendingDeleteRemote.id);
                setPendingDeleteRemoteId(null);
              }}
            >
              {m.settings_server_delete_remote_action({}, { locale })}
            </button>
          </div>
        </ModalShell>
      )}
    </SettingsSection>
  );
}
