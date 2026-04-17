import { useEffect, useState } from "react";
import type { AppSettings, CodexDoctorResult, CodexUpdateResult, WorkspaceInfo } from "@/types";
import { getCodexConfigPath } from "@services/tauri";
import { useGlobalAgentsMd } from "./useGlobalAgentsMd";
import { useSettingsDefaultModels } from "./useSettingsDefaultModels";
import { buildEditorContentMeta } from "@settings/components/settingsViewHelpers";

type UseSettingsCodexSectionArgs = {
  appSettings: AppSettings;
  projects: WorkspaceInfo[];
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onRunDoctor: (
    codexBin: string | null,
    codexArgs: string | null,
  ) => Promise<CodexDoctorResult>;
  onRunCodexUpdate?: (
    codexBin: string | null,
    codexArgs: string | null,
  ) => Promise<CodexUpdateResult>;
};

export type SettingsCodexSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  defaultModels: ReturnType<typeof useSettingsDefaultModels>["models"];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  globalAgentsPath: string | null;
  globalAgentsMeta: string;
  globalAgentsError: string | null;
  globalAgentsContent: string;
  globalAgentsLoading: boolean;
  globalAgentsRefreshDisabled: boolean;
  globalAgentsSaveDisabled: boolean;
  globalAgentsSaveLabel: string;
  onSetGlobalAgentsContent: (value: string) => void;
  onRefreshGlobalAgents: () => void;
  onSaveGlobalAgents: () => void;
};

function parentDir(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  const lastSeparator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (lastSeparator <= 0) {
    return null;
  }
  return trimmed.slice(0, lastSeparator);
}

function joinPath(base: string, name: string): string {
  if (base.endsWith("/") || base.endsWith("\\")) {
    return `${base}${name}`;
  }
  if (base.includes("\\") && !base.includes("/")) {
    return `${base}\\${name}`;
  }
  return `${base}/${name}`;
}

export const useSettingsCodexSection = ({
  appSettings,
  projects,
  onUpdateAppSettings,
  onRunDoctor: _onRunDoctor,
  onRunCodexUpdate: _onRunCodexUpdate,
}: UseSettingsCodexSectionArgs): SettingsCodexSectionProps => {
  const [globalConfigPath, setGlobalConfigPath] = useState<string | null>(null);

  const {
    models: defaultModels,
    isLoading: defaultModelsLoading,
    error: defaultModelsError,
    connectedWorkspaceCount: defaultModelsConnectedWorkspaceCount,
    refresh: refreshDefaultModels,
  } = useSettingsDefaultModels(projects);

  const {
    content: globalAgentsContent,
    exists: globalAgentsExists,
    truncated: globalAgentsTruncated,
    isLoading: globalAgentsLoading,
    isSaving: globalAgentsSaving,
    error: globalAgentsError,
    isDirty: globalAgentsDirty,
    setContent: setGlobalAgentsContent,
    refresh: refreshGlobalAgents,
    save: saveGlobalAgents,
  } = useGlobalAgentsMd();

  const globalAgentsEditorMeta = buildEditorContentMeta({
    isLoading: globalAgentsLoading,
    isSaving: globalAgentsSaving,
    exists: globalAgentsExists,
    truncated: globalAgentsTruncated,
    isDirty: globalAgentsDirty,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const path = await getCodexConfigPath();
        if (!cancelled) {
          setGlobalConfigPath(path);
        }
      } catch {
        if (!cancelled) {
          setGlobalConfigPath(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const globalAgentsPath = (() => {
    const directory = globalConfigPath ? parentDir(globalConfigPath) : null;
    if (!directory) {
      return null;
    }
    return joinPath(directory, "AGENTS.md");
  })();

  return {
    appSettings,
    onUpdateAppSettings,
    defaultModels,
    defaultModelsLoading,
    defaultModelsError,
    defaultModelsConnectedWorkspaceCount,
    onRefreshDefaultModels: () => {
      void refreshDefaultModels();
    },
    globalAgentsPath,
    globalAgentsMeta: globalAgentsEditorMeta.meta,
    globalAgentsError,
    globalAgentsContent,
    globalAgentsLoading,
    globalAgentsRefreshDisabled: globalAgentsEditorMeta.refreshDisabled,
    globalAgentsSaveDisabled: globalAgentsEditorMeta.saveDisabled,
    globalAgentsSaveLabel: globalAgentsEditorMeta.saveLabel,
    onSetGlobalAgentsContent: setGlobalAgentsContent,
    onRefreshGlobalAgents: () => {
      void refreshGlobalAgents();
    },
    onSaveGlobalAgents: () => {
      void saveGlobalAgents();
    },
  };
};
