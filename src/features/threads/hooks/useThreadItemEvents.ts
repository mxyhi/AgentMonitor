import { useCallback } from "react";
import type { Dispatch } from "react";
import { buildConversationItem } from "@utils/threadItems";
import type { CollabAgentRef } from "@/types";
import {
  buildItemForDisplay,
  handleConvertedItemEffects,
} from "./threadItemEventHelpers";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadItemEventsOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  shouldMarkProcessingFromItemEvent?: (threadId: string) => boolean;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  applyCollabThreadLinks: (
    workspaceId: string,
    threadId: string,
    item: Record<string, unknown>,
  ) => void;
  hydrateSubagentThreads?: (
    workspaceId: string,
    receivers: CollabAgentRef[],
  ) => void | Promise<void>;
  onUserMessageCreated?: (
    workspaceId: string,
    threadId: string,
    text: string,
  ) => void | Promise<void>;
  onReviewExited?: (workspaceId: string, threadId: string) => void;
};

type ToolOutputFallback = {
  toolType: string;
  title: string;
  detail?: string;
  status?: string;
};

const COMMAND_OUTPUT_FALLBACK: ToolOutputFallback = {
  toolType: "commandExecution",
  title: "Command output",
  status: "inProgress",
};

const FILE_CHANGE_OUTPUT_FALLBACK: ToolOutputFallback = {
  toolType: "fileChange",
  title: "File change output",
  status: "inProgress",
};

export function useThreadItemEvents({
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
}: UseThreadItemEventsOptions) {
  const handleItemUpdate = useCallback(
    (
      workspaceId: string,
      threadId: string,
      item: Record<string, unknown>,
      shouldMarkProcessing: boolean,
    ) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      if (
        shouldMarkProcessing &&
        (shouldMarkProcessingFromItemEvent?.(threadId) ?? true)
      ) {
        markProcessing(threadId, true);
      }
      applyCollabThreadLinks(workspaceId, threadId, item);
      const itemType = String(item?.type ?? "");
      if (itemType === "enteredReviewMode") {
        markReviewing(threadId, true);
      } else if (itemType === "exitedReviewMode") {
        markReviewing(threadId, false);
        markProcessing(threadId, false);
        if (!shouldMarkProcessing) {
          onReviewExited?.(workspaceId, threadId);
        }
      }
      const itemForDisplay = buildItemForDisplay(item, shouldMarkProcessing);
      const converted = buildConversationItem(itemForDisplay);
      handleConvertedItemEffects({
        converted,
        workspaceId,
        threadId,
        hydrateSubagentThreads,
        onUserMessageCreated,
      });
      if (converted) {
        dispatch({
          type: "upsertItem",
          workspaceId,
          threadId,
          item: converted,
          hasCustomName: Boolean(getCustomName(workspaceId, threadId)),
        });
      }
      safeMessageActivity();
    },
    [
      applyCollabThreadLinks,
      dispatch,
      getCustomName,
      markProcessing,
      markReviewing,
      onReviewExited,
      onUserMessageCreated,
      hydrateSubagentThreads,
      safeMessageActivity,
      shouldMarkProcessingFromItemEvent,
    ],
  );

  const handleToolOutputDelta = useCallback(
    (
      threadId: string,
      itemId: string,
      delta: string,
      fallback?: ToolOutputFallback,
    ) => {
      if (shouldMarkProcessingFromItemEvent?.(threadId) ?? true) {
        markProcessing(threadId, true);
      }
      dispatch({
        type: "appendToolOutput",
        threadId,
        itemId,
        delta,
        ...(fallback ?? {}),
      });
      safeMessageActivity();
    },
    [dispatch, markProcessing, safeMessageActivity, shouldMarkProcessingFromItemEvent],
  );

  const handleTerminalInteraction = useCallback(
    (threadId: string, itemId: string, stdin: string) => {
      if (!stdin) {
        return;
      }
      const normalized = stdin.replace(/\r\n/g, "\n");
      const suffix = normalized.endsWith("\n") ? "" : "\n";
      handleToolOutputDelta(
        threadId,
        itemId,
        `\n[stdin]\n${normalized}${suffix}`,
        COMMAND_OUTPUT_FALLBACK,
      );
    },
    [handleToolOutputDelta],
  );

  const onAgentMessageDelta = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      delta,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
    }) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      if (shouldMarkProcessingFromItemEvent?.(threadId) ?? true) {
        markProcessing(threadId, true);
      }
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      dispatch({
        type: "appendAgentDelta",
        workspaceId,
        threadId,
        itemId,
        delta,
        hasCustomName,
      });
    },
    [dispatch, getCustomName, markProcessing, shouldMarkProcessingFromItemEvent],
  );

  const onAgentMessageCompleted = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      text,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      text: string;
    }) => {
      const timestamp = Date.now();
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      dispatch({
        type: "completeAgentMessage",
        workspaceId,
        threadId,
        itemId,
        text,
        hasCustomName,
      });
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId,
        timestamp,
      });
      dispatch({
        type: "setLastAgentMessage",
        threadId,
        text,
        timestamp,
      });
      recordThreadActivity(workspaceId, threadId, timestamp);
      safeMessageActivity();
      if (threadId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId, hasUnread: true });
      }
    },
    [
      activeThreadId,
      dispatch,
      getCustomName,
      recordThreadActivity,
      safeMessageActivity,
    ],
  );

  const onItemStarted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, true);
    },
    [handleItemUpdate],
  );

  const onItemCompleted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, false);
    },
    [handleItemUpdate],
  );

  const onReasoningSummaryDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      dispatch({ type: "appendReasoningSummary", threadId, itemId, delta });
    },
    [dispatch],
  );

  const onReasoningSummaryBoundary = useCallback(
    (_workspaceId: string, threadId: string, itemId: string) => {
      dispatch({ type: "appendReasoningSummaryBoundary", threadId, itemId });
    },
    [dispatch],
  );

  const onReasoningTextDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      dispatch({ type: "appendReasoningContent", threadId, itemId, delta });
    },
    [dispatch],
  );

  const onPlanDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      dispatch({ type: "appendPlanDelta", threadId, itemId, delta });
    },
    [dispatch],
  );

  const onCommandOutputDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      handleToolOutputDelta(threadId, itemId, delta, COMMAND_OUTPUT_FALLBACK);
    },
    [handleToolOutputDelta],
  );

  const onTerminalInteraction = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, stdin: string) => {
      handleTerminalInteraction(threadId, itemId, stdin);
    },
    [handleTerminalInteraction],
  );

  const onFileChangeOutputDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      handleToolOutputDelta(threadId, itemId, delta, FILE_CHANGE_OUTPUT_FALLBACK);
    },
    [handleToolOutputDelta],
  );

  const onFileChangePatchUpdated = useCallback(
    (
      workspaceId: string,
      threadId: string,
      itemId: string,
      changes: Record<string, unknown>[],
    ) => {
      if ((shouldMarkProcessingFromItemEvent?.(threadId) ?? true)) {
        markProcessing(threadId, true);
      }
      const converted = buildConversationItem({
        type: "fileChange",
        id: itemId,
        changes,
      });
      if (!converted) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({
        type: "upsertItem",
        workspaceId,
        threadId,
        item: converted,
        hasCustomName: Boolean(getCustomName(workspaceId, threadId)),
      });
      safeMessageActivity();
    },
    [
      dispatch,
      getCustomName,
      markProcessing,
      safeMessageActivity,
      shouldMarkProcessingFromItemEvent,
    ],
  );

  return {
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
  };
}
