import { useMemo, useState, type KeyboardEvent } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsSubsection,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { formatShortcut, getDefaultInterruptShortcut } from "@utils/shortcuts";
import { isMacPlatform } from "@utils/platformPaths";
import type {
  ShortcutDraftKey,
  ShortcutDrafts,
  ShortcutSettingKey,
} from "@settings/components/settingsTypes";

type ShortcutItem = {
  label: string;
  draftKey: ShortcutDraftKey;
  settingKey: ShortcutSettingKey;
  help: string;
};

type ShortcutGroup = {
  title: string;
  subtitle: string;
  items: ShortcutItem[];
};

type SettingsShortcutsSectionProps = {
  shortcutDrafts: ShortcutDrafts;
  onShortcutKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    key: ShortcutSettingKey,
  ) => void;
  onClearShortcut: (key: ShortcutSettingKey) => void;
};

type ShortcutFieldProps = {
  item: ShortcutItem;
  shortcutDrafts: ShortcutDrafts;
  locale: ReturnType<typeof useAppLocale>;
  onShortcutKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    key: ShortcutSettingKey,
  ) => void;
  onClearShortcut: (key: ShortcutSettingKey) => void;
};

function ShortcutField({
  item,
  shortcutDrafts,
  locale,
  onShortcutKeyDown,
  onClearShortcut,
}: ShortcutFieldProps) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">{item.label}</div>
      <div className="settings-field-row">
        <input
          className="settings-input settings-input--shortcut"
          value={formatShortcut(shortcutDrafts[item.draftKey])}
          onKeyDown={(event) => onShortcutKeyDown(event, item.settingKey)}
          placeholder={m.settings_shortcuts_type_placeholder({}, { locale })}
          readOnly
        />
        <button
          type="button"
          className="ghost settings-button-compact"
          onClick={() => onClearShortcut(item.settingKey)}
        >
          {m.action_clear({}, { locale })}
        </button>
      </div>
      <div className="settings-help">{item.help}</div>
    </div>
  );
}

export function SettingsShortcutsSection({
  shortcutDrafts,
  onShortcutKeyDown,
  onClearShortcut,
}: SettingsShortcutsSectionProps) {
  const locale = useAppLocale();
  const isMac = isMacPlatform();
  const [searchQuery, setSearchQuery] = useState("");

  const groups = useMemo<ShortcutGroup[]>(
    () => [
      {
        title: m.settings_shortcuts_group_file_title({}, { locale }),
        subtitle: m.settings_shortcuts_group_file_subtitle({}, { locale }),
        items: [
          {
            label: m.settings_shortcuts_new_agent({}, { locale }),
            draftKey: "newAgent",
            settingKey: "newAgentShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+n") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_new_worktree_agent({}, { locale }),
            draftKey: "newWorktreeAgent",
            settingKey: "newWorktreeAgentShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+n") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_new_clone_agent({}, { locale }),
            draftKey: "newCloneAgent",
            settingKey: "newCloneAgentShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+alt+n") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_archive_thread({}, { locale }),
            draftKey: "archiveThread",
            settingKey: "archiveThreadShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut(isMac ? "cmd+ctrl+a" : "ctrl+alt+a") },
              { locale },
            ),
          },
        ],
      },
      {
        title: m.settings_shortcuts_group_composer_title({}, { locale }),
        subtitle: m.settings_shortcuts_group_composer_subtitle({}, { locale }),
        items: [
          {
            label: m.settings_shortcuts_cycle_model({}, { locale }),
            draftKey: "model",
            settingKey: "composerModelShortcut",
            help: m.settings_shortcuts_press_new_default_help(
              { value: formatShortcut("cmd+shift+m") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_cycle_access_mode({}, { locale }),
            draftKey: "access",
            settingKey: "composerAccessShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+a") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_cycle_reasoning_mode({}, { locale }),
            draftKey: "reasoning",
            settingKey: "composerReasoningShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+r") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_cycle_collaboration_mode({}, { locale }),
            draftKey: "collaboration",
            settingKey: "composerCollaborationShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("shift+tab") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_stop_active_run({}, { locale }),
            draftKey: "interrupt",
            settingKey: "interruptShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut(getDefaultInterruptShortcut()) },
              { locale },
            ),
          },
        ],
      },
      {
        title: m.settings_shortcuts_group_panels_title({}, { locale }),
        subtitle: m.settings_shortcuts_group_panels_subtitle({}, { locale }),
        items: [
          {
            label: m.settings_shortcuts_toggle_projects_sidebar({}, { locale }),
            draftKey: "projectsSidebar",
            settingKey: "toggleProjectsSidebarShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+p") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_toggle_git_sidebar({}, { locale }),
            draftKey: "gitSidebar",
            settingKey: "toggleGitSidebarShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+g") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_branch_switcher({}, { locale }),
            draftKey: "branchSwitcher",
            settingKey: "branchSwitcherShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+b") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_toggle_debug_panel({}, { locale }),
            draftKey: "debugPanel",
            settingKey: "toggleDebugPanelShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+d") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_toggle_terminal_panel({}, { locale }),
            draftKey: "terminal",
            settingKey: "toggleTerminalShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut("cmd+shift+t") },
              { locale },
            ),
          },
        ],
      },
      {
        title: m.settings_shortcuts_group_navigation_title({}, { locale }),
        subtitle: m.settings_shortcuts_group_navigation_subtitle({}, { locale }),
        items: [
          {
            label: m.settings_shortcuts_next_agent({}, { locale }),
            draftKey: "cycleAgentNext",
            settingKey: "cycleAgentNextShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut(isMac ? "cmd+ctrl+down" : "ctrl+alt+down") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_previous_agent({}, { locale }),
            draftKey: "cycleAgentPrev",
            settingKey: "cycleAgentPrevShortcut",
            help: m.settings_shortcuts_default_help(
              { value: formatShortcut(isMac ? "cmd+ctrl+up" : "ctrl+alt+up") },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_next_workspace({}, { locale }),
            draftKey: "cycleWorkspaceNext",
            settingKey: "cycleWorkspaceNextShortcut",
            help: m.settings_shortcuts_default_help(
              {
                value: formatShortcut(
                  isMac ? "cmd+shift+down" : "ctrl+alt+shift+down",
                ),
              },
              { locale },
            ),
          },
          {
            label: m.settings_shortcuts_previous_workspace({}, { locale }),
            draftKey: "cycleWorkspacePrev",
            settingKey: "cycleWorkspacePrevShortcut",
            help: m.settings_shortcuts_default_help(
              {
                value: formatShortcut(
                  isMac ? "cmd+shift+up" : "ctrl+alt+shift+up",
                ),
              },
              { locale },
            ),
          },
        ],
      },
    ],
    [isMac, locale],
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedSearchQuery) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const searchValue =
            `${group.title} ${group.subtitle} ${item.label} ${item.help}`.toLowerCase();
          return searchValue.includes(normalizedSearchQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedSearchQuery]);

  return (
    <SettingsSection
      title={m.settings_shortcuts_title({}, { locale })}
      subtitle={m.settings_shortcuts_subtitle({}, { locale })}
    >
      <div className="settings-field settings-shortcuts-search">
        <label className="settings-field-label" htmlFor="settings-shortcuts-search">
          {m.settings_shortcuts_search_label({}, { locale })}
        </label>
        <div className="settings-field-row">
          <input
            id="settings-shortcuts-search"
            className="settings-input"
            placeholder={m.settings_shortcuts_search_placeholder({}, { locale })}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => setSearchQuery("")}
            >
              {m.action_clear({}, { locale })}
            </button>
          )}
        </div>
        <div className="settings-help">
          {m.settings_shortcuts_filter_help({}, { locale })}
        </div>
      </div>
      {filteredGroups.map((group, index) => (
        <div key={group.title}>
          {index > 0 && <div className="settings-divider" />}
          <SettingsSubsection title={group.title} subtitle={group.subtitle} />
          {group.items.map((item) => (
            <ShortcutField
              key={item.settingKey}
              item={item}
              shortcutDrafts={shortcutDrafts}
              locale={locale}
              onShortcutKeyDown={onShortcutKeyDown}
              onClearShortcut={onClearShortcut}
            />
          ))}
        </div>
      ))}
      {filteredGroups.length === 0 && (
        <div className="settings-empty">
          {normalizedSearchQuery
            ? m.settings_shortcuts_no_matches_query(
                { value: searchQuery.trim() },
                { locale },
              )
            : m.settings_shortcuts_no_matches_default({}, { locale })}
        </div>
      )}
    </SettingsSection>
  );
}
