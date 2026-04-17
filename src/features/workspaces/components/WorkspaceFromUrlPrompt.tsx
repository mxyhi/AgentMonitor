import { useEffect, useRef } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "../../design-system/components/modal/ModalShell";

type WorkspaceFromUrlPromptProps = {
  url: string;
  destinationPath: string;
  targetFolderName: string;
  error: string | null;
  isBusy: boolean;
  canSubmit: boolean;
  onUrlChange: (value: string) => void;
  onTargetFolderNameChange: (value: string) => void;
  onChooseDestinationPath: () => void;
  onClearDestinationPath: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WorkspaceFromUrlPrompt({
  url,
  destinationPath,
  targetFolderName,
  error,
  isBusy,
  canSubmit,
  onUrlChange,
  onTargetFolderNameChange,
  onChooseDestinationPath,
  onClearDestinationPath,
  onCancel,
  onConfirm,
}: WorkspaceFromUrlPromptProps) {
  const locale = useAppLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ModalShell
      ariaLabel={m.workspace_from_url_title({}, { locale })}
      className="workspace-from-url-modal"
      cardClassName="workspace-from-url-modal-card"
      onBackdropClick={() => {
        if (!isBusy) {
          onCancel();
        }
      }}
    >
      <div className="workspace-from-url-modal-content">
        <div className="ds-modal-title">{m.workspace_from_url_title({}, { locale })}</div>
        <label className="ds-modal-label" htmlFor="workspace-url-input">
          {m.workspace_from_url_remote_git_url({}, { locale })}
        </label>
        <input
          id="workspace-url-input"
          ref={inputRef}
          className="ds-modal-input"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={m.workspace_from_url_url_placeholder({}, { locale })}
        />
        <label className="ds-modal-label" htmlFor="workspace-url-target-name">
          {m.workspace_from_url_target_folder_name({}, { locale })}
        </label>
        <input
          id="workspace-url-target-name"
          className="ds-modal-input"
          value={targetFolderName}
          onChange={(event) => onTargetFolderNameChange(event.target.value)}
          placeholder={m.workspace_from_url_target_folder_placeholder({}, { locale })}
        />
        <label className="ds-modal-label" htmlFor="workspace-url-destination">
          {m.workspace_from_url_destination_parent({}, { locale })}
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            id="workspace-url-destination"
            className="ds-modal-input"
            value={destinationPath}
            placeholder={m.clone_prompt_not_set({}, { locale })}
            readOnly
            rows={1}
            wrap="off"
          />
          <button type="button" className="ghost ds-modal-button" onClick={onChooseDestinationPath}>
            Choose…
          </button>
          <button
            type="button"
            className="ghost ds-modal-button"
            onClick={onClearDestinationPath}
            disabled={destinationPath.trim().length === 0 || isBusy}
          >
            Clear
          </button>
        </div>
        {error && <div className="ds-modal-error">{error}</div>}
        <div className="ds-modal-actions">
          <button className="ghost ds-modal-button" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
          <button
            className="primary ds-modal-button"
            onClick={onConfirm}
            disabled={isBusy || !canSubmit}
          >
            {isBusy
              ? m.workspace_from_url_cloning({}, { locale })
              : m.workspace_from_url_clone_and_add({}, { locale })}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
