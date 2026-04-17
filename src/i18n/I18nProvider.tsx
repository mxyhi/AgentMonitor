import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { AppLanguage } from "@/types";
import { setLocale } from "@/i18n/runtime";
import { normalizeAppLanguage, writeStoredAppLanguage } from "./appLanguage";

const I18nContext = createContext<AppLanguage>("en");

type I18nProviderProps = {
  children: ReactNode;
  locale: AppLanguage;
};

export function I18nProvider({ children, locale }: I18nProviderProps) {
  const normalizedLocale = normalizeAppLanguage(locale);

  useEffect(() => {
    writeStoredAppLanguage(normalizedLocale);
    void Promise.resolve(setLocale(normalizedLocale, { reload: false }));
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalizedLocale;
    }
  }, [normalizedLocale]);

  return <I18nContext.Provider value={normalizedLocale}>{children}</I18nContext.Provider>;
}

export function useAppLocale(): AppLanguage {
  return useContext(I18nContext);
}
