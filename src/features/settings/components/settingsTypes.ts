import type { OpenAppTarget } from "@/types";

export const SETTINGS_SECTION_IDS = [
  "projects",
  "environments",
  "display",
  "about",
  "composer",
  "dictation",
  "shortcuts",
  "open-apps",
  "git",
  "server",
  "agents",
] as const;

export const SETTINGS_EXTRA_SECTION_IDS = ["codex", "features"] as const;

export const SETTINGS_ROUTE_SECTION_IDS = [
  ...SETTINGS_SECTION_IDS,
  ...SETTINGS_EXTRA_SECTION_IDS,
  "profile",
] as const;

type SettingsSection = (typeof SETTINGS_SECTION_IDS)[number];

export type CodexSection =
  | SettingsSection
  | (typeof SETTINGS_EXTRA_SECTION_IDS)[number];

export const SETTINGS_NAV_SECTION_IDS: readonly CodexSection[] = [
  "codex",
  "projects",
  "environments",
  "display",
  "composer",
  "dictation",
  "shortcuts",
  "open-apps",
  "git",
  "server",
  "agents",
  "features",
  "about",
];

function isSettingsSectionVisible(
  section: CodexSection,
  serverSectionVisible: boolean,
): boolean {
  return section !== "server" || serverSectionVisible;
}

export function getDefaultCodexSection(
  serverSectionVisible: boolean,
): CodexSection {
  return (
    SETTINGS_NAV_SECTION_IDS.find((section) =>
      isSettingsSectionVisible(section, serverSectionVisible),
    ) ?? "codex"
  );
}

// Temporarily hide server settings while the embedded runtime UX is being simplified.
export function normalizeCodexSection(
  section: CodexSection | undefined,
  serverSectionVisible: boolean,
): CodexSection | undefined {
  if (section === "server" && !serverSectionVisible) {
    return getDefaultCodexSection(serverSectionVisible);
  }
  return section;
}

export type ShortcutSettingKey =
  | "composerModelShortcut"
  | "composerAccessShortcut"
  | "composerReasoningShortcut"
  | "composerCollaborationShortcut"
  | "interruptShortcut"
  | "newAgentShortcut"
  | "newWorktreeAgentShortcut"
  | "newCloneAgentShortcut"
  | "archiveThreadShortcut"
  | "toggleProjectsSidebarShortcut"
  | "toggleGitSidebarShortcut"
  | "branchSwitcherShortcut"
  | "toggleDebugPanelShortcut"
  | "toggleTerminalShortcut"
  | "cycleAgentNextShortcut"
  | "cycleAgentPrevShortcut"
  | "cycleWorkspaceNextShortcut"
  | "cycleWorkspacePrevShortcut";

export type ShortcutDraftKey =
  | "model"
  | "access"
  | "reasoning"
  | "collaboration"
  | "interrupt"
  | "newAgent"
  | "newWorktreeAgent"
  | "newCloneAgent"
  | "archiveThread"
  | "projectsSidebar"
  | "gitSidebar"
  | "branchSwitcher"
  | "debugPanel"
  | "terminal"
  | "cycleAgentNext"
  | "cycleAgentPrev"
  | "cycleWorkspaceNext"
  | "cycleWorkspacePrev";

export type ShortcutDrafts = Record<ShortcutDraftKey, string>;

export type OpenAppDraft = OpenAppTarget & { argsText: string };
