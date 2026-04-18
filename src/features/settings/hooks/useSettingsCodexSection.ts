import { useCallback, useEffect, useState } from "react";
import type { AppSettings, GlobalAiSettings, WorkspaceInfo } from "@/types";
import type {
  UpdateAiProviderSettingsInput,
  UpdateGlobalAiSessionDefaultsInput,
} from "@services/tauri";
import {
  getGlobalAiSettings,
  updateAiProviderSettings,
  updateGlobalAiSessionDefaults,
} from "@services/tauri";
import { buildEditorContentMeta } from "@settings/components/settingsViewHelpers";
import { useGlobalAgentsMd } from "./useGlobalAgentsMd";
import { useSettingsDefaultModels } from "./useSettingsDefaultModels";

type UseSettingsCodexSectionArgs = {
  appSettings: AppSettings;
  projects: WorkspaceInfo[];
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export type SettingsCodexSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  aiSettings: GlobalAiSettings | null;
  aiSettingsLoading: boolean;
  aiSettingsError: string | null;
  updatingSessionDefaults: boolean;
  updatingAiProviderSettings: boolean;
  defaultModels: ReturnType<typeof useSettingsDefaultModels>["models"];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  onRefreshAiSettings: () => void;
  onUpdateSessionDefaults: (
    input: UpdateGlobalAiSessionDefaultsInput,
  ) => Promise<boolean>;
  onUpdateAiProviderSettings: (
    input: UpdateAiProviderSettingsInput,
  ) => Promise<boolean>;
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

const toErrorMessage = (value: unknown, fallback: string): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return fallback;
};

export const useSettingsCodexSection = ({
  appSettings,
  projects,
  onUpdateAppSettings,
}: UseSettingsCodexSectionArgs): SettingsCodexSectionProps => {
  const [aiSettings, setAiSettings] = useState<GlobalAiSettings | null>(null);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true);
  const [aiSettingsError, setAiSettingsError] = useState<string | null>(null);
  const [updatingSessionDefaults, setUpdatingSessionDefaults] = useState(false);
  const [updatingAiProviderSettingsState, setUpdatingAiProviderSettingsState] =
    useState(false);

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
  const globalAgentsMeta =
    !globalAgentsExists &&
    !globalAgentsLoading &&
    !globalAgentsSaving &&
    !globalAgentsTruncated
      ? ""
      : globalAgentsEditorMeta.meta;

  const refreshAiSettings = useCallback(async () => {
    setAiSettingsLoading(true);
    setAiSettingsError(null);
    try {
      const next = await getGlobalAiSettings();
      setAiSettings(next);
    } catch (error) {
      setAiSettingsError(toErrorMessage(error, "Unable to load AI settings."));
    } finally {
      setAiSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (aiSettingsLoading && aiSettings === null && aiSettingsError === null) {
      void refreshAiSettings();
    }
  }, [aiSettings, aiSettingsError, aiSettingsLoading, refreshAiSettings]);

  const onUpdateSessionDefaults = useCallback(
    async (input: UpdateGlobalAiSessionDefaultsInput): Promise<boolean> => {
      setUpdatingSessionDefaults(true);
      setAiSettingsError(null);
      try {
        const next = await updateGlobalAiSessionDefaults(input);
        setAiSettings(next);
        void refreshDefaultModels();
        return true;
      } catch (error) {
        setAiSettingsError(toErrorMessage(error, "Unable to update AI defaults."));
        return false;
      } finally {
        setUpdatingSessionDefaults(false);
      }
    },
    [refreshDefaultModels],
  );

  const onUpdateAiProviderSettings = useCallback(
    async (input: UpdateAiProviderSettingsInput): Promise<boolean> => {
      setUpdatingAiProviderSettingsState(true);
      setAiSettingsError(null);
      try {
        const next = await updateAiProviderSettings(input);
        setAiSettings(next);
        return true;
      } catch (error) {
        setAiSettingsError(
          toErrorMessage(error, "Unable to update AI provider settings."),
        );
        return false;
      } finally {
        setUpdatingAiProviderSettingsState(false);
      }
    },
    [],
  );

  const globalAgentsPath = (() => {
    const directory = aiSettings?.configPath ? parentDir(aiSettings.configPath) : null;
    if (!directory) {
      return null;
    }
    return joinPath(directory, "AGENTS.md");
  })();

  return {
    appSettings,
    onUpdateAppSettings,
    aiSettings,
    aiSettingsLoading,
    aiSettingsError,
    updatingSessionDefaults,
    updatingAiProviderSettings: updatingAiProviderSettingsState,
    defaultModels,
    defaultModelsLoading,
    defaultModelsError,
    defaultModelsConnectedWorkspaceCount,
    onRefreshDefaultModels: () => {
      void refreshDefaultModels();
    },
    onRefreshAiSettings: () => {
      void refreshAiSettings();
    },
    onUpdateSessionDefaults,
    onUpdateAiProviderSettings,
    globalAgentsPath,
    globalAgentsMeta,
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
