import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AccountSnapshot,
  GlobalAiProviderEntry,
  GlobalAiSettings,
} from "@/types";
import { getGlobalAiSettings } from "@services/tauri";
import { requiresOpenaiAuthWithoutAccount } from "@threads/hooks/threadAccountSnapshot";
import {
  OPENAI_PROVIDER_ID,
  resolveSelectedGlobalAiProvider,
} from "@utils/globalAiProvider";

type ResolveStartupAiSetupStateArgs = {
  activeAccount: AccountSnapshot | null;
  aiSettings: GlobalAiSettings | null;
  dismissedForSession: boolean;
  settingsOpen: boolean;
};

const LOCAL_BUILT_IN_PROVIDER_IDS = new Set(["ollama", "lmstudio"]);

function isUsableStartupProvider(
  providerId: string,
  provider: GlobalAiProviderEntry | null,
) {
  if (providerId === OPENAI_PROVIDER_ID) {
    return false;
  }
  if (LOCAL_BUILT_IN_PROVIDER_IDS.has(providerId)) {
    return true;
  }
  if (!provider) {
    return false;
  }
  return Boolean(provider.baseUrl?.trim() || provider.apiKey?.trim());
}

export function resolveStartupAiSetupState({
  activeAccount,
  aiSettings,
  dismissedForSession,
  settingsOpen,
}: ResolveStartupAiSetupStateArgs) {
  const { providerId, provider } = resolveSelectedGlobalAiProvider(aiSettings);
  const loginRequired =
    providerId === OPENAI_PROVIDER_ID &&
    requiresOpenaiAuthWithoutAccount(activeAccount);
  const providerIncomplete =
    providerId !== OPENAI_PROVIDER_ID &&
    !isUsableStartupProvider(providerId, provider);
  const showWizard =
    Boolean(aiSettings) &&
    !dismissedForSession &&
    !settingsOpen &&
    (loginRequired || providerIncomplete);

  return {
    showWizard,
    loginRequired,
    providerIncomplete,
    selectedProviderId: providerId,
    selectedProviderName: provider?.name?.trim() || providerId,
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Unable to load AI settings.";
}

export function useStartupAiSetup({
  activeAccount,
  settingsOpen,
}: {
  activeAccount: AccountSnapshot | null;
  settingsOpen: boolean;
}) {
  const [aiSettings, setAiSettings] = useState<GlobalAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const previousSettingsOpenRef = useRef(settingsOpen);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshAiSettings = useCallback(async () => {
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const refreshPromise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await getGlobalAiSettings();
        setAiSettings(next);
      } catch (nextError) {
        setError(toErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    setLoading(true);
    try {
      await refreshPromise;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refreshAiSettings();
  }, [refreshAiSettings]);

  useEffect(() => {
    if (previousSettingsOpenRef.current && !settingsOpen) {
      void refreshAiSettings();
    }
    previousSettingsOpenRef.current = settingsOpen;
  }, [refreshAiSettings, settingsOpen]);

  const resolvedState = useMemo(
    () =>
      resolveStartupAiSetupState({
        activeAccount,
        aiSettings,
        dismissedForSession,
        settingsOpen,
      }),
    [activeAccount, aiSettings, dismissedForSession, settingsOpen],
  );

  const dismissWizard = useCallback(() => {
    setDismissedForSession(true);
  }, []);

  return {
    ...resolvedState,
    aiSettings,
    loading,
    error,
    dismissWizard,
    refreshAiSettings,
  };
}
