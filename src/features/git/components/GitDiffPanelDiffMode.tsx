import type { MouseEvent as ReactMouseEvent } from "react";
import {
  MagicSparkleIcon,
  MagicSparkleLoaderIcon,
} from "@/features/shared/components/MagicSparkleIcon";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import Download from "lucide-react/dist/esm/icons/download";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Upload from "lucide-react/dist/esm/icons/upload";
import { CommitButton, DiffSection, type DiffFile } from "./GitDiffPanelShared";
import {
  DEPTH_OPTIONS,
  isGitRootNotFound,
  isMissingRepo,
  normalizeRootPath,
} from "./GitDiffPanel.utils";

type GitDiffModeContentProps = {
  error: string | null | undefined;
  showGitRootPanel: boolean;
  onScanGitRoots?: () => void;
  gitRootScanLoading: boolean;
  gitRootScanDepth: number;
  onGitRootScanDepthChange?: (depth: number) => void;
  onPickGitRoot?: () => void | Promise<void>;
  onInitGitRepo?: () => void | Promise<void>;
  initGitRepoLoading: boolean;
  hasGitRoot: boolean;
  onClearGitRoot?: () => void;
  gitRootScanError: string | null | undefined;
  gitRootScanHasScanned: boolean;
  gitRootCandidates: string[];
  gitRoot: string | null;
  onSelectGitRoot?: (path: string) => void;
  showGenerateCommitMessage: boolean;
  showApplyWorktree: boolean;
  commitMessage: string;
  onCommitMessageChange?: (value: string) => void;
  commitMessageLoading: boolean;
  canGenerateCommitMessage: boolean;
  onGenerateCommitMessage?: () => void | Promise<void>;
  worktreeApplyTitle: string | null;
  worktreeApplyLoading: boolean;
  worktreeApplySuccess: boolean;
  onApplyWorktreeChanges?: () => void | Promise<void>;
  stagedFiles: DiffFile[];
  unstagedFiles: DiffFile[];
  commitLoading: boolean;
  onCommit?: () => void | Promise<void>;
  commitsAhead: number;
  commitsBehind: number;
  onPull?: () => void | Promise<void>;
  pullLoading: boolean;
  onPush?: () => void | Promise<void>;
  pushLoading: boolean;
  onSync?: () => void | Promise<void>;
  syncLoading: boolean;
  onStageAllChanges?: () => void | Promise<void>;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onDiscardFile?: (path: string) => Promise<void> | void;
  onDiscardFiles?: (paths: string[]) => Promise<void> | void;
  onReviewUncommittedChanges?: () => void | Promise<void>;
  selectedFiles: Set<string>;
  selectedPath: string | null;
  onSelectFile?: (path: string) => void;
  onFileClick: (
    event: ReactMouseEvent<HTMLDivElement>,
    path: string,
    section: "staged" | "unstaged",
  ) => void;
  onShowFileMenu: (
    event: ReactMouseEvent<HTMLDivElement>,
    path: string,
    section: "staged" | "unstaged",
  ) => void;
  onDiffListClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

export function GitDiffModeContent({
  error,
  showGitRootPanel,
  onScanGitRoots,
  gitRootScanLoading,
  gitRootScanDepth,
  onGitRootScanDepthChange,
  onPickGitRoot,
  onInitGitRepo,
  initGitRepoLoading,
  hasGitRoot,
  onClearGitRoot,
  gitRootScanError,
  gitRootScanHasScanned,
  gitRootCandidates,
  gitRoot,
  onSelectGitRoot,
  showGenerateCommitMessage,
  showApplyWorktree,
  commitMessage,
  onCommitMessageChange,
  commitMessageLoading,
  canGenerateCommitMessage,
  onGenerateCommitMessage,
  worktreeApplyTitle,
  worktreeApplyLoading,
  worktreeApplySuccess,
  onApplyWorktreeChanges,
  stagedFiles,
  unstagedFiles,
  commitLoading,
  onCommit,
  commitsAhead,
  commitsBehind,
  onPull,
  pullLoading,
  onPush,
  pushLoading,
  onSync,
  syncLoading,
  onStageAllChanges,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onDiscardFiles,
  onReviewUncommittedChanges,
  selectedFiles,
  selectedPath,
  onSelectFile,
  onFileClick,
  onShowFileMenu,
  onDiffListClick,
}: GitDiffModeContentProps) {
  const locale = useAppLocale();
  const normalizedGitRoot = normalizeRootPath(gitRoot);
  const missingRepo = isMissingRepo(error);
  const gitRootNotFound = isGitRootNotFound(error);
  const showInitGitRepo = Boolean(onInitGitRepo) && missingRepo && !gitRootNotFound;
  const gitRootTitle = gitRootNotFound
    ? m.git_root_not_found({}, { locale })
    : missingRepo
      ? m.git_root_missing_repo({}, { locale })
      : m.git_root_choose_repo({}, { locale });
  const generateCommitMessageTooltip = m.git_generate_commit_message({}, { locale });
  const showWorktreeApplyInUnstaged = showApplyWorktree && unstagedFiles.length > 0;
  const showWorktreeApplyInStaged =
    showApplyWorktree && unstagedFiles.length === 0 && stagedFiles.length > 0;

  return (
    <div className="diff-list" onClick={onDiffListClick}>
      {showGitRootPanel && (
        <div className="git-root-panel">
          <div className="git-root-title">{gitRootTitle}</div>
          {showInitGitRepo && (
            <div className="git-root-primary-action">
              <button
                type="button"
                className="primary git-root-button"
                onClick={() => {
                  void onInitGitRepo?.();
                }}
                disabled={initGitRepoLoading || gitRootScanLoading}
              >
                {initGitRepoLoading
                  ? m.git_initializing({}, { locale })
                  : m.git_initialize({}, { locale })}
              </button>
            </div>
          )}
          <div className="git-root-actions">
            <button
              type="button"
              className="ghost git-root-button"
              onClick={onScanGitRoots}
              disabled={!onScanGitRoots || gitRootScanLoading || initGitRepoLoading}
            >
              {m.git_scan_workspace({}, { locale })}
            </button>
            <label className="git-root-depth">
              <span>{m.git_depth({}, { locale })}</span>
              <select
                className="git-root-select"
                value={gitRootScanDepth}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isNaN(value)) {
                    onGitRootScanDepthChange?.(value);
                  }
                }}
                disabled={gitRootScanLoading || initGitRepoLoading}
              >
                {DEPTH_OPTIONS.map((depth) => (
                  <option key={depth} value={depth}>
                    {depth}
                  </option>
                ))}
              </select>
            </label>
            {onPickGitRoot && (
              <button
                type="button"
                className="ghost git-root-button"
                onClick={() => {
                  void onPickGitRoot();
                }}
                disabled={gitRootScanLoading || initGitRepoLoading}
              >
                {m.git_pick_folder({}, { locale })}
              </button>
            )}
            {hasGitRoot && onClearGitRoot && (
              <button
                type="button"
                className="ghost git-root-button"
                onClick={onClearGitRoot}
                disabled={gitRootScanLoading || initGitRepoLoading}
              >
                {m.git_use_workspace_root({}, { locale })}
              </button>
            )}
          </div>
          {gitRootScanLoading && (
            <div className="diff-empty">{m.git_scanning_repositories({}, { locale })}</div>
          )}
          {!gitRootScanLoading &&
            !gitRootScanError &&
            gitRootScanHasScanned &&
            gitRootCandidates.length === 0 && (
              <div className="diff-empty">{m.git_no_repositories_found({}, { locale })}</div>
            )}
          {gitRootCandidates.length > 0 && (
            <div className="git-root-list">
              {gitRootCandidates.map((path) => {
                const normalizedPath = normalizeRootPath(path);
                const isActive = normalizedGitRoot && normalizedGitRoot === normalizedPath;
                return (
                  <button
                    key={path}
                    type="button"
                    className={`git-root-item ${isActive ? "active" : ""}`}
                    onClick={() => onSelectGitRoot?.(path)}
                  >
                    <span className="git-root-path">{path}</span>
                    {isActive && <span className="git-root-tag">{m.git_active({}, { locale })}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showGenerateCommitMessage && (
        <div className="commit-message-section">
          <div className="commit-message-input-wrapper">
            <textarea
              className="commit-message-input"
              placeholder={m.git_commit_message_placeholder({}, { locale })}
              value={commitMessage}
              onChange={(event) => onCommitMessageChange?.(event.target.value)}
              disabled={commitMessageLoading}
              rows={2}
            />
            <button
              type="button"
              className="commit-message-generate-button diff-row-action ds-tooltip-trigger"
              onClick={() => {
                if (!canGenerateCommitMessage) {
                  return;
                }
                void onGenerateCommitMessage?.();
              }}
              disabled={commitMessageLoading || !canGenerateCommitMessage}
              title={generateCommitMessageTooltip}
              data-tooltip={generateCommitMessageTooltip}
              data-tooltip-placement="bottom"
              data-tooltip-align="end"
              aria-label={m.git_generate_commit_message({}, { locale })}
            >
              {commitMessageLoading ? (
                <MagicSparkleLoaderIcon className="commit-message-loader" />
              ) : (
                <MagicSparkleIcon />
              )}
            </button>
          </div>
          <CommitButton
            commitMessage={commitMessage}
            hasStagedFiles={stagedFiles.length > 0}
            hasUnstagedFiles={unstagedFiles.length > 0}
            commitLoading={commitLoading}
            onCommit={onCommit}
          />
        </div>
      )}
      {(commitsAhead > 0 || commitsBehind > 0) && !stagedFiles.length && (
        <div className="push-section">
          <div className="push-sync-buttons">
            {commitsBehind > 0 && (
              <button
                type="button"
                className="push-button-secondary"
                onClick={() => void onPull?.()}
                disabled={!onPull || pullLoading || syncLoading}
                title={`${m.action_pull({}, { locale })} ${
                  commitsBehind > 1
                    ? m.git_status_commit_count({ count: commitsBehind }, { locale })
                    : m.git_status_commit_single({}, { locale })
                }`}
              >
                {pullLoading ? (
                  <span className="commit-button-spinner" aria-hidden />
                ) : (
                  <Download size={14} aria-hidden />
                )}
                <span>
                  {pullLoading ? `${m.action_pull({}, { locale })}...` : m.action_pull({}, { locale })}
                </span>
                <span className="push-count">{commitsBehind}</span>
              </button>
            )}
            {commitsAhead > 0 && (
              <button
                type="button"
                className="push-button"
                onClick={() => void onPush?.()}
                disabled={!onPush || pushLoading || commitsBehind > 0}
                title={
                  commitsBehind > 0
                    ? `${m.action_pull({}, { locale })} first, or use ${m.action_sync({}, {
                        locale,
                      })}.`
                    : `${m.git_push({}, { locale })} ${
                        commitsAhead > 1
                          ? m.git_status_commit_count({ count: commitsAhead }, { locale })
                          : m.git_status_commit_single({}, { locale })
                      }`
                }
              >
                {pushLoading ? (
                  <span className="commit-button-spinner" aria-hidden />
                ) : (
                  <Upload size={14} aria-hidden />
                )}
                <span>{m.git_push({}, { locale })}</span>
                <span className="push-count">{commitsAhead}</span>
              </button>
            )}
          </div>
          {commitsAhead > 0 && commitsBehind > 0 && (
            <button
              type="button"
              className="push-button-secondary"
              onClick={() => void onSync?.()}
              disabled={!onSync || syncLoading || pullLoading}
              title={m.git_pull_and_push_local_commits({}, { locale })}
            >
              {syncLoading ? (
                <span className="commit-button-spinner" aria-hidden />
              ) : (
                <RotateCcw size={14} aria-hidden />
              )}
              <span>
                {syncLoading
                  ? `${m.action_sync({}, { locale })}...`
                  : `${m.action_sync({}, { locale })} (${m.action_pull({}, { locale })} then ${
                      m.git_push({}, { locale })
                    })`}
              </span>
            </button>
          )}
        </div>
      )}
      {!error &&
        !stagedFiles.length &&
        !unstagedFiles.length &&
        commitsAhead === 0 &&
        commitsBehind === 0 && (
          <div className="diff-empty">{m.git_no_changes_detected({}, { locale })}</div>
        )}
      {(stagedFiles.length > 0 || unstagedFiles.length > 0) && (
        <>
          {stagedFiles.length > 0 && (
            <DiffSection
              title={m.git_staged({}, { locale })}
              files={stagedFiles}
              section="staged"
              selectedFiles={selectedFiles}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onUnstageFile={onUnstageFile}
              onDiscardFile={onDiscardFile}
              onDiscardFiles={onDiscardFiles}
              showWorktreeApplyAction={showWorktreeApplyInStaged}
              worktreeApplyTitle={worktreeApplyTitle}
              worktreeApplyLoading={worktreeApplyLoading}
              worktreeApplySuccess={worktreeApplySuccess}
              onApplyWorktreeChanges={onApplyWorktreeChanges}
              onFileClick={onFileClick}
              onShowFileMenu={onShowFileMenu}
            />
          )}
          {unstagedFiles.length > 0 && (
            <DiffSection
              title={m.git_unstaged({}, { locale })}
              files={unstagedFiles}
              section="unstaged"
              selectedFiles={selectedFiles}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onStageAllChanges={onStageAllChanges}
              onStageFile={onStageFile}
              onDiscardFile={onDiscardFile}
              onDiscardFiles={onDiscardFiles}
              onReviewUncommittedChanges={onReviewUncommittedChanges}
              showWorktreeApplyAction={showWorktreeApplyInUnstaged}
              worktreeApplyTitle={worktreeApplyTitle}
              worktreeApplyLoading={worktreeApplyLoading}
              worktreeApplySuccess={worktreeApplySuccess}
              onApplyWorktreeChanges={onApplyWorktreeChanges}
              onFileClick={onFileClick}
              onShowFileMenu={onShowFileMenu}
            />
          )}
        </>
      )}
    </div>
  );
}
