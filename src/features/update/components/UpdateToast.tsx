import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";
import type { PostUpdateNoticeState, UpdateState } from "../hooks/useUpdater";
import {
  ToastActions,
  ToastBody,
  ToastCard,
  ToastError,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "../../design-system/components/toast/ToastPrimitives";

type UpdateToastProps = {
  state: UpdateState;
  onUpdate: () => void;
  onDismiss: () => void;
  postUpdateNotice?: PostUpdateNoticeState;
  onDismissPostUpdateNotice?: () => void;
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function UpdateToast({
  state,
  onUpdate,
  onDismiss,
  postUpdateNotice = null,
  onDismissPostUpdateNotice,
}: UpdateToastProps) {
  const locale = useAppLocale();
  if (postUpdateNotice) {
    return (
      <ToastViewport className="update-toasts" role="region" ariaLive="polite">
        <ToastCard className="update-toast" role="status">
          <ToastHeader className="update-toast-header">
            <ToastTitle className="update-toast-title">
              {m.update_whats_new({}, { locale })}
            </ToastTitle>
            <div className="update-toast-version">v{postUpdateNotice.version}</div>
          </ToastHeader>
          {postUpdateNotice.stage === "loading" ? (
            <ToastBody className="update-toast-body">
              {m.update_loading_notes({}, { locale })}
            </ToastBody>
          ) : null}
          {postUpdateNotice.stage === "ready" ? (
            <>
              <ToastBody className="update-toast-body">
                {m.update_ready_body({}, { locale })}
              </ToastBody>
              <div className="update-toast-notes" role="document">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      if (!href) {
                        return <span>{children}</span>;
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => {
                            event.preventDefault();
                            void openUrl(href);
                          }}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {postUpdateNotice.body}
                </ReactMarkdown>
              </div>
            </>
          ) : null}
          {postUpdateNotice.stage === "fallback" ? (
            <ToastBody className="update-toast-body">
              {m.update_fallback_body(
                { version: postUpdateNotice.version },
                { locale },
              )}
            </ToastBody>
          ) : null}
          <ToastActions className="update-toast-actions">
            {postUpdateNotice.stage !== "loading" ? (
              <button
                className="primary"
                onClick={() => {
                  void openUrl(postUpdateNotice.htmlUrl);
                }}
              >
                {m.update_view_on_github({}, { locale })}
              </button>
            ) : null}
            <button
              className="secondary"
              onClick={onDismissPostUpdateNotice ?? onDismiss}
            >
              {m.update_dismiss({}, { locale })}
            </button>
          </ToastActions>
        </ToastCard>
      </ToastViewport>
    );
  }

  if (state.stage === "idle") {
    return null;
  }

  const totalBytes = state.progress?.totalBytes;
  const downloadedBytes = state.progress?.downloadedBytes ?? 0;
  const percent =
    totalBytes && totalBytes > 0
      ? Math.min(100, (downloadedBytes / totalBytes) * 100)
      : null;

  return (
    <ToastViewport className="update-toasts" role="region" ariaLive="polite">
      <ToastCard className="update-toast" role="status">
        <ToastHeader className="update-toast-header">
          <ToastTitle className="update-toast-title">
            {m.update_title({}, { locale })}
          </ToastTitle>
          {state.version ? (
            <div className="update-toast-version">v{state.version}</div>
          ) : null}
        </ToastHeader>
        {state.stage === "checking" && (
          <ToastBody className="update-toast-body">
            {m.update_checking({}, { locale })}
          </ToastBody>
        )}
        {state.stage === "available" && (
          <>
            <ToastBody className="update-toast-body">
              {m.update_available({}, { locale })}
            </ToastBody>
            <ToastActions className="update-toast-actions">
              <button className="secondary" onClick={onDismiss}>
                {m.update_later({}, { locale })}
              </button>
              <button className="primary" onClick={onUpdate}>
                {m.update_action({}, { locale })}
              </button>
            </ToastActions>
          </>
        )}
        {state.stage === "latest" && (
          <div className="update-toast-inline">
            <ToastBody className="update-toast-body update-toast-body-inline">
              {m.update_latest({}, { locale })}
            </ToastBody>
            <button className="secondary" onClick={onDismiss}>
              {m.update_dismiss({}, { locale })}
            </button>
          </div>
        )}
        {state.stage === "downloading" && (
          <>
            <ToastBody className="update-toast-body">
              {m.update_downloading({}, { locale })}
            </ToastBody>
            <div className="update-toast-progress">
              <div className="update-toast-progress-bar">
                <span
                  className="update-toast-progress-fill"
                  style={{ width: percent ? `${percent}%` : "24%" }}
                />
              </div>
              <div className="update-toast-progress-meta">
                {totalBytes
                  ? m.update_download_progress(
                      {
                        downloaded: formatBytes(downloadedBytes),
                        total: formatBytes(totalBytes),
                      },
                      { locale },
                    )
                  : m.update_downloaded(
                      { value: formatBytes(downloadedBytes) },
                      { locale },
                    )}
              </div>
            </div>
          </>
        )}
        {state.stage === "installing" && (
          <ToastBody className="update-toast-body">
            {m.update_installing({}, { locale })}
          </ToastBody>
        )}
        {state.stage === "restarting" && (
          <ToastBody className="update-toast-body">
            {m.update_restarting({}, { locale })}
          </ToastBody>
        )}
        {state.stage === "error" && (
          <>
            <ToastBody className="update-toast-body">
              {m.update_failed({}, { locale })}
            </ToastBody>
            {state.error ? (
              <ToastError className="update-toast-error">{state.error}</ToastError>
            ) : null}
            <ToastActions className="update-toast-actions">
              <button className="secondary" onClick={onDismiss}>
                {m.update_dismiss({}, { locale })}
              </button>
              <button className="primary" onClick={onUpdate}>
                {m.update_retry({}, { locale })}
              </button>
            </ToastActions>
          </>
        )}
      </ToastCard>
    </ToastViewport>
  );
}
