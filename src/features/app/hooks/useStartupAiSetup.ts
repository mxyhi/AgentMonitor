import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountSnapshot, GlobalAiSettings } from "@/types";
import {
  getGlobalAiSettings,
  type UpdateAiProviderSettingsInput,
  updateAiProviderSettings,
} from "@services/tauri";
import { requiresOpenaiAuthWithoutAccount } from "@threads/hooks/threadAccountSnapshot";
import {
  AIROUTER_PROVIDER_ID,
  getDefaultGlobalAiProviderBaseUrl,
  isGlobalAiProviderConfigured,
  resolveSelectedGlobalAiProvider,
} from "@utils/globalAiProvider";

type ResolveStartupAiSetupStateArgs = {
  activeAccount: AccountSnapshot | null;
  aiSettings: GlobalAiSettings | null;
  dismissedForSession: boolean;
  settingsOpen: boolean;
};

export function resolveStartupAiSetupState({
  activeAccount,
  aiSettings,
  dismissedForSession,
  settingsOpen,
}: ResolveStartupAiSetupStateArgs) {
  const { providerId, provider, providers } = resolveSelectedGlobalAiProvider(aiSettings);
  const loginRequired = requiresOpenaiAuthWithoutAccount(activeAccount);
  const providerIncomplete = !isGlobalAiProviderConfigured({
    providerId,
    provider,
    loginRequired,
  });
  const showWizard =
    Boolean(aiSettings) &&
    !dismissedForSession &&
    !settingsOpen &&
    providerIncomplete;

  return {
    showWizard,
    loginRequired,
    providerIncomplete,
    providers,
    selectedProviderId: providerId || AIROUTER_PROVIDER_ID,
    selectedProviderName: provider?.name?.trim() || "Airouter",
    configuredBaseUrl:
      provider?.baseUrl?.trim() || getDefaultGlobalAiProviderBaseUrl(providerId),
    apiKeyConfigured: Boolean(provider?.apiKey?.trim()),
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
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
  const [savingProviderSettings, setSavingProviderSettings] = useState(false);
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
        setError(toErrorMessage(nextError, "Unable to load AI settings."));
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

  const saveAiProviderSettings = useCallback(
    async (input: UpdateAiProviderSettingsInput): Promise<boolean> => {
      setSavingProviderSettings(true);
      setError(null);
      try {
        const next = await updateAiProviderSettings(input);
        setAiSettings(next);
        setDismissedForSession(false);
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Unable to save AI settings."));
        return false;
      } finally {
        setSavingProviderSettings(false);
      }
    },
    [],
  );

  return {
    ...resolvedState,
    aiSettings,
    loading,
    error,
    dismissWizard,
    refreshAiSettings,
    savingProviderSettings,
    saveAiProviderSettings,
  };
}
