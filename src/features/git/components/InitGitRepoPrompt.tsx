import { useEffect, useMemo, useRef } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import { ModalShell } from "../../design-system/components/modal/ModalShell";
import { validateBranchName } from "../utils/branchValidation";

type InitGitRepoPromptProps = {
  workspaceName: string;
  branch: string;
  createRemote: boolean;
  repoName: string;
  isPrivate: boolean;
  error?: string | null;
  isBusy?: boolean;
  onBranchChange: (value: string) => void;
  onCreateRemoteChange: (value: boolean) => void;
  onRepoNameChange: (value: string) => void;
  onPrivateChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function InitGitRepoPrompt({
  workspaceName,
  branch,
  createRemote,
  repoName,
  isPrivate,
  error = null,
  isBusy = false,
  onBranchChange,
  onCreateRemoteChange,
  onRepoNameChange,
  onPrivateChange,
  onCancel,
  onConfirm,
}: InitGitRepoPromptProps) {
  const locale = useAppLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const validationError = useMemo(() => {
    const trimmed = branch.trim();
    if (!trimmed) {
      return m.git_init_branch_required({}, { locale });
    }
    return validateBranchName(branch);
  }, [branch, locale]);

  const remoteValidationError = useMemo(() => {
    if (!createRemote) {
      return null;
    }
    const trimmed = repoName.trim();
    if (!trimmed) {
      return m.git_init_repo_required({}, { locale });
    }
    if (/\s/.test(trimmed)) {
      return m.git_init_repo_spaces({}, { locale });
    }
    return null;
  }, [createRemote, repoName, locale]);

  const combinedValidationError = validationError || remoteValidationError;
  const canSubmit = !isBusy && !combinedValidationError;

  return (
    <ModalShell
      className="git-init-modal"
      ariaLabel={m.git_init_title({}, { locale })}
      onBackdropClick={() => {
        if (!isBusy) {
          onCancel();
        }
      }}
    >
      <div className="ds-modal-title git-init-modal-title">
        {m.git_init_title({}, { locale })}
      </div>
      <div className="ds-modal-subtitle git-init-modal-subtitle">
        {m.git_init_subtitle({ value: workspaceName }, { locale })}
      </div>

      <label className="ds-modal-label git-init-modal-label" htmlFor="git-init-branch">
        {m.git_init_branch_label({}, { locale })}
      </label>
      <input
        id="git-init-branch"
        ref={inputRef}
        className="ds-modal-input git-init-modal-input"
        value={branch}
        placeholder={m.git_init_branch_placeholder({}, { locale })}
        disabled={isBusy}
        onChange={(event) => onBranchChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!isBusy) {
              onCancel();
            }
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (canSubmit) {
              onConfirm();
            }
          }
        }}
      />

      <label className="git-init-modal-checkbox-row">
        <input
          type="checkbox"
          className="git-init-modal-checkbox"
          checked={createRemote}
          disabled={isBusy}
          onChange={(event) => onCreateRemoteChange(event.target.checked)}
        />
        <span className="git-init-modal-checkbox-text">
          {m.git_init_create_remote({}, { locale })}
        </span>
      </label>

      {createRemote && (
        <div className="git-init-modal-remote">
          <label className="ds-modal-label git-init-modal-label" htmlFor="git-init-repo-name">
            {m.git_init_repo_label({}, { locale })}
          </label>
          <input
            id="git-init-repo-name"
            className="ds-modal-input git-init-modal-input"
            value={repoName}
            placeholder={m.git_init_repo_placeholder({}, { locale })}
            disabled={isBusy}
            onChange={(event) => onRepoNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                if (!isBusy) {
                  onCancel();
                }
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (canSubmit) {
                  onConfirm();
                }
              }
            }}
          />

          <label className="git-init-modal-checkbox-row git-init-modal-checkbox-row--nested">
            <input
              type="checkbox"
              className="git-init-modal-checkbox"
              checked={isPrivate}
              disabled={isBusy}
              onChange={(event) => onPrivateChange(event.target.checked)}
            />
            <span className="git-init-modal-checkbox-text">
              {m.git_init_private_repo({}, { locale })}
            </span>
          </label>
        </div>
      )}

      {(error || combinedValidationError) && (
        <div className="ds-modal-error git-init-modal-error">
          {error || combinedValidationError}
        </div>
      )}

      <div className="ds-modal-actions git-init-modal-actions">
        <button
          type="button"
          className="ghost ds-modal-button git-init-modal-button"
          onClick={onCancel}
          disabled={isBusy}
        >
          {m.sidebar_cancel({}, { locale })}
        </button>
        <button
          type="button"
          className="primary ds-modal-button git-init-modal-button"
          onClick={onConfirm}
          disabled={!canSubmit}
        >
          {isBusy
            ? m.git_init_initializing({}, { locale })
            : m.action_initialize({}, { locale })}
        </button>
      </div>
    </ModalShell>
  );
}
