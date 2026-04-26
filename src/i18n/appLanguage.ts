import type { AppLanguage } from "@/types";

export const APP_LANGUAGE_STORAGE_KEY = "agent-monitor.app-language";

const APP_LANGUAGES = new Set<AppLanguage>(["en", "zh-CN"]);

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "en" || value === "zh-CN";
}

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage {
  if (isAppLanguage(value)) {
    return value;
  }
  return "en";
}

export function readStoredAppLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  return normalizeAppLanguage(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
}

export function writeStoredAppLanguage(language: AppLanguage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
}

export function appLanguages(): AppLanguage[] {
  return Array.from(APP_LANGUAGES);
}
