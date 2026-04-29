import { useCallback, useMemo } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  AppServerEvent,
  CollabAgentRef,
  ConversationItem,
  DebugEntry,
  RateLimitSnapshot,
  TurnPlan,
} from "@/types";
import { getAppServerRawMethod } from "@utils/appServerEvents";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";
import { useThreadHookEvents } from "./useThreadHookEvents";
import { useThreadItemEvents } from "./useThreadItemEvents";
import { useThreadTurnEvents } from "./useThreadTurnEvents";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";
import type { ThreadAction } from "./useThreadsReducer";

type ThreadEventHandlersOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  getItemsForThread: (threadId: string) => ConversationItem[];
  planByThreadRef: MutableRefObject<Record<string, TurnPlan | null>>;
  getCurrentRateLimits?: (workspaceId: string) => RateLimitSnapshot | null;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  isThreadHidden: (workspaceId: string, threadId: string) => boolean;
  setThreadLoaded: (threadId: string, isLoaded: boolean) => void;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  shouldMarkProcessingFromItemEvent: (threadId: string) => boolean;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  getActiveTurnId: (threadId: string) => string | null;
  safeMessageActivity: () => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  onUserMessageCreated?: (
    workspaceId: string,
    threadId: string,
    text: string,
  ) => void | Promise<void>;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  onDebug?: (entry: DebugEntry) => void;
  onWorkspaceConnected: (workspaceId: string) => void;
  onWorkspaceDisconnected?: (workspaceId: string, message: string) => void;
  applyCollabThreadLinks: (
    workspaceId: string,
    threadId: string,
    item: Record<string, unknown>,
  ) => void;
  hydrateSubagentThreads?: (
    workspaceId: string,
    receivers: CollabAgentRef[],
  ) => void | Promise<void>;
  onReviewExited?: (workspaceId: string, threadId: string) => void;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
};

export function useThreadEventHandlers({
  activeThreadId,
  dispatch,
  getItemsForThread,
  planByThreadRef,
  getCurrentRateLimits,
  getCustomName,
  isThreadHidden,
  setThreadLoaded,
  markProcessing,
  shouldMarkProcessingFromItemEvent,
  markReviewing,
  setActiveTurnId,
  getActiveTurnId,
  safeMessageActivity,
  recordThreadActivity,
  onUserMessageCreated,
  pushThreadErrorMessage,
  onDebug,
  onWorkspaceConnected,
  onWorkspaceDisconnected,
  applyCollabThreadLinks,
  hydrateSubagentThreads,
  onReviewExited,
  approvalAllowlistRef,
  pendingInterruptsRef,
}: ThreadEventHandlersOptions) {
  const onApprovalRequest = useThreadApprovalEvents({
    dispatch,
    approvalAllowlistRef,
  });
  const onRequestUserInput = useThreadUserInputEvents({ dispatch });
  const {
    onHookStarted: handleHookStarted,
    onHookCompleted: handleHookCompleted,
  } = useThreadHookEvents({
    dispatch,
    getItemsForThread,
    safeMessageActivity,
  });
  const onHookStarted = useCallback(
    ({
      workspaceId,
      threadId,
      turnId,
      run,
    }: {
      workspaceId: string;
      threadId: string;
      turnId: string | null;
      run: Record<string, unknown>;
    }) => {
      handleHookStarted(workspaceId, threadId, turnId, run);
    },
    [handleHookStarted],
  );
  const onHookCompleted = useCallback(
    ({
      workspaceId,
      threadId,
      turnId,
      run,
    }: {
      workspaceId: string;
      threadId: string;
      turnId: string | null;
      run: Record<string, unknown>;
    }) => {
      handleHookCompleted(workspaceId, threadId, turnId, run);
    },
    [handleHookCompleted],
  );

  const {
    onAgentMessageDelta,
    onAgentMessageCompleted,
    onItemStarted,
    onItemCompleted,
    onReasoningSummaryDelta,
    onReasoningSummaryBoundary,
    onReasoningTextDelta,
    onPlanDelta,
    onCommandOutputDelta,
    onTerminalInteraction,
    onFileChangeOutputDelta,
    onFileChangePatchUpdated,
  } = useThreadItemEvents({
    activeThreadId,
    dispatch,
    getCustomName,
    markProcessing,
    shouldMarkProcessingFromItemEvent,
    markReviewing,
    safeMessageActivity,
    recordThreadActivity,
    applyCollabThreadLinks,
    hydrateSubagentThreads,
    onUserMessageCreated,
    onReviewExited,
  });

  const {
    onThreadStarted,
    onThreadNameUpdated,
    onThreadArchived,
    onThreadUnarchived,
    onTurnStarted,
    onTurnCompleted,
    onThreadStatusChanged,
    onThreadClosed,
    onTurnPlanUpdated,
    onTurnDiffUpdated,
    onThreadTokenUsageUpdated,
    onThreadGoalUpdated,
    onThreadGoalCleared,
    onAccountRateLimitsUpdated,
    onTurnError,
  } = useThreadTurnEvents({
    dispatch,
    planByThreadRef,
    getCurrentRateLimits,
    getCustomName,
    isThreadHidden,
    setThreadLoaded,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    getActiveTurnId,
    pendingInterruptsRef,
    pushThreadErrorMessage,
    safeMessageActivity,
    recordThreadActivity,
  });

  const onBackgroundThreadAction = useCallback(
    (workspaceId: string, threadId: string, action: string) => {
      if (action !== "hide") {
        return;
      }
      dispatch({ type: "hideThread", workspaceId, threadId });
    },
    [dispatch],
  );

  const onAppServerEvent = useCallback(
    (event: AppServerEvent) => {
      const method = getAppServerRawMethod(event) ?? "";
      const inferredSource = method === "codex/stderr" ? "stderr" : "event";
      onDebug?.({
        id: `${Date.now()}-server-event`,
        timestamp: Date.now(),
        source: inferredSource,
        label: method || "event",
        payload: event,
      });
    },
    [onDebug],
  );

  const handlers = useMemo(
    () => ({
      onWorkspaceConnected,
      onWorkspaceDisconnected,
      onApprovalRequest,
      onRequestUserInput,
      onHookStarted,
      onHookCompleted,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDelta,
      onAgentMessageCompleted,
      onItemStarted,
      onItemCompleted,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onPlanDelta,
      onCommandOutputDelta,
      onTerminalInteraction,
      onFileChangeOutputDelta,
      onFileChangePatchUpdated,
      onThreadStarted,
      onThreadNameUpdated,
      onThreadArchived,
      onThreadUnarchived,
      onTurnStarted,
      onTurnCompleted,
      onThreadStatusChanged,
      onThreadClosed,
      onTurnPlanUpdated,
      onTurnDiffUpdated,
      onThreadTokenUsageUpdated,
      onThreadGoalUpdated,
      onThreadGoalCleared,
      onAccountRateLimitsUpdated,
      onTurnError,
    }),
    [
      onWorkspaceConnected,
      onWorkspaceDisconnected,
      onApprovalRequest,
      onRequestUserInput,
      onHookStarted,
      onHookCompleted,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDelta,
      onAgentMessageCompleted,
      onItemStarted,
      onItemCompleted,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onPlanDelta,
      onCommandOutputDelta,
      onTerminalInteraction,
      onFileChangeOutputDelta,
      onFileChangePatchUpdated,
      onThreadStarted,
      onThreadNameUpdated,
      onThreadArchived,
      onThreadUnarchived,
      onTurnStarted,
      onTurnCompleted,
      onThreadStatusChanged,
      onThreadClosed,
      onTurnPlanUpdated,
      onTurnDiffUpdated,
      onThreadTokenUsageUpdated,
      onThreadGoalUpdated,
      onThreadGoalCleared,
      onAccountRateLimitsUpdated,
      onTurnError,
    ],
  );

  return handlers;
}
