import { useEffect, useRef } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "../../design-system/components/modal/ModalShell";

type RenameThreadPromptProps = {
  currentName: string;
  name: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RenameThreadPrompt({
  currentName,
  name,
  onChange,
  onCancel,
  onConfirm,
}: RenameThreadPromptProps) {
  const locale = useAppLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <ModalShell
      className="worktree-modal"
      onBackdropClick={onCancel}
      ariaLabel={m.rename_thread_title({}, { locale })}
    >
      <div className="ds-modal-title worktree-modal-title">
        {m.rename_thread_title({}, { locale })}
      </div>
      <div className="ds-modal-subtitle worktree-modal-subtitle">
        {m.rename_thread_current_name({ value: currentName }, { locale })}
      </div>
      <label className="ds-modal-label worktree-modal-label" htmlFor="thread-rename">
        {m.rename_thread_new_name({}, { locale })}
      </label>
      <input
        id="thread-rename"
        ref={inputRef}
        className="ds-modal-input worktree-modal-input"
        value={name}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onConfirm();
          }
        }}
      />
      <div className="ds-modal-actions worktree-modal-actions">
        <button
          className="ghost ds-modal-button worktree-modal-button"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="primary ds-modal-button worktree-modal-button"
          onClick={onConfirm}
          type="button"
          disabled={name.trim().length === 0}
        >
          {m.rename_thread_action({}, { locale })}
        </button>
      </div>
    </ModalShell>
  );
}
