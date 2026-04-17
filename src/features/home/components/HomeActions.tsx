import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";

type HomeActionsProps = {
  onAddWorkspace: () => void;
  onAddWorkspaceFromUrl: () => void;
};

export function HomeActions({
  onAddWorkspace,
  onAddWorkspaceFromUrl,
}: HomeActionsProps) {
  const locale = useAppLocale();
  return (
    <div className="home-actions">
      <button
        className="home-button primary home-add-workspaces-button"
        onClick={onAddWorkspace}
        data-tauri-drag-region="false"
      >
        <span className="home-icon" aria-hidden>
          +
        </span>
        {m.home_add_workspaces({}, { locale })}
      </button>
      <button
        className="home-button secondary home-add-workspace-from-url-button"
        onClick={onAddWorkspaceFromUrl}
        data-tauri-drag-region="false"
      >
        <span className="home-icon" aria-hidden>
          ⤓
        </span>
        {m.home_add_workspace_from_url({}, { locale })}
      </button>
    </div>
  );
}
