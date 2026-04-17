import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AppSettings } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  CODE_FONT_SIZE_DEFAULT,
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
} from "@utils/fonts";

import {
  CHAT_SCROLLBACK_DEFAULT,
  CHAT_SCROLLBACK_MAX,
  CHAT_SCROLLBACK_MIN,
  CHAT_SCROLLBACK_PRESETS,
  clampChatScrollbackItems,
  isChatScrollbackPreset,
} from "@utils/chatScrollback";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";

type SettingsDisplaySectionProps = {
  appSettings: AppSettings;
  reduceTransparency: boolean;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  scaleDraft: string;
  uiFontDraft: string;
  codeFontDraft: string;
  codeFontSizeDraft: number;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onToggleTransparency: (value: boolean) => void;
  onSetScaleDraft: Dispatch<SetStateAction<string>>;
  onCommitScale: () => Promise<void>;
  onResetScale: () => Promise<void>;
  onSetUiFontDraft: Dispatch<SetStateAction<string>>;
  onCommitUiFont: () => Promise<void>;
  onSetCodeFontDraft: Dispatch<SetStateAction<string>>;
  onCommitCodeFont: () => Promise<void>;
  onSetCodeFontSizeDraft: Dispatch<SetStateAction<number>>;
  onCommitCodeFontSize: (nextSize: number) => Promise<void>;
  onTestNotificationSound: () => void;
  onTestSystemNotification: () => void;
};

export function SettingsDisplaySection({
  appSettings,
  reduceTransparency,
  scaleShortcutTitle,
  scaleShortcutText,
  scaleDraft,
  uiFontDraft,
  codeFontDraft,
  codeFontSizeDraft,
  onUpdateAppSettings,
  onToggleTransparency,
  onSetScaleDraft,
  onCommitScale,
  onResetScale,
  onSetUiFontDraft,
  onCommitUiFont,
  onSetCodeFontDraft,
  onCommitCodeFont,
  onSetCodeFontSizeDraft,
  onCommitCodeFontSize,
  onTestNotificationSound,
  onTestSystemNotification,
}: SettingsDisplaySectionProps) {
  const locale = useAppLocale();
  const scrollbackUnlimited = appSettings.chatHistoryScrollbackItems === null;
  const [scrollbackDraft, setScrollbackDraft] = useState(() => {
    const value = appSettings.chatHistoryScrollbackItems;
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : String(CHAT_SCROLLBACK_DEFAULT);
  });

  useEffect(() => {
    const value = appSettings.chatHistoryScrollbackItems;
    if (typeof value === "number" && Number.isFinite(value)) {
      setScrollbackDraft(String(value));
    }
  }, [appSettings.chatHistoryScrollbackItems]);

  const scrollbackPresetValue = (() => {
    const value = appSettings.chatHistoryScrollbackItems;
    if (typeof value === "number" && isChatScrollbackPreset(value)) {
      return String(value);
    }
    return "custom";
  })();

  const commitScrollback = () => {
    if (scrollbackUnlimited) {
      return;
    }
    const trimmed = scrollbackDraft.trim();
    const parsed = trimmed ? Number(trimmed) : Number.NaN;
    if (!Number.isFinite(parsed)) {
      const current = appSettings.chatHistoryScrollbackItems;
      const fallback =
        typeof current === "number" && Number.isFinite(current)
          ? current
          : CHAT_SCROLLBACK_DEFAULT;
      setScrollbackDraft(String(fallback));
      return;
    }
    const nextValue = clampChatScrollbackItems(parsed);
    setScrollbackDraft(String(nextValue));
    if (appSettings.chatHistoryScrollbackItems === nextValue) {
      return;
    }
    void onUpdateAppSettings({
      ...appSettings,
      chatHistoryScrollbackItems: nextValue,
    });
  };

  const toggleUnlimitedScrollback = () => {
    const nextUnlimited = !scrollbackUnlimited;
    if (nextUnlimited) {
      void onUpdateAppSettings({
        ...appSettings,
        chatHistoryScrollbackItems: null,
      });
      return;
    }
    const trimmed = scrollbackDraft.trim();
    const parsed = trimmed ? Number(trimmed) : Number.NaN;
    const nextValue = Number.isFinite(parsed)
      ? clampChatScrollbackItems(parsed)
      : CHAT_SCROLLBACK_DEFAULT;
    setScrollbackDraft(String(nextValue));
    void onUpdateAppSettings({
      ...appSettings,
      chatHistoryScrollbackItems: nextValue,
    });
  };

  const selectScrollbackPreset = (rawValue: string) => {
    if (scrollbackUnlimited) {
      return;
    }
    if (rawValue === "custom") {
      return;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextValue = clampChatScrollbackItems(parsed);
    setScrollbackDraft(String(nextValue));
    void onUpdateAppSettings({
      ...appSettings,
      chatHistoryScrollbackItems: nextValue,
    });
  };

  return (
    <SettingsSection
      title={m.display_title({}, { locale })}
      subtitle={m.display_subtitle({}, { locale })}
    >
      <div className="settings-subsection-title">
        {m.display_subsection_display({}, { locale })}
      </div>
      <div className="settings-subsection-subtitle">
        {m.display_subsection_display_subtitle({}, { locale })}
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="app-language-select">
          {m.display_language_label({}, { locale })}
        </label>
        <select
          id="app-language-select"
          className="settings-select"
          value={appSettings.appLanguage}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              appLanguage: event.target.value as AppSettings["appLanguage"],
            })
          }
        >
          <option value="en">{m.display_language_option_en({}, { locale })}</option>
          <option value="zh-CN">{m.display_language_option_zh_cn({}, { locale })}</option>
        </select>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="theme-select">
          {m.display_theme_label({}, { locale })}
        </label>
        <select
          id="theme-select"
          className="settings-select"
          value={appSettings.theme}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              theme: event.target.value as AppSettings["theme"],
            })
          }
        >
          <option value="system">{m.display_theme_option_system({}, { locale })}</option>
          <option value="light">{m.display_theme_option_light({}, { locale })}</option>
          <option value="dark">{m.display_theme_option_dark({}, { locale })}</option>
          <option value="dim">{m.display_theme_option_dim({}, { locale })}</option>
        </select>
      </div>
      <SettingsToggleRow
        title={m.display_usage_remaining_title({}, { locale })}
        subtitle={m.display_usage_remaining_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.usageShowRemaining}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              usageShowRemaining: !appSettings.usageShowRemaining,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.display_show_file_path_title({}, { locale })}
        subtitle={m.display_show_file_path_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.showMessageFilePath}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              showMessageFilePath: !appSettings.showMessageFilePath,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.display_split_panes_title({}, { locale })}
        subtitle={m.display_split_panes_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.splitChatDiffView}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              splitChatDiffView: !appSettings.splitChatDiffView,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.display_auto_thread_title({}, { locale })}
        subtitle={m.display_auto_thread_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.threadTitleAutogenerationEnabled}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              threadTitleAutogenerationEnabled:
                !appSettings.threadTitleAutogenerationEnabled,
            })
          }
        />
      </SettingsToggleRow>
      <div className="settings-subsection-title">
        {m.display_subsection_chat({}, { locale })}
      </div>
      <div className="settings-subsection-subtitle">
        {m.display_subsection_chat_subtitle({}, { locale })}
      </div>
      <SettingsToggleRow
        title={m.display_unlimited_chat_title({}, { locale })}
        subtitle={m.display_unlimited_chat_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={scrollbackUnlimited}
          onClick={toggleUnlimitedScrollback}
          data-scrollback-control="true"
        />
      </SettingsToggleRow>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="chat-scrollback-preset">
          {m.display_scrollback_preset_label({}, { locale })}
        </label>
        <select
          id="chat-scrollback-preset"
          className="settings-select"
          value={scrollbackPresetValue}
          onChange={(event) => selectScrollbackPreset(event.target.value)}
          data-scrollback-control="true"
          disabled={scrollbackUnlimited}
        >
          <option value="custom">{m.display_scrollback_preset_custom({}, { locale })}</option>
          {CHAT_SCROLLBACK_PRESETS.map((value) => (
            <option key={value} value={value}>
              {value === CHAT_SCROLLBACK_DEFAULT
                ? m.display_scrollback_preset_default({ value }, { locale })
                : value}
            </option>
          ))}
        </select>
        <div className="settings-help">
          {m.display_scrollback_help({}, { locale })}
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="chat-scrollback-items">
          {m.display_scrollback_max_items_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="chat-scrollback-items"
            type="text"
            inputMode="numeric"
            className="settings-input"
            value={scrollbackDraft}
            disabled={scrollbackUnlimited}
            onChange={(event) => setScrollbackDraft(event.target.value)}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (
                nextTarget instanceof HTMLElement &&
                nextTarget.dataset.scrollbackControl === "true"
              ) {
                return;
              }
              commitScrollback();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitScrollback();
              }
            }}
          />
          <button
            type="button"
            className="ghost settings-button-compact"
            data-scrollback-control="true"
            disabled={scrollbackUnlimited}
            onClick={() => {
              setScrollbackDraft(String(CHAT_SCROLLBACK_DEFAULT));
              void onUpdateAppSettings({
                ...appSettings,
                chatHistoryScrollbackItems: CHAT_SCROLLBACK_DEFAULT,
              });
            }}
          >
            {m.action_reset({}, { locale })}
          </button>
        </div>
        <div className="settings-help">
          {m.display_scrollback_range_help(
            { min: CHAT_SCROLLBACK_MIN, max: CHAT_SCROLLBACK_MAX },
            { locale },
          )}
        </div>
      </div>
      <SettingsToggleRow
        title={m.display_reduce_transparency_title({}, { locale })}
        subtitle={m.display_reduce_transparency_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={reduceTransparency}
          onClick={() => onToggleTransparency(!reduceTransparency)}
        />
      </SettingsToggleRow>
      <div className="settings-toggle-row settings-scale-row">
        <div>
          <div className="settings-toggle-title">
            {m.display_interface_scale_title({}, { locale })}
          </div>
          <div className="settings-toggle-subtitle" title={scaleShortcutTitle}>
            {scaleShortcutText}
          </div>
        </div>
        <div className="settings-scale-controls">
          <input
            id="ui-scale"
            type="text"
            inputMode="decimal"
            className="settings-input settings-input--scale"
            value={scaleDraft}
            aria-label={m.display_interface_scale_aria({}, { locale })}
            onChange={(event) => onSetScaleDraft(event.target.value)}
            onBlur={() => {
              void onCommitScale();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitScale();
              }
            }}
          />
          <button
            type="button"
            className="ghost settings-scale-reset"
            onClick={() => {
              void onResetScale();
            }}
          >
            {m.action_reset({}, { locale })}
          </button>
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="ui-font-family">
          {m.display_ui_font_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="ui-font-family"
            type="text"
            className="settings-input"
            value={uiFontDraft}
            onChange={(event) => onSetUiFontDraft(event.target.value)}
            onBlur={() => {
              void onCommitUiFont();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitUiFont();
              }
            }}
          />
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              onSetUiFontDraft(DEFAULT_UI_FONT_FAMILY);
              void onUpdateAppSettings({
                ...appSettings,
                uiFontFamily: DEFAULT_UI_FONT_FAMILY,
              });
            }}
          >
            {m.action_reset({}, { locale })}
          </button>
        </div>
        <div className="settings-help">
          {m.display_ui_font_help({}, { locale })}
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="code-font-family">
          {m.display_code_font_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="code-font-family"
            type="text"
            className="settings-input"
            value={codeFontDraft}
            onChange={(event) => onSetCodeFontDraft(event.target.value)}
            onBlur={() => {
              void onCommitCodeFont();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitCodeFont();
              }
            }}
          />
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              onSetCodeFontDraft(DEFAULT_CODE_FONT_FAMILY);
              void onUpdateAppSettings({
                ...appSettings,
                codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
              });
            }}
          >
            {m.action_reset({}, { locale })}
          </button>
        </div>
        <div className="settings-help">{m.display_code_font_help({}, { locale })}</div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="code-font-size">
          {m.display_code_font_size_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="code-font-size"
            type="range"
            min={CODE_FONT_SIZE_MIN}
            max={CODE_FONT_SIZE_MAX}
            step={1}
            className="settings-input settings-input--range"
            value={codeFontSizeDraft}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onSetCodeFontSizeDraft(nextValue);
              void onCommitCodeFontSize(nextValue);
            }}
          />
          <div className="settings-scale-value">{codeFontSizeDraft}px</div>
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              onSetCodeFontSizeDraft(CODE_FONT_SIZE_DEFAULT);
              void onCommitCodeFontSize(CODE_FONT_SIZE_DEFAULT);
            }}
          >
            {m.action_reset({}, { locale })}
          </button>
        </div>
        <div className="settings-help">
          {m.display_code_font_size_help({}, { locale })}
        </div>
      </div>
      <div className="settings-subsection-title">
        {m.display_subsection_sounds({}, { locale })}
      </div>
      <div className="settings-subsection-subtitle">
        {m.display_subsection_sounds_subtitle({}, { locale })}
      </div>
      <SettingsToggleRow
        title={m.display_notification_sounds_title({}, { locale })}
        subtitle={m.display_notification_sounds_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.notificationSoundsEnabled}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              notificationSoundsEnabled: !appSettings.notificationSoundsEnabled,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.display_system_notifications_title({}, { locale })}
        subtitle={m.display_system_notifications_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.systemNotificationsEnabled}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              systemNotificationsEnabled: !appSettings.systemNotificationsEnabled,
            })
          }
        />
      </SettingsToggleRow>
      <SettingsToggleRow
        title={m.display_subagent_notifications_title({}, { locale })}
        subtitle={m.display_subagent_notifications_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.subagentSystemNotificationsEnabled}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              subagentSystemNotificationsEnabled:
                !appSettings.subagentSystemNotificationsEnabled,
            })
          }
        />
      </SettingsToggleRow>
      <div className="settings-sound-actions">
        <button
          type="button"
          className="ghost settings-button-compact"
          onClick={onTestNotificationSound}
        >
          {m.display_test_sound({}, { locale })}
        </button>
        <button
          type="button"
          className="ghost settings-button-compact"
          onClick={onTestSystemNotification}
        >
          {m.display_test_notification({}, { locale })}
        </button>
      </div>
    </SettingsSection>
  );
}
