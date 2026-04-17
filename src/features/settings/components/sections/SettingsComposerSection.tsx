import type { AppSettings } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";

type ComposerPreset = AppSettings["composerEditorPreset"];

type SettingsComposerSectionProps = {
  appSettings: AppSettings;
  optionKeyLabel: string;
  followUpShortcutLabel: string;
  composerPresetLabels: Record<ComposerPreset, string>;
  onComposerPresetChange: (preset: ComposerPreset) => void;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function SettingsComposerSection({
  appSettings,
  optionKeyLabel,
  followUpShortcutLabel,
  composerPresetLabels,
  onComposerPresetChange,
  onUpdateAppSettings,
}: SettingsComposerSectionProps) {
  const locale = useAppLocale();
  const steerUnavailable = !appSettings.steerEnabled;
  return (
    <SettingsSection
      title={m.composer_title({}, { locale })}
      subtitle={m.composer_subtitle({}, { locale })}
    >
      <div className="settings-field">
        <div className="settings-field-label">
          {m.composer_followup_behavior_label({}, { locale })}
        </div>
        <div
          className={`settings-segmented${appSettings.followUpMessageBehavior === "steer" ? " is-second-active" : ""}`}
          aria-label={m.composer_followup_behavior_aria({}, { locale })}
        >
          <label
            className={`settings-segmented-option${
              appSettings.followUpMessageBehavior === "queue" ? " is-active" : ""
            }`}
          >
            <input
              className="settings-segmented-input"
              type="radio"
              name="follow-up-behavior"
              value="queue"
              checked={appSettings.followUpMessageBehavior === "queue"}
              onChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  followUpMessageBehavior: "queue",
                })
              }
            />
            <span className="settings-segmented-option-label">
              {m.composer_followup_option_queue({}, { locale })}
            </span>
          </label>
          <label
            className={`settings-segmented-option${
              appSettings.followUpMessageBehavior === "steer" ? " is-active" : ""
            }${steerUnavailable ? " is-disabled" : ""}`}
            title={
              steerUnavailable
                ? m.composer_followup_steer_unavailable_title({}, { locale })
                : ""
            }
          >
            <input
              className="settings-segmented-input"
              type="radio"
              name="follow-up-behavior"
              value="steer"
              checked={appSettings.followUpMessageBehavior === "steer"}
              disabled={steerUnavailable}
              onChange={() => {
                if (steerUnavailable) {
                  return;
                }
                void onUpdateAppSettings({
                  ...appSettings,
                  followUpMessageBehavior: "steer",
                });
              }}
            />
            <span className="settings-segmented-option-label">
              {m.composer_followup_option_steer({}, { locale })}
            </span>
          </label>
        </div>
        <div className="settings-help">
          {m.composer_followup_help({ shortcut: followUpShortcutLabel }, { locale })}
        </div>
        <SettingsToggleRow
          title={m.composer_followup_hint_title({}, { locale })}
          subtitle={m.composer_followup_hint_subtitle({}, { locale })}
        >
          <SettingsToggleSwitch
            pressed={appSettings.composerFollowUpHintEnabled}
            onClick={() =>
              void onUpdateAppSettings({
                ...appSettings,
                composerFollowUpHintEnabled: !appSettings.composerFollowUpHintEnabled,
              })
            }
          />
        </SettingsToggleRow>
        {steerUnavailable && (
          <div className="settings-help">
            {m.composer_followup_unavailable_help({}, { locale })}
          </div>
        )}
      </div>
      <div className="settings-divider" />
      <div className="settings-subsection-title">
        {m.composer_subsection_presets({}, { locale })}
      </div>
      <div className="settings-subsection-subtitle">
        {m.composer_subsection_presets_subtitle({}, { locale })}
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="composer-preset">
          {m.composer_preset_label({}, { locale })}
        </label>
        <select
          id="composer-preset"
          className="settings-select"
          value={appSettings.composerEditorPreset}
          onChange={(event) =>
            onComposerPresetChange(event.target.value as ComposerPreset)
          }
        >
          {Object.entries(composerPresetLabels).map(([preset, label]) => (
            <option key={preset} value={preset}>
              {label}
            </option>
          ))}
        </select>
        <div className="settings-help">
          {m.composer_preset_help({}, { locale })}
        </div>
      </div>
      <div className="settings-divider" />
      <div className="settings-subsection-title">
        {m.composer_subsection_code_fences({}, { locale })}
      </div>
      <SettingsToggleRow
        title={m.composer_expand_space_title({}, { locale })}
        subtitle={m.composer_expand_space_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceExpandOnSpace}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceExpandOnSpace: !appSettings.composerFenceExpandOnSpace,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.composer_expand_enter_title({}, { locale })}
        subtitle={m.composer_expand_enter_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceExpandOnEnter}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceExpandOnEnter: !appSettings.composerFenceExpandOnEnter,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.composer_language_tags_title({}, { locale })}
        subtitle={m.composer_language_tags_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceLanguageTags}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceLanguageTags: !appSettings.composerFenceLanguageTags,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.composer_wrap_selection_title({}, { locale })}
        subtitle={m.composer_wrap_selection_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceWrapSelection}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceWrapSelection: !appSettings.composerFenceWrapSelection,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.composer_copy_without_fences_title({}, { locale })}
        subtitle={
          <>
            {m.composer_copy_without_fences_subtitle(
              { modifier: optionKeyLabel },
              { locale },
            )}
          </>
        }
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerCodeBlockCopyUseModifier}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerCodeBlockCopyUseModifier:
                !appSettings.composerCodeBlockCopyUseModifier,
            })
          }
        />
      </SettingsToggleRow>
      <div className="settings-divider" />
      <div className="settings-subsection-title">
        {m.composer_subsection_pasting({}, { locale })}
      </div>
      <SettingsToggleRow
        title={m.composer_paste_multiline_title({}, { locale })}
        subtitle={m.composer_paste_multiline_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceAutoWrapPasteMultiline}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceAutoWrapPasteMultiline:
                !appSettings.composerFenceAutoWrapPasteMultiline,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.composer_paste_code_like_title({}, { locale })}
        subtitle={m.composer_paste_code_like_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerFenceAutoWrapPasteCodeLike}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceAutoWrapPasteCodeLike:
                !appSettings.composerFenceAutoWrapPasteCodeLike,
            })
          }
        />
      </SettingsToggleRow>
      <div className="settings-divider" />
      <div className="settings-subsection-title">
        {m.composer_subsection_lists({}, { locale })}
      </div>
      <SettingsToggleRow
        title={m.composer_continue_lists_title({}, { locale })}
        subtitle={m.composer_continue_lists_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.composerListContinuation}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerListContinuation: !appSettings.composerListContinuation,
            })
          }
        />
      </SettingsToggleRow>
    </SettingsSection>
  );
}
