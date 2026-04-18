import { useCallback, useEffect, useState } from "react";
import type { AppSettings, GlobalAiSettings, WorkspaceInfo } from "@/types";
import type {
  CreateCustomAiProviderInput,
  DeleteCustomAiProviderInput,
  UpdateCustomAiProviderInput,
  UpdateGlobalAiSessionDefaultsInput,
} from "@services/tauri";
import {
  createCustomAiProvider,
  deleteCustomAiProvider,
  getGlobalAiSettings,
  updateCustomAiProvider,
  updateGlobalAiSessionDefaults,
  updateOpenAiBaseUrl,
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
  updatingOpenAiBaseUrl: boolean;
  creatingProvider: boolean;
  updatingProviderId: string | null;
  deletingProviderId: string | null;
  defaultModels: ReturnType<typeof useSettingsDefaultModels>["models"];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  onRefreshAiSettings: () => void;
  onUpdateSessionDefaults: (
    input: UpdateGlobalAiSessionDefaultsInput,
  ) => Promise<boolean>;
  onUpdateOpenAiBaseUrl: (baseUrl: string | null) => Promise<boolean>;
  onCreateProvider: (input: CreateCustomAiProviderInput) => Promise<boolean>;
  onUpdateProvider: (input: UpdateCustomAiProviderInput) => Promise<boolean>;
  onDeleteProvider: (input: DeleteCustomAiProviderInput) => Promise<boolean>;
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
  const [updatingOpenAiBaseUrlState, setUpdatingOpenAiBaseUrlState] =
    useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [updatingProviderId, setUpdatingProviderId] = useState<string | null>(
    null,
  );
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(
    null,
  );

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

  const onUpdateOpenAiBaseUrl = useCallback(
    async (baseUrl: string | null): Promise<boolean> => {
      setUpdatingOpenAiBaseUrlState(true);
      setAiSettingsError(null);
      try {
        const next = await updateOpenAiBaseUrl(baseUrl);
        setAiSettings(next);
        void refreshDefaultModels();
        return true;
      } catch (error) {
        setAiSettingsError(
          toErrorMessage(error, "Unable to update OpenAI base URL."),
        );
        return false;
      } finally {
        setUpdatingOpenAiBaseUrlState(false);
      }
    },
    [refreshDefaultModels],
  );

  const onCreateProvider = useCallback(
    async (input: CreateCustomAiProviderInput): Promise<boolean> => {
      setCreatingProvider(true);
      setAiSettingsError(null);
      try {
        const next = await createCustomAiProvider(input);
        setAiSettings(next);
        return true;
      } catch (error) {
        setAiSettingsError(toErrorMessage(error, "Unable to create provider."));
        return false;
      } finally {
        setCreatingProvider(false);
      }
    },
    [],
  );

  const onUpdateProvider = useCallback(
    async (input: UpdateCustomAiProviderInput): Promise<boolean> => {
      setUpdatingProviderId(input.originalId);
      setAiSettingsError(null);
      try {
        const next = await updateCustomAiProvider(input);
        setAiSettings(next);
        return true;
      } catch (error) {
        setAiSettingsError(toErrorMessage(error, "Unable to update provider."));
        return false;
      } finally {
        setUpdatingProviderId((current) =>
          current === input.originalId ? null : current,
        );
      }
    },
    [],
  );

  const onDeleteProvider = useCallback(
    async (input: DeleteCustomAiProviderInput): Promise<boolean> => {
      setDeletingProviderId(input.id);
      setAiSettingsError(null);
      try {
        const next = await deleteCustomAiProvider(input);
        setAiSettings(next);
        return true;
      } catch (error) {
        setAiSettingsError(toErrorMessage(error, "Unable to delete provider."));
        return false;
      } finally {
        setDeletingProviderId((current) => (current === input.id ? null : current));
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
    updatingOpenAiBaseUrl: updatingOpenAiBaseUrlState,
    creatingProvider,
    updatingProviderId,
    deletingProviderId,
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
    onUpdateOpenAiBaseUrl,
    onCreateProvider,
    onUpdateProvider,
    onDeleteProvider,
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
