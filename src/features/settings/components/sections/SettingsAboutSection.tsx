import { useEffect, useState } from "react";
import type { AppSettings } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  getAppBuildType,
  isMobileRuntime,
  type AppBuildType,
} from "@services/tauri";
import { useUpdater } from "@/features/update/hooks/useUpdater";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";

type SettingsAboutSectionProps = {
  appSettings: AppSettings;
  onToggleAutomaticAppUpdateChecks?: () => void;
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function SettingsAboutSection({
  appSettings,
  onToggleAutomaticAppUpdateChecks,
}: SettingsAboutSectionProps) {
  const locale = useAppLocale();
  const [appBuildType, setAppBuildType] = useState<AppBuildType | "unknown">("unknown");
  const [updaterEnabled, setUpdaterEnabled] = useState(false);
  const { state: updaterState, checkForUpdates, startUpdate } = useUpdater({
    enabled: updaterEnabled,
    autoCheckOnMount: false,
  });

  useEffect(() => {
    let active = true;
    const loadBuildType = async () => {
      try {
        const value = await getAppBuildType();
        if (active) {
          setAppBuildType(value);
        }
      } catch {
        if (active) {
          setAppBuildType("unknown");
        }
      }
    };
    void loadBuildType();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const detectRuntime = async () => {
      try {
        const mobileRuntime = await isMobileRuntime();
        if (active) {
          setUpdaterEnabled(!mobileRuntime);
        }
      } catch {
        if (active) {
          // In non-Tauri previews we still want local desktop-like behavior.
          setUpdaterEnabled(true);
        }
      }
    };
    void detectRuntime();
    return () => {
      active = false;
    };
  }, []);

  const buildDateValue = __APP_BUILD_DATE__.trim();
  const parsedBuildDate = Date.parse(buildDateValue);
  const buildDateLabel = Number.isNaN(parsedBuildDate)
    ? buildDateValue || m.common_unknown({}, { locale })
    : new Date(parsedBuildDate).toLocaleString();

  return (
    <SettingsSection
      title={m.settings_about_title({}, { locale })}
      subtitle={m.settings_about_subtitle({}, { locale })}
    >
      <div className="settings-field">
        <div className="settings-help">
          {m.settings_about_version({ value: __APP_VERSION__ }, { locale })}
        </div>
        <div className="settings-help">
          {m.settings_about_build_type({ value: appBuildType }, { locale })}
        </div>
        <div className="settings-help">
          {m.settings_about_branch(
            { value: __APP_GIT_BRANCH__ || m.common_unknown({}, { locale }) },
            { locale },
          )}
        </div>
        <div className="settings-help">
          {m.settings_about_commit(
            { value: __APP_COMMIT_HASH__ || m.common_unknown({}, { locale }) },
            { locale },
          )}
        </div>
        <div className="settings-help">
          {m.settings_about_build_date({ value: buildDateLabel }, { locale })}
        </div>
      </div>
      <div className="settings-field">
        <div className="settings-label">{m.settings_about_updates_label({}, { locale })}</div>
        <SettingsToggleRow
          title={m.settings_about_auto_check_title({}, { locale })}
          subtitle={m.settings_about_auto_check_subtitle({}, { locale })}
        >
          <SettingsToggleSwitch
            pressed={appSettings.automaticAppUpdateChecksEnabled}
            onClick={() => {
              onToggleAutomaticAppUpdateChecks?.();
            }}
          />
        </SettingsToggleRow>
        <div className="settings-help">
          {m.settings_about_running_version({ value: __APP_VERSION__ }, { locale })}
        </div>
        {!updaterEnabled && (
          <div className="settings-help">
            {m.settings_about_updates_unavailable({}, { locale })}
          </div>
        )}

        {updaterState.stage === "error" && (
          <div className="settings-help ds-text-danger">
            {m.settings_about_update_failed(
              { error: updaterState.error ?? "" },
              { locale },
            )}
          </div>
        )}

        {updaterState.stage === "downloading" ||
        updaterState.stage === "installing" ||
        updaterState.stage === "restarting" ? (
          <div className="settings-help">
            {updaterState.stage === "downloading" ? (
              updaterState.progress?.totalBytes
                ? m.settings_about_downloading_percent(
                    {
                      value: String(
                        Math.round(
                          (updaterState.progress.downloadedBytes /
                            updaterState.progress.totalBytes) *
                            100,
                        ),
                      ),
                    },
                    { locale },
                  )
                : m.settings_about_downloading_bytes(
                    {
                      value: formatBytes(
                        updaterState.progress?.downloadedBytes ?? 0,
                      ),
                    },
                    { locale },
                  )
            ) : updaterState.stage === "installing" ? (
              m.update_installing({}, { locale })
            ) : (
              m.update_restarting({}, { locale })
            )}
          </div>
        ) : updaterState.stage === "available" ? (
          <div className="settings-help">
            {m.settings_about_available_version(
              { value: updaterState.version ?? "" },
              { locale },
            )}
          </div>
        ) : updaterState.stage === "latest" ? (
          <div className="settings-help">{m.settings_about_latest({}, { locale })}</div>
        ) : null}

        <div className="settings-controls">
          {updaterState.stage === "available" ? (
            <button
              type="button"
              className="primary"
              disabled={!updaterEnabled}
              onClick={() => void startUpdate()}
            >
              {m.action_download_install({}, { locale })}
            </button>
          ) : (
            <button
              type="button"
              className="ghost"
              disabled={
                !updaterEnabled ||
                updaterState.stage === "checking" ||
                updaterState.stage === "downloading" ||
                updaterState.stage === "installing" ||
                updaterState.stage === "restarting"
              }
              onClick={() => void checkForUpdates({ announceNoUpdate: true })}
            >
              {updaterState.stage === "checking"
                ? m.update_checking({}, { locale })
                : m.action_check_updates({}, { locale })}
            </button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
