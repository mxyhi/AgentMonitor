import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { SettingsSection } from "@/features/design-system/components/settings/SettingsPrimitives";
import type { OpenAppTarget } from "@/types";
import {
  fileManagerName,
  isMacPlatform,
} from "@utils/platformPaths";
import {
  GENERIC_APP_ICON,
  getKnownOpenAppIcon,
} from "@app/utils/openAppIcons";
import type { OpenAppDraft } from "@settings/components/settingsTypes";

type SettingsOpenAppsSectionProps = {
  openAppDrafts: OpenAppDraft[];
  openAppSelectedId: string;
  openAppIconById: Record<string, string>;
  onOpenAppDraftChange: (index: number, updates: Partial<OpenAppDraft>) => void;
  onOpenAppKindChange: (index: number, kind: OpenAppTarget["kind"]) => void;
  onCommitOpenApps: () => void;
  onMoveOpenApp: (index: number, direction: "up" | "down") => void;
  onDeleteOpenApp: (index: number) => void;
  onAddOpenApp: () => void;
  onSelectOpenAppDefault: (id: string) => void;
};

const isOpenAppLabelValid = (label: string) => label.trim().length > 0;

export function SettingsOpenAppsSection({
  openAppDrafts,
  openAppSelectedId,
  openAppIconById,
  onOpenAppDraftChange,
  onOpenAppKindChange,
  onCommitOpenApps,
  onMoveOpenApp,
  onDeleteOpenApp,
  onAddOpenApp,
  onSelectOpenAppDefault,
}: SettingsOpenAppsSectionProps) {
  const locale = useAppLocale();
  return (
    <SettingsSection
      title={m.settings_open_apps_title({}, { locale })}
      subtitle={m.settings_open_apps_subtitle({}, { locale })}
    >
      <div className="settings-open-apps">
        {openAppDrafts.map((target, index) => {
          const iconSrc =
            getKnownOpenAppIcon(target.id) ?? openAppIconById[target.id] ?? GENERIC_APP_ICON;
          const labelValid = isOpenAppLabelValid(target.label);
          const appNameValid = target.kind !== "app" || Boolean(target.appName?.trim());
          const commandValid =
            target.kind !== "command" || Boolean(target.command?.trim());
          const isComplete = labelValid && appNameValid && commandValid;
          const incompleteHint = !labelValid
            ? m.settings_open_apps_label_required({}, { locale })
            : target.kind === "app"
              ? m.settings_open_apps_app_name_required({}, { locale })
              : target.kind === "command"
                ? m.settings_open_apps_command_required({}, { locale })
                : m.settings_open_apps_complete_required_fields({}, { locale });

          return (
            <div
              key={target.id}
              className={`settings-open-app-row${isComplete ? "" : " is-incomplete"}`}
            >
              <div className="settings-open-app-icon-wrap" aria-hidden>
                <img
                  className="settings-open-app-icon"
                  src={iconSrc}
                  alt=""
                  width={18}
                  height={18}
                />
              </div>
              <div className="settings-open-app-fields">
                <label className="settings-open-app-field settings-open-app-field--label">
                  <span className="settings-visually-hidden">
                    {m.settings_open_apps_label_field({}, { locale })}
                  </span>
                  <input
                    className="settings-input settings-input--compact settings-open-app-input settings-open-app-input--label"
                    value={target.label}
                    placeholder={m.settings_open_apps_label_placeholder({}, { locale })}
                    onChange={(event) =>
                      onOpenAppDraftChange(index, {
                        label: event.target.value,
                      })
                    }
                    onBlur={onCommitOpenApps}
                    aria-label={m.settings_open_apps_label_aria(
                      { value: String(index + 1) },
                      { locale },
                    )}
                    data-invalid={!labelValid || undefined}
                  />
                </label>
                <label className="settings-open-app-field settings-open-app-field--type">
                  <span className="settings-visually-hidden">
                    {m.settings_open_apps_type_field({}, { locale })}
                  </span>
                  <select
                    className="settings-select settings-select--compact settings-open-app-kind"
                    value={target.kind}
                    onChange={(event) =>
                      onOpenAppKindChange(index, event.target.value as OpenAppTarget["kind"])
                    }
                    aria-label={m.settings_open_apps_type_aria(
                      { value: String(index + 1) },
                      { locale },
                    )}
                  >
                    <option value="app">{m.settings_open_apps_option_app({}, { locale })}</option>
                    <option value="command">
                      {m.settings_open_apps_option_command({}, { locale })}
                    </option>
                    <option value="finder">{fileManagerName()}</option>
                  </select>
                </label>
                {target.kind === "app" && (
                  <label className="settings-open-app-field settings-open-app-field--appname">
                    <span className="settings-visually-hidden">
                      {m.settings_open_apps_app_name_field({}, { locale })}
                    </span>
                    <input
                      className="settings-input settings-input--compact settings-open-app-input settings-open-app-input--appname"
                      value={target.appName ?? ""}
                      placeholder={m.settings_open_apps_app_name_placeholder({}, { locale })}
                      onChange={(event) =>
                        onOpenAppDraftChange(index, {
                          appName: event.target.value,
                        })
                      }
                      onBlur={onCommitOpenApps}
                      aria-label={m.settings_open_apps_app_name_aria(
                        { value: String(index + 1) },
                        { locale },
                      )}
                      data-invalid={!appNameValid || undefined}
                    />
                  </label>
                )}
                {target.kind === "command" && (
                  <label className="settings-open-app-field settings-open-app-field--command">
                    <span className="settings-visually-hidden">
                      {m.settings_open_apps_command_field({}, { locale })}
                    </span>
                    <input
                      className="settings-input settings-input--compact settings-open-app-input settings-open-app-input--command"
                      value={target.command ?? ""}
                      placeholder={m.settings_open_apps_command_placeholder({}, { locale })}
                      onChange={(event) =>
                        onOpenAppDraftChange(index, {
                          command: event.target.value,
                        })
                      }
                      onBlur={onCommitOpenApps}
                      aria-label={m.settings_open_apps_command_aria(
                        { value: String(index + 1) },
                        { locale },
                      )}
                      data-invalid={!commandValid || undefined}
                    />
                  </label>
                )}
                {target.kind !== "finder" && (
                  <label className="settings-open-app-field settings-open-app-field--args">
                    <span className="settings-visually-hidden">
                      {m.settings_open_apps_args_field({}, { locale })}
                    </span>
                    <input
                      className="settings-input settings-input--compact settings-open-app-input settings-open-app-input--args"
                      value={target.argsText}
                      placeholder={m.settings_open_apps_args_placeholder({}, { locale })}
                      onChange={(event) =>
                        onOpenAppDraftChange(index, {
                          argsText: event.target.value,
                        })
                      }
                      onBlur={onCommitOpenApps}
                      aria-label={m.settings_open_apps_args_aria(
                        { value: String(index + 1) },
                        { locale },
                      )}
                    />
                  </label>
                )}
              </div>
              <div className="settings-open-app-actions">
                {!isComplete && (
                  <span
                    className="settings-open-app-status"
                    title={incompleteHint}
                    aria-label={incompleteHint}
                  >
                    {m.settings_open_apps_incomplete({}, { locale })}
                  </span>
                )}
                <label className="settings-open-app-default">
                  <input
                    type="radio"
                    name="open-app-default"
                    checked={target.id === openAppSelectedId}
                    onChange={() => onSelectOpenAppDefault(target.id)}
                    disabled={!isComplete}
                  />
                  {m.settings_open_apps_default({}, { locale })}
                </label>
                <div className="settings-open-app-order">
                  <button
                    type="button"
                    className="ghost icon-button"
                    onClick={() => onMoveOpenApp(index, "up")}
                    disabled={index === 0}
                    aria-label={m.settings_open_apps_move_up({}, { locale })}
                  >
                    <ChevronUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ghost icon-button"
                    onClick={() => onMoveOpenApp(index, "down")}
                    disabled={index === openAppDrafts.length - 1}
                    aria-label={m.settings_open_apps_move_down({}, { locale })}
                  >
                    <ChevronDown aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost icon-button"
                  onClick={() => onDeleteOpenApp(index)}
                  disabled={openAppDrafts.length <= 1}
                  aria-label={m.action_remove({}, { locale })}
                  title={m.action_remove({}, { locale })}
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="settings-open-app-footer">
        <button type="button" className="ghost" onClick={onAddOpenApp}>
          {m.settings_open_apps_add_app({}, { locale })}
        </button>
        <div className="settings-help">
          {m.settings_open_apps_command_help({}, { locale })}{" "}
          {isMacPlatform()
            ? m.settings_open_apps_app_help_mac({}, { locale })
            : m.settings_open_apps_app_help_other({}, { locale })}
        </div>
      </div>
    </SettingsSection>
  );
}
