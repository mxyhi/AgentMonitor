import type { GlobalAiProviderEntry, GlobalAiSettings } from "@/types";

export const OPENAI_PROVIDER_ID = "openai";

export function normalizeGlobalAiProviderId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : OPENAI_PROVIDER_ID;
}

export function resolveSelectedGlobalAiProvider(
  aiSettings: GlobalAiSettings | null,
): {
  providerId: string;
  provider: GlobalAiProviderEntry | null;
} {
  const providerId = normalizeGlobalAiProviderId(
    aiSettings?.sessionDefaults.modelProvider,
  );
  const provider =
    aiSettings?.providers.find((entry) => entry.id === providerId) ??
    aiSettings?.providers.find((entry) => entry.id === OPENAI_PROVIDER_ID) ??
    null;

  return {
    providerId,
    provider,
  };
}

export function selectedGlobalAiProviderRequiresOpenAiAuth(
  aiSettings: GlobalAiSettings | null,
) {
  return resolveSelectedGlobalAiProvider(aiSettings).providerId === OPENAI_PROVIDER_ID;
}
