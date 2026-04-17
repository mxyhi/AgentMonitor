import type { AppSettings, DictationModelStatus } from "@/types";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { formatDownloadSize } from "@utils/formatting";

type DictationModelOption = {
  id: string;
  label: string;
  size: string;
  note: string;
};

type SettingsDictationSectionProps = {
  appSettings: AppSettings;
  optionKeyLabel: string;
  metaKeyLabel: string;
  dictationModels: DictationModelOption[];
  selectedDictationModel: DictationModelOption;
  dictationModelStatus?: DictationModelStatus | null;
  dictationReady: boolean;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onDownloadDictationModel?: () => void;
  onCancelDictationDownload?: () => void;
  onRemoveDictationModel?: () => void;
};

export function SettingsDictationSection({
  appSettings,
  optionKeyLabel,
  metaKeyLabel,
  dictationModels,
  selectedDictationModel,
  dictationModelStatus,
  dictationReady,
  onUpdateAppSettings,
  onDownloadDictationModel,
  onCancelDictationDownload,
  onRemoveDictationModel,
}: SettingsDictationSectionProps) {
  const locale = useAppLocale();
  const dictationProgress = dictationModelStatus?.progress ?? null;

  return (
    <SettingsSection
      title={m.dictation_title({}, { locale })}
      subtitle={m.dictation_subtitle({}, { locale })}
    >
      <SettingsToggleRow
        title={m.dictation_enable_title({}, { locale })}
        subtitle={m.dictation_enable_subtitle({}, { locale })}
      >
        <SettingsToggleSwitch
          pressed={appSettings.dictationEnabled}
          onClick={() => {
            const nextEnabled = !appSettings.dictationEnabled;
            void onUpdateAppSettings({
              ...appSettings,
              dictationEnabled: nextEnabled,
            });
            if (
              !nextEnabled &&
              dictationModelStatus?.state === "downloading" &&
              onCancelDictationDownload
            ) {
              onCancelDictationDownload();
            }
            if (
              nextEnabled &&
              dictationModelStatus?.state === "missing" &&
              onDownloadDictationModel
            ) {
              onDownloadDictationModel();
            }
          }}
        />
      </SettingsToggleRow>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-model">
          {m.dictation_model_label({}, { locale })}
        </label>
        <select
          id="dictation-model"
          className="settings-select"
          value={appSettings.dictationModelId}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationModelId: event.target.value,
            })
          }
        >
          {dictationModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} ({model.size})
            </option>
          ))}
        </select>
        <div className="settings-help">
          {m.dictation_model_help(
            { note: selectedDictationModel.note, size: selectedDictationModel.size },
            { locale },
          )}
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-language">
          {m.dictation_language_label({}, { locale })}
        </label>
        <select
          id="dictation-language"
          className="settings-select"
          value={appSettings.dictationPreferredLanguage ?? ""}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationPreferredLanguage: event.target.value || null,
            })
          }
        >
          <option value="">{m.dictation_language_auto({}, { locale })}</option>
          <option value="en">{m.dictation_language_option_en({}, { locale })}</option>
          <option value="es">{m.dictation_language_option_es({}, { locale })}</option>
          <option value="fr">{m.dictation_language_option_fr({}, { locale })}</option>
          <option value="de">{m.dictation_language_option_de({}, { locale })}</option>
          <option value="it">{m.dictation_language_option_it({}, { locale })}</option>
          <option value="pt">{m.dictation_language_option_pt({}, { locale })}</option>
          <option value="nl">{m.dictation_language_option_nl({}, { locale })}</option>
          <option value="sv">{m.dictation_language_option_sv({}, { locale })}</option>
          <option value="no">{m.dictation_language_option_no({}, { locale })}</option>
          <option value="da">{m.dictation_language_option_da({}, { locale })}</option>
          <option value="fi">{m.dictation_language_option_fi({}, { locale })}</option>
          <option value="pl">{m.dictation_language_option_pl({}, { locale })}</option>
          <option value="tr">{m.dictation_language_option_tr({}, { locale })}</option>
          <option value="ru">{m.dictation_language_option_ru({}, { locale })}</option>
          <option value="uk">{m.dictation_language_option_uk({}, { locale })}</option>
          <option value="ja">{m.dictation_language_option_ja({}, { locale })}</option>
          <option value="ko">{m.dictation_language_option_ko({}, { locale })}</option>
          <option value="zh">{m.dictation_language_option_zh({}, { locale })}</option>
        </select>
        <div className="settings-help">
          {m.dictation_language_help({}, { locale })}
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-hold-key">
          {m.dictation_hold_key_label({}, { locale })}
        </label>
        <select
          id="dictation-hold-key"
          className="settings-select"
          value={appSettings.dictationHoldKey ?? ""}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationHoldKey: event.target.value,
            })
          }
        >
          <option value="">{m.dictation_hold_key_off({}, { locale })}</option>
          <option value="alt">{optionKeyLabel}</option>
          <option value="shift">{m.dictation_hold_key_shift({}, { locale })}</option>
          <option value="control">{m.dictation_hold_key_control({}, { locale })}</option>
          <option value="meta">{metaKeyLabel}</option>
        </select>
        <div className="settings-help">
          {m.dictation_hold_key_help({}, { locale })}
        </div>
      </div>
      {dictationModelStatus && (
        <div className="settings-field">
          <div className="settings-field-label">
            {m.dictation_status_label(
              { model: selectedDictationModel.label },
              { locale },
            )}
          </div>
          <div className="settings-help">
            {dictationModelStatus.state === "ready" &&
              m.dictation_status_ready({}, { locale })}
            {dictationModelStatus.state === "missing" &&
              m.dictation_status_missing({}, { locale })}
            {dictationModelStatus.state === "downloading" &&
              m.dictation_status_downloading({}, { locale })}
            {dictationModelStatus.state === "error" &&
              (dictationModelStatus.error ??
                m.dictation_status_error_default({}, { locale }))}
          </div>
          {dictationProgress && (
            <div className="settings-download-progress">
              <div className="settings-download-bar">
                <div
                  className="settings-download-fill"
                  style={{
                    width: dictationProgress.totalBytes
                      ? `${Math.min(
                          100,
                          (dictationProgress.downloadedBytes / dictationProgress.totalBytes) * 100,
                        )}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="settings-download-meta">
                {formatDownloadSize(dictationProgress.downloadedBytes)}
              </div>
            </div>
          )}
          <div className="settings-field-actions">
            {dictationModelStatus.state === "missing" && (
              <button
                type="button"
                className="primary"
                onClick={onDownloadDictationModel}
                disabled={!onDownloadDictationModel}
              >
                {m.dictation_download_model({}, { locale })}
              </button>
            )}
            {dictationModelStatus.state === "downloading" && (
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={onCancelDictationDownload}
                disabled={!onCancelDictationDownload}
              >
                {m.dictation_cancel_download({}, { locale })}
              </button>
            )}
            {dictationReady && (
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={onRemoveDictationModel}
                disabled={!onRemoveDictationModel}
              >
                {m.dictation_remove_model({}, { locale })}
              </button>
            )}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
