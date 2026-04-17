import { useEffect } from "react";
import { setLocale } from "@/i18n/runtime";
import { useThemePreference } from "../../layout/hooks/useThemePreference";
import { useTransparencyPreference } from "../../layout/hooks/useTransparencyPreference";
import { useUiScaleShortcuts } from "../../layout/hooks/useUiScaleShortcuts";
import { useAppSettings } from "../../settings/hooks/useAppSettings";
import { writeStoredAppLanguage } from "@/i18n/appLanguage";
import { runCodexUpdate } from "../../../services/tauri";

export function useAppSettingsController() {
  const {
    settings: appSettings,
    setSettings: setAppSettings,
    saveSettings,
    doctor,
    isLoading: appSettingsLoading,
  } = useAppSettings();

  useThemePreference(appSettings.theme);
  useEffect(() => {
    writeStoredAppLanguage(appSettings.appLanguage);
    void Promise.resolve(setLocale(appSettings.appLanguage, { reload: false }));
    document.documentElement.lang = appSettings.appLanguage;
  }, [appSettings.appLanguage]);
  const { reduceTransparency, setReduceTransparency } =
    useTransparencyPreference();

  const {
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
  } = useUiScaleShortcuts({
    settings: appSettings,
    setSettings: setAppSettings,
    saveSettings,
  });

  return {
    appSettings,
    setAppSettings,
    saveSettings,
    queueSaveSettings,
    doctor,
    codexUpdate: (codexBin: string | null, codexArgs: string | null) =>
      runCodexUpdate(codexBin, codexArgs),
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
  };
}
