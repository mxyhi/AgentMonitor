import type { ReactNode } from "react";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

type FileEditorCardClassNames = {
  container: string;
  header: string;
  title: string;
  actions: string;
  meta: string;
  iconButton: string;
  error: string;
  textarea: string;
  help: string;
};

type FileEditorCardProps = {
  title: string;
  meta?: string;
  error?: string | null;
  value: string;
  placeholder?: string;
  helpText?: ReactNode;
  disabled?: boolean;
  refreshDisabled?: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  classNames: FileEditorCardClassNames;
};

export function FileEditorCard({
  title,
  meta,
  error,
  value,
  placeholder,
  helpText,
  disabled,
  refreshDisabled,
  saveDisabled,
  saveLabel,
  onChange,
  onRefresh,
  onSave,
  classNames,
}: FileEditorCardProps) {
  const locale = useAppLocale();
  return (
    <div className={classNames.container}>
      <div className={classNames.header}>
        <div className={classNames.title}>{title}</div>
        <div className={classNames.actions}>
          {meta ? <div className={classNames.meta}>{meta}</div> : null}
          <button
            type="button"
            className={classNames.iconButton}
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label={m.file_editor_refresh_aria({ value: title }, { locale })}
            title={m.file_editor_refresh({}, { locale })}
          >
            <RefreshCw aria-hidden />
          </button>
          <button
            type="button"
            className={classNames.iconButton}
            onClick={onSave}
            disabled={saveDisabled}
            aria-label={
              saveLabel === "Create"
                ? m.file_editor_create_aria({ value: title }, { locale })
                : m.file_editor_save_aria({ value: title }, { locale })
            }
            title={saveLabel}
          >
            <Save aria-hidden />
          </button>
        </div>
      </div>
      {error ? <div className={classNames.error}>{error}</div> : null}
      <textarea
        className={classNames.textarea}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        disabled={disabled}
      />
      {helpText ? <div className={classNames.help}>{helpText}</div> : null}
    </div>
  );
}
