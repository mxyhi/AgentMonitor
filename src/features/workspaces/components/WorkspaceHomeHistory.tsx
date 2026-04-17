import { formatRelativeTime } from "../../../utils/time";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import {
  getWorkspaceHomeThreadState,
  type ThreadStatusById,
} from "../../../utils/threadStatus";
import type {
  WorkspaceHomeRun,
  WorkspaceHomeRunInstance,
} from "../hooks/useWorkspaceHome";
import { buildLabelCounts } from "./workspaceHomeHelpers";

type WorkspaceHomeHistoryProps = {
  runs: WorkspaceHomeRun[];
  recentThreadInstances: WorkspaceHomeRunInstance[];
  recentThreadsUpdatedAt: number | null;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusById;
  onSelectInstance: (workspaceId: string, threadId: string) => void;
};

type WorkspaceHomeInstanceListProps = {
  instances: WorkspaceHomeRunInstance[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusById;
  onSelectInstance: (workspaceId: string, threadId: string) => void;
};

function WorkspaceHomeInstanceList({
  instances,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  onSelectInstance,
}: WorkspaceHomeInstanceListProps) {
  const locale = useAppLocale();
  const labelCounts = buildLabelCounts(instances);

  return (
    <div className="workspace-home-instance-list">
      {instances.map((instance) => {
        const status = getWorkspaceHomeThreadState(threadStatusById[instance.threadId]);
        const isActive =
          instance.threadId === activeThreadId &&
          instance.workspaceId === activeWorkspaceId;
        const totalForLabel = labelCounts.get(instance.modelLabel) ?? 1;
        const label =
          totalForLabel > 1
            ? `${instance.modelLabel} ${instance.sequence}`
            : instance.modelLabel;
        const statusLabel =
          status.statusLabel === "Running"
            ? m.home_latest_running({}, { locale })
            : status.statusLabel === "Reviewing"
              ? m.thread_reviewing({}, { locale })
              : m.workspace_home_status_idle({}, { locale });

        return (
          <button
            className={`workspace-home-instance ${status.stateClass}${isActive ? " is-active" : ""}`}
            key={instance.id}
            type="button"
            onClick={() => onSelectInstance(instance.workspaceId, instance.threadId)}
          >
            <span className="workspace-home-instance-title">{label}</span>
            <span
              className={`workspace-home-instance-status${
                status.isRunning ? " is-running" : ""
              }`}
            >
              {statusLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceHomeHistory({
  runs,
  recentThreadInstances,
  recentThreadsUpdatedAt,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  onSelectInstance,
}: WorkspaceHomeHistoryProps) {
  const locale = useAppLocale();
  return (
    <>
      <div className="workspace-home-runs">
        <div className="workspace-home-section-header">
          <div className="workspace-home-section-title">
            {m.workspace_home_recent_runs({}, { locale })}
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="workspace-home-empty">
            {m.workspace_home_start_run_empty({}, { locale })}
          </div>
        ) : (
          <div className="workspace-home-run-grid">
            {runs.map((run) => {
              const hasInstances = run.instances.length > 0;

              return (
                <div className="workspace-home-run-card" key={run.id}>
                  <div className="workspace-home-run-header">
                    <div>
                      <div className="workspace-home-run-title">{run.title}</div>
                      <div className="workspace-home-run-meta">
                        {run.mode === "local"
                          ? m.workspace_home_run_mode_local({}, { locale })
                          : m.workspace_home_run_mode_worktree({}, { locale })}{" "}
                        ·{" "}
                        {run.instances.length === 1
                          ? m.workspace_home_instance_single({}, { locale })
                          : m.workspace_home_instance_plural(
                              { count: String(run.instances.length) },
                              { locale },
                            )}
                        {run.status === "failed" &&
                          ` · ${m.workspace_home_failed({}, { locale })}`}
                        {run.status === "partial" &&
                          ` · ${m.workspace_home_partial({}, { locale })}`}
                      </div>
                    </div>
                    <div className="workspace-home-run-time">
                      {formatRelativeTime(run.createdAt)}
                    </div>
                  </div>
                  {run.error && <div className="workspace-home-run-error">{run.error}</div>}
                  {run.instanceErrors.length > 0 && (
                    <div className="workspace-home-run-error-list">
                      {run.instanceErrors.slice(0, 2).map((entry, index) => (
                        <div className="workspace-home-run-error-item" key={index}>
                          {entry.message}
                        </div>
                      ))}
                      {run.instanceErrors.length > 2 && (
                        <div className="workspace-home-run-error-item">
                          +{run.instanceErrors.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                  {hasInstances ? (
                    <WorkspaceHomeInstanceList
                      instances={run.instances}
                      activeWorkspaceId={activeWorkspaceId}
                      activeThreadId={activeThreadId}
                      threadStatusById={threadStatusById}
                      onSelectInstance={onSelectInstance}
                    />
                  ) : run.status === "failed" ? (
                    <div className="workspace-home-empty">
                      {m.workspace_home_no_instances_started({}, { locale })}
                    </div>
                  ) : (
                    <div className="workspace-home-empty workspace-home-pending">
                      <span className="working-spinner" aria-hidden />
                      <span className="workspace-home-pending-text">
                        {m.workspace_home_instances_preparing({}, { locale })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="workspace-home-runs">
        <div className="workspace-home-section-header">
          <div className="workspace-home-section-title">
            {m.workspace_home_recent_threads({}, { locale })}
          </div>
        </div>
        {recentThreadInstances.length === 0 ? (
          <div className="workspace-home-empty">
            {m.workspace_home_threads_sidebar_appear({}, { locale })}
          </div>
        ) : (
          <div className="workspace-home-run-grid">
            <div className="workspace-home-run-card">
              <div className="workspace-home-run-header">
                <div>
                  <div className="workspace-home-run-title">
                    {m.workspace_home_agents_activity({}, { locale })}
                  </div>
                  <div className="workspace-home-run-meta">
                    {recentThreadInstances.length === 1
                      ? m.workspace_home_thread_single({}, { locale })
                      : m.workspace_home_thread_plural(
                          { count: String(recentThreadInstances.length) },
                          { locale },
                        )}
                  </div>
                </div>
                {recentThreadsUpdatedAt ? (
                  <div className="workspace-home-run-time">
                    {formatRelativeTime(recentThreadsUpdatedAt)}
                  </div>
                ) : null}
              </div>
              <WorkspaceHomeInstanceList
                instances={recentThreadInstances}
                activeWorkspaceId={activeWorkspaceId}
                activeThreadId={activeThreadId}
                threadStatusById={threadStatusById}
                onSelectInstance={onSelectInstance}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
