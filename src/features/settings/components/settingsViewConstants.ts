import type { AppLanguage, AppSettings } from "@/types";
import * as m from "@/i18n/messages";
import type { CodexSection, ShortcutDraftKey, ShortcutSettingKey } from "./settingsTypes";

export function getDictationModels(locale: AppLanguage) {
  return [
    {
      id: "tiny",
      label: m.dictation_model_tiny_label({}, { locale }),
      size: "75 MB",
      note: m.dictation_model_tiny_note({}, { locale }),
    },
    {
      id: "base",
      label: m.dictation_model_base_label({}, { locale }),
      size: "142 MB",
      note: m.dictation_model_base_note({}, { locale }),
    },
    {
      id: "small",
      label: m.dictation_model_small_label({}, { locale }),
      size: "466 MB",
      note: m.dictation_model_small_note({}, { locale }),
    },
    {
      id: "medium",
      label: m.dictation_model_medium_label({}, { locale }),
      size: "1.5 GB",
      note: m.dictation_model_medium_note({}, { locale }),
    },
    {
      id: "large-v3",
      label: m.dictation_model_large_v3_label({}, { locale }),
      size: "3.0 GB",
      note: m.dictation_model_large_v3_note({}, { locale }),
    },
  ];
}

type ComposerPreset = AppSettings["composerEditorPreset"];

type ComposerPresetSettings = Pick<
  AppSettings,
  | "composerFenceExpandOnSpace"
  | "composerFenceExpandOnEnter"
  | "composerFenceLanguageTags"
  | "composerFenceWrapSelection"
  | "composerFenceAutoWrapPasteMultiline"
  | "composerFenceAutoWrapPasteCodeLike"
  | "composerListContinuation"
  | "composerCodeBlockCopyUseModifier"
>;

export function getComposerPresetLabels(
  locale: AppLanguage,
): Record<ComposerPreset, string> {
  return {
    default: m.composer_preset_option_default({}, { locale }),
    helpful: m.composer_preset_option_helpful({}, { locale }),
    smart: m.composer_preset_option_smart({}, { locale }),
  };
}

export const COMPOSER_PRESET_CONFIGS: Record<
  ComposerPreset,
  ComposerPresetSettings
> = {
  default: {
    composerFenceExpandOnSpace: false,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: false,
    composerFenceWrapSelection: false,
    composerFenceAutoWrapPasteMultiline: false,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: false,
    composerCodeBlockCopyUseModifier: false,
  },
  helpful: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
  smart: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: true,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
};

export const SETTINGS_MOBILE_BREAKPOINT_PX = 720;
export const DEFAULT_REMOTE_HOST = "127.0.0.1:4732";

export function getSettingsSectionLabel(section: CodexSection, locale: AppLanguage): string {
  switch (section) {
    case "projects":
      return m.settings_nav_projects({}, { locale });
    case "environments":
      return m.settings_nav_environments({}, { locale });
    case "display":
      return m.settings_nav_display({}, { locale });
    case "about":
      return m.settings_nav_about({}, { locale });
    case "composer":
      return m.settings_nav_composer({}, { locale });
    case "dictation":
      return m.settings_nav_dictation({}, { locale });
    case "shortcuts":
      return m.settings_nav_shortcuts({}, { locale });
    case "open-apps":
      return m.settings_nav_open_apps({}, { locale });
    case "git":
      return m.settings_nav_git({}, { locale });
    case "server":
      return m.settings_nav_server({}, { locale });
    case "agents":
      return m.settings_nav_agents({}, { locale });
    case "codex":
      return "Codex";
    case "features":
      return m.settings_nav_features({}, { locale });
  }
}

export const SHORTCUT_DRAFT_KEY_BY_SETTING: Record<
  ShortcutSettingKey,
  ShortcutDraftKey
> = {
  composerModelShortcut: "model",
  composerAccessShortcut: "access",
  composerReasoningShortcut: "reasoning",
  composerCollaborationShortcut: "collaboration",
  interruptShortcut: "interrupt",
  newAgentShortcut: "newAgent",
  newWorktreeAgentShortcut: "newWorktreeAgent",
  newCloneAgentShortcut: "newCloneAgent",
  archiveThreadShortcut: "archiveThread",
  toggleProjectsSidebarShortcut: "projectsSidebar",
  toggleGitSidebarShortcut: "gitSidebar",
  branchSwitcherShortcut: "branchSwitcher",
  toggleDebugPanelShortcut: "debugPanel",
  toggleTerminalShortcut: "terminal",
  cycleAgentNextShortcut: "cycleAgentNext",
  cycleAgentPrevShortcut: "cycleAgentPrev",
  cycleWorkspaceNextShortcut: "cycleWorkspaceNext",
  cycleWorkspacePrevShortcut: "cycleWorkspacePrev",
};
