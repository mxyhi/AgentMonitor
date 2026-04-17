import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

type WorkspaceHomeGitInitBannerProps = {
  isLoading: boolean;
  onInitGitRepo: () => void | Promise<void>;
};

export function WorkspaceHomeGitInitBanner({
  isLoading,
  onInitGitRepo,
}: WorkspaceHomeGitInitBannerProps) {
  const locale = useAppLocale();
  return (
    <div
      className="workspace-home-git-banner"
      role="region"
      aria-label={m.workspace_home_git_setup({}, { locale })}
    >
      <div className="workspace-home-git-banner-title">
        {m.workspace_home_git_not_initialized({}, { locale })}
      </div>
      <div className="workspace-home-git-banner-actions">
        <button
          type="button"
          className="primary"
          onClick={() => void onInitGitRepo()}
          disabled={isLoading}
        >
          {isLoading
            ? m.git_initializing({}, { locale })
            : m.git_initialize({}, { locale })}
        </button>
      </div>
    </div>
  );
}
