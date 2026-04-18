import type { GlobalAiProviderEntry, GlobalAiSettings } from "@/types";

export const AIROUTER_PROVIDER_ID = "airouter";
export const OPENAI_PROVIDER_ID = "openai";
export const LOCAL_PROVIDER_ID = "local";

export const DEFAULT_AIROUTER_BASE_URL = "https://airouter.mxyhi.com/v1";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:9208/v1";

const ALLOWED_EMPTY_OR_V1_PATHS = new Set(["", "/", "/v1", "/v1/"]);

export type FixedGlobalAiProviderId =
  | typeof AIROUTER_PROVIDER_ID
  | typeof OPENAI_PROVIDER_ID
  | typeof LOCAL_PROVIDER_ID;

type FixedProviderDefinition = {
  id: FixedGlobalAiProviderId;
  name: string;
  defaultBaseUrl: string;
  apiKeyOptional: boolean;
};

const FIXED_PROVIDER_DEFINITIONS: FixedProviderDefinition[] = [
  {
    id: AIROUTER_PROVIDER_ID,
    name: "Airouter",
    defaultBaseUrl: DEFAULT_AIROUTER_BASE_URL,
    apiKeyOptional: false,
  },
  {
    id: OPENAI_PROVIDER_ID,
    name: "OpenAI",
    defaultBaseUrl: DEFAULT_OPENAI_BASE_URL,
    apiKeyOptional: false,
  },
  {
    id: LOCAL_PROVIDER_ID,
    name: "Local",
    defaultBaseUrl: DEFAULT_LOCAL_BASE_URL,
    apiKeyOptional: true,
  },
];

const FIXED_PROVIDER_DEFINITION_BY_ID = new Map(
  FIXED_PROVIDER_DEFINITIONS.map((definition) => [definition.id, definition] as const),
);

function normalizePath(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return normalized === "/" ? "/" : normalized;
}

function getFixedProviderDefinition(providerId: FixedGlobalAiProviderId) {
  return FIXED_PROVIDER_DEFINITION_BY_ID.get(providerId)!;
}

export function listFixedGlobalAiProviderDefinitions() {
  return [...FIXED_PROVIDER_DEFINITIONS];
}

export function normalizeGlobalAiProviderId(
  value: string | null | undefined,
): FixedGlobalAiProviderId {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case OPENAI_PROVIDER_ID:
      return OPENAI_PROVIDER_ID;
    case LOCAL_PROVIDER_ID:
    case "ollama":
    case "lmstudio":
      return LOCAL_PROVIDER_ID;
    case AIROUTER_PROVIDER_ID:
    default:
      return AIROUTER_PROVIDER_ID;
  }
}

export function getDefaultGlobalAiProviderBaseUrl(providerId: FixedGlobalAiProviderId) {
  return getFixedProviderDefinition(providerId).defaultBaseUrl;
}

export function isAllowedGlobalAiProviderBaseUrl(
  providerId: FixedGlobalAiProviderId,
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.search || parsed.hash) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol.toLowerCase();
  const pathname = normalizePath(parsed.pathname);
  if (!ALLOWED_EMPTY_OR_V1_PATHS.has(pathname)) {
    return false;
  }

  switch (providerId) {
    case AIROUTER_PROVIDER_ID:
      return (
        hostname === "airouter.mxyhi.com" &&
        (protocol === "https:" || protocol === "http:")
      );
    case OPENAI_PROVIDER_ID:
      return hostname === "api.openai.com" && protocol === "https:";
    case LOCAL_PROVIDER_ID:
      return (
        (hostname === "127.0.0.1" || hostname === "localhost") &&
        protocol === "http:"
      );
  }
}

function buildFixedProviderEntry(
  providerId: FixedGlobalAiProviderId,
  aiSettings: GlobalAiSettings | null,
): GlobalAiProviderEntry {
  const definition = getFixedProviderDefinition(providerId);
  const existing = aiSettings?.providers.find(
    (entry) => normalizeGlobalAiProviderId(entry.id) === providerId,
  );

  const normalizedBaseUrl =
    existing?.baseUrl?.trim() || definition.defaultBaseUrl;
  const normalizedApiKey = existing?.apiKey?.trim() || null;

  return {
    id: definition.id,
    name: existing?.name?.trim() || definition.name,
    baseUrl: normalizedBaseUrl,
    apiKey: normalizedApiKey,
    builtIn: true,
  };
}

export function listFixedGlobalAiProviders(aiSettings: GlobalAiSettings | null) {
  return FIXED_PROVIDER_DEFINITIONS.map((definition) =>
    buildFixedProviderEntry(definition.id, aiSettings),
  );
}

export function resolveSelectedGlobalAiProvider(
  aiSettings: GlobalAiSettings | null,
): {
  providerId: FixedGlobalAiProviderId;
  provider: GlobalAiProviderEntry;
  providers: GlobalAiProviderEntry[];
} {
  const providers = listFixedGlobalAiProviders(aiSettings);
  const providerId = normalizeGlobalAiProviderId(aiSettings?.sessionDefaults.modelProvider);
  const provider =
    providers.find((entry) => entry.id === providerId) ?? providers[0];

  return {
    providerId,
    provider,
    providers,
  };
}

export function selectedGlobalAiProviderRequiresOpenAiAuth(
  aiSettings: GlobalAiSettings | null,
) {
  const { providerId, provider } = resolveSelectedGlobalAiProvider(aiSettings);
  if (providerId !== OPENAI_PROVIDER_ID) {
    return false;
  }
  return !provider.apiKey?.trim();
}

export function isGlobalAiProviderConfigured(args: {
  providerId: FixedGlobalAiProviderId;
  provider: GlobalAiProviderEntry | null | undefined;
  loginRequired?: boolean;
}) {
  const { providerId, provider, loginRequired = false } = args;
  if (!provider) {
    return false;
  }

  if (!isAllowedGlobalAiProviderBaseUrl(providerId, provider.baseUrl)) {
    return false;
  }

  const apiKeyConfigured = Boolean(provider.apiKey?.trim());
  switch (providerId) {
    case AIROUTER_PROVIDER_ID:
      return apiKeyConfigured;
    case OPENAI_PROVIDER_ID:
      return apiKeyConfigured || !loginRequired;
    case LOCAL_PROVIDER_ID:
      return true;
  }
}

export function isGlobalAiProviderApiKeyOptional(providerId: FixedGlobalAiProviderId) {
  return getFixedProviderDefinition(providerId).apiKeyOptional;
}
