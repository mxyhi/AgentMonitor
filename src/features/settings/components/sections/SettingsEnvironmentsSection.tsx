import type { Dispatch, SetStateAction } from "react";
import { SettingsSection } from "@/features/design-system/components/settings/SettingsPrimitives";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import type { WorkspaceInfo } from "@/types";
import { pushErrorToast } from "@services/toasts";

type SettingsEnvironmentsSectionProps = {
  mainWorkspaces: WorkspaceInfo[];
  environmentWorkspace: WorkspaceInfo | null;
  environmentSaving: boolean;
  environmentError: string | null;
  environmentDraftScript: string;
  environmentSavedScript: string | null;
  environmentDirty: boolean;
  globalWorktreesFolderDraft: string;
  globalWorktreesFolderSaved: string | null;
  globalWorktreesFolderDirty: boolean;
  worktreesFolderDraft: string;
  worktreesFolderSaved: string | null;
  worktreesFolderDirty: boolean;
  onSetEnvironmentWorkspaceId: Dispatch<SetStateAction<string | null>>;
  onSetEnvironmentDraftScript: Dispatch<SetStateAction<string>>;
  onSetGlobalWorktreesFolderDraft: Dispatch<SetStateAction<string>>;
  onSetWorktreesFolderDraft: Dispatch<SetStateAction<string>>;
  onSaveEnvironmentSetup: () => Promise<void>;
};

export function SettingsEnvironmentsSection({
  mainWorkspaces,
  environmentWorkspace,
  environmentSaving,
  environmentError,
  environmentDraftScript,
  environmentSavedScript,
  environmentDirty,
  globalWorktreesFolderDraft,
  globalWorktreesFolderSaved: _globalWorktreesFolderSaved,
  globalWorktreesFolderDirty,
  worktreesFolderDraft,
  worktreesFolderSaved: _worktreesFolderSaved,
  worktreesFolderDirty,
  onSetEnvironmentWorkspaceId,
  onSetEnvironmentDraftScript,
  onSetGlobalWorktreesFolderDraft,
  onSetWorktreesFolderDraft,
  onSaveEnvironmentSetup,
}: SettingsEnvironmentsSectionProps) {
  const locale = useAppLocale();
  const hasAnyChanges =
    environmentDirty || globalWorktreesFolderDirty || worktreesFolderDirty;
  const hasProjects = mainWorkspaces.length > 0;

  return (
    <SettingsSection
      title={m.environments_title({}, { locale })}
      subtitle={m.environments_subtitle({}, { locale })}
    >
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="settings-global-worktrees-folder">
          {m.environments_global_root_label({}, { locale })}
        </label>
        <div className="settings-help">
          {m.environments_global_root_help({}, { locale })}
        </div>
        <div className="settings-field-row">
          <input
            id="settings-global-worktrees-folder"
            type="text"
            className="settings-input"
            value={globalWorktreesFolderDraft}
            onChange={(event) => onSetGlobalWorktreesFolderDraft(event.target.value)}
            placeholder={m.environments_global_root_placeholder({}, { locale })}
            disabled={environmentSaving}
          />
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={async () => {
              try {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const selected = await open({
                  directory: true,
                  multiple: false,
                  title: m.environments_global_root_picker_title({}, { locale }),
                });
                if (selected && typeof selected === "string") {
                  onSetGlobalWorktreesFolderDraft(selected);
                }
              } catch (error) {
                pushErrorToast({
                  title: m.environments_picker_error_title({}, { locale }),
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            }}
            disabled={environmentSaving}
          >
            {m.action_browse({}, { locale })}
          </button>
        </div>
        {!hasProjects ? (
          <div className="settings-field-actions">
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => onSetGlobalWorktreesFolderDraft(_globalWorktreesFolderSaved ?? "")}
              disabled={environmentSaving || !globalWorktreesFolderDirty}
            >
              {m.action_reset({}, { locale })}
            </button>
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={() => {
                void onSaveEnvironmentSetup();
              }}
              disabled={environmentSaving || !globalWorktreesFolderDirty}
            >
              {environmentSaving
                ? m.action_saving({}, { locale })
                : m.action_save({}, { locale })}
            </button>
          </div>
        ) : null}
        {!hasProjects && environmentError ? (
          <div className="settings-agents-error">{environmentError}</div>
        ) : null}
      </div>

      {!hasProjects ? (
        <div className="settings-empty">{m.environments_no_projects({}, { locale })}</div>
      ) : (
        <>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-environment-project">
              {m.environments_project_label({}, { locale })}
            </label>
            <select
              id="settings-environment-project"
              className="settings-select"
              value={environmentWorkspace?.id ?? ""}
              onChange={(event) => onSetEnvironmentWorkspaceId(event.target.value)}
              disabled={environmentSaving}
            >
              {mainWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {environmentWorkspace ? (
              <div className="settings-help">{environmentWorkspace.path}</div>
            ) : null}
          </div>

          <div className="settings-field">
            <div className="settings-field-label">
              {m.environments_setup_script_label({}, { locale })}
            </div>
            <div className="settings-help">
              {m.environments_setup_script_help({}, { locale })}
            </div>
            {environmentError ? (
              <div className="settings-agents-error">{environmentError}</div>
            ) : null}
            <textarea
              className="settings-agents-textarea"
              value={environmentDraftScript}
              onChange={(event) => onSetEnvironmentDraftScript(event.target.value)}
              placeholder={m.environments_setup_script_placeholder({}, { locale })}
              spellCheck={false}
              disabled={environmentSaving}
            />
            <div className="settings-field-actions">
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
                  if (!clipboard?.writeText) {
                    pushErrorToast({
                      title: m.environments_copy_failed_title({}, { locale }),
                      message: m.environments_copy_failed_unavailable({}, { locale }),
                    });
                    return;
                  }

                  void clipboard.writeText(environmentDraftScript).catch(() => {
                    pushErrorToast({
                      title: m.environments_copy_failed_title({}, { locale }),
                      message: m.environments_copy_failed_write({}, { locale }),
                    });
                  });
                }}
                disabled={environmentSaving || environmentDraftScript.length === 0}
              >
                {m.action_copy({}, { locale })}
              </button>
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => onSetEnvironmentDraftScript(environmentSavedScript ?? "")}
                disabled={environmentSaving || !environmentDirty}
              >
                {m.action_reset({}, { locale })}
              </button>
              <button
                type="button"
                className="primary settings-button-compact"
                onClick={() => {
                  void onSaveEnvironmentSetup();
                }}
                disabled={environmentSaving || !hasAnyChanges}
              >
                {environmentSaving
                  ? m.action_saving({}, { locale })
                  : m.action_save({}, { locale })}
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-worktrees-folder">
              {m.environments_worktrees_folder_label({}, { locale })}
            </label>
            <div className="settings-help">
              {m.environments_worktrees_folder_help({}, { locale })}
            </div>
            <div className="settings-field-row">
              <input
                id="settings-worktrees-folder"
                type="text"
                className="settings-input"
                value={worktreesFolderDraft}
                onChange={(event) => onSetWorktreesFolderDraft(event.target.value)}
                placeholder={m.environments_worktrees_folder_placeholder({}, { locale })}
                disabled={environmentSaving}
              />
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={async () => {
                  try {
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      title: m.environments_worktrees_folder_picker_title({}, { locale }),
                    });
                    if (selected && typeof selected === "string") {
                      onSetWorktreesFolderDraft(selected);
                    }
                  } catch (error) {
                    pushErrorToast({
                      title: m.environments_picker_error_title({}, { locale }),
                      message: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                disabled={environmentSaving}
              >
                {m.action_browse({}, { locale })}
              </button>
            </div>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
