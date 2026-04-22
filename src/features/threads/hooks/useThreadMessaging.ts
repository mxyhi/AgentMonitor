import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import * as Sentry from "@sentry/react";
import type {
  AppMention,
  ComposerSendIntent,
  RateLimitSnapshot,
  CustomPromptOption,
  DebugEntry,
  ReviewTarget,
  SendMessageResult,
  ServiceTier,
  WorkspaceInfo,
} from "@/types";
import {
  compactThread as compactThreadService,
  getAccountInfo as getAccountInfoService,
  getGlobalAiSettings as getGlobalAiSettingsService,
  sendUserMessage as sendUserMessageService,
  steerTurn as steerTurnService,
  startReview as startReviewService,
  interruptTurn as interruptTurnService,
  getAppsList as getAppsListService,
  listMcpServerStatus as listMcpServerStatusService,
} from "@services/tauri";
import { pushErrorToast } from "@services/toasts";
import { expandCustomPromptText } from "@utils/customPrompts";
import {
  asString,
  extractReviewThreadId,
  extractRpcErrorMessage,
  parseReviewTarget,
} from "@threads/utils/threadNormalize";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";
import { useReviewPrompt } from "./useReviewPrompt";
import {
  buildAppsLines,
  buildMcpStatusLines,
  buildReviewThreadTitle,
  buildStatusLines,
  buildTurnStartPayload,
  isMissingThreadError,
  isStaleSteerTurnError,
  parseFastCommand,
  resolveSendMessageOptions,
  type SendMessageOptions,
} from "./threadMessagingHelpers";
import {
  normalizeAccountSnapshot,
  requiresOpenaiAuthWithoutAccount,
} from "./threadAccountSnapshot";
import { OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR } from "../utils/threadErrorMessages";
import {
  isGlobalAiProviderConfigured,
  resolveSelectedGlobalAiProvider,
  selectedGlobalAiProviderRequiresOpenAiAuth,
} from "@/utils/globalAiProvider";

type UseThreadMessagingOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  accessMode?: "read-only" | "current" | "full-access";
  model?: string | null;
  effort?: string | null;
  serviceTier?: ServiceTier | null | undefined;
  collaborationMode?: Record<string, unknown> | null;
  onSelectServiceTier?: (tier: ServiceTier | null | undefined) => void;
  reviewDeliveryMode?: "inline" | "detached";
  steerEnabled: boolean;
  customPrompts: CustomPromptOption[];
  ensureWorkspaceRuntimeCodexArgs?: (
    workspaceId: string,
    threadId: string | null,
  ) => Promise<void>;
  shouldPreflightRuntimeCodexArgsForSend?: (
    workspaceId: string,
    threadId: string,
  ) => boolean;
  threadStatusById: ThreadState["threadStatusById"];
  activeTurnIdByThread: ThreadState["activeTurnIdByThread"];
  rateLimitsByWorkspace: Record<string, RateLimitSnapshot | null>;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  safeMessageActivity: () => void;
  onDebug?: (entry: DebugEntry) => void;
  onRequireAiSetup?: () => void;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  ensureThreadForActiveWorkspace: () => Promise<string | null>;
  ensureThreadForWorkspace: (workspaceId: string) => Promise<string | null>;
  refreshThread: (workspaceId: string, threadId: string) => Promise<string | null>;
  replaceMissingThread?: (
    workspaceId: string,
    threadId: string,
    options?: { activate?: boolean },
  ) => Promise<string | null>;
  forkThreadForWorkspace: (
    workspaceId: string,
    threadId: string,
    options?: { activate?: boolean },
  ) => Promise<string | null>;
  updateThreadParent: (parentId: string, childIds: string[]) => void;
  registerDetachedReviewChild?: (
    workspaceId: string,
    parentId: string,
    childId: string,
  ) => void;
  renameThread?: (workspaceId: string, threadId: string, name: string) => void;
};

export function useThreadMessaging({
  activeWorkspace,
  activeThreadId,
  accessMode,
  model,
  effort,
  serviceTier,
  collaborationMode,
  onSelectServiceTier,
  reviewDeliveryMode = "inline",
  steerEnabled,
  customPrompts,
  ensureWorkspaceRuntimeCodexArgs,
  shouldPreflightRuntimeCodexArgsForSend,
  threadStatusById,
  activeTurnIdByThread,
  rateLimitsByWorkspace,
  pendingInterruptsRef,
  dispatch,
  getCustomName,
  markProcessing,
  markReviewing,
  setActiveTurnId,
  recordThreadActivity,
  safeMessageActivity,
  onDebug,
  onRequireAiSetup,
  pushThreadErrorMessage,
  ensureThreadForActiveWorkspace,
  ensureThreadForWorkspace,
  refreshThread,
  replaceMissingThread,
  forkThreadForWorkspace,
  updateThreadParent,
  registerDetachedReviewChild,
  renameThread,
}: UseThreadMessagingOptions) {
  const ensureThreadWithFeedback = useCallback(
    async (
      loader: () => Promise<string | null>,
      debugLabel: string,
    ): Promise<string | null> => {
      try {
        const threadId = await loader();
        if (threadId) {
          return threadId;
        }
        const message = "Thread start returned no thread id.";
        onDebug?.({
          id: `${Date.now()}-client-thread-start-missing-id`,
          timestamp: Date.now(),
          source: "error",
          label: debugLabel,
          payload: message,
        });
        pushErrorToast({
          title: "Unable to start thread",
          message,
        });
        safeMessageActivity();
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onDebug?.({
          id: `${Date.now()}-client-thread-start-failed`,
          timestamp: Date.now(),
          source: "error",
          label: debugLabel,
          payload: message,
        });
        pushErrorToast({
          title: "Unable to start thread",
          message,
        });
        safeMessageActivity();
        return null;
      }
    },
    [onDebug, safeMessageActivity],
  );

  const sendMessageToThread = useCallback(
    async (
      workspace: WorkspaceInfo,
      threadId: string,
      text: string,
      images: string[] = [],
      options?: SendMessageOptions,
    ): Promise<SendMessageResult> => {
      const messageText = text.trim();
      if (!messageText && images.length === 0) {
        return { status: "blocked" };
      }
      let finalText = messageText;
      if (!options?.skipPromptExpansion) {
        const promptExpansion = expandCustomPromptText(messageText, customPrompts);
        if (promptExpansion && "error" in promptExpansion) {
          pushThreadErrorMessage(threadId, promptExpansion.error);
          safeMessageActivity();
          return { status: "blocked" };
        }
        finalText = promptExpansion?.expanded ?? messageText;
      }
      const isProcessing = threadStatusById[threadId]?.isProcessing ?? false;
      const activeTurnId = activeTurnIdByThread[threadId] ?? null;
      const {
        resolvedModel,
        resolvedEffort,
        resolvedServiceTier,
        sanitizedCollaborationMode,
        resolvedAccessMode,
        appMentions,
        sendIntent,
        shouldSteer,
        requestMode,
      } = resolveSendMessageOptions({
        options,
        defaults: {
          accessMode,
          model,
          effort,
          serviceTier,
          collaborationMode,
          steerEnabled,
          isProcessing,
          activeTurnId,
        },
      });
      const recoverMissingThread = async (message: string) => {
        if (
          shouldSteer ||
          options?.missingThreadRecoveryAttempted ||
          !replaceMissingThread ||
          !isMissingThreadError(message)
        ) {
          return null;
        }
        const nextThreadId = await replaceMissingThread(workspace.id, threadId, {
          activate: activeThreadId === threadId,
        });
        if (!nextThreadId || nextThreadId === threadId) {
          return null;
        }
        onDebug?.({
          id: `${Date.now()}-client-thread-missing-recovery`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/missing recovery",
          payload: {
            workspaceId: workspace.id,
            staleThreadId: threadId,
            recoveredThreadId: nextThreadId,
            requestMode,
          },
        });
        return sendMessageToThread(workspace, nextThreadId, finalText, images, {
          ...options,
          skipPromptExpansion: true,
          skipTelemetry: true,
          missingThreadRecoveryAttempted: true,
        });
      };
      if (!shouldSteer) {
        const blockForAiSetup = (message?: string): SendMessageResult => {
          onRequireAiSetup?.();
          if (message) {
            pushThreadErrorMessage(threadId, message);
          }
          safeMessageActivity();
          return { status: "blocked" };
        };
        try {
          const aiSettings = await getGlobalAiSettingsService();
          const { providerId, provider } = resolveSelectedGlobalAiProvider(aiSettings);
          const shouldRequireOpenaiAuth =
            selectedGlobalAiProviderRequiresOpenAiAuth(aiSettings);
          if (!shouldRequireOpenaiAuth) {
            const providerIncomplete = !isGlobalAiProviderConfigured({
              providerId,
              provider,
            });
            if (providerIncomplete) {
              return blockForAiSetup();
            }
          }

          let loginRequired = false;
          if (shouldRequireOpenaiAuth) {
            const accountResponse =
              (await getAccountInfoService(workspace.id)) as Record<string, unknown>;
            const accountRpcError = extractRpcErrorMessage(accountResponse);
            if (accountRpcError) {
              return blockForAiSetup(
                `Failed to read account state before sending: ${accountRpcError}`,
              );
            }
            const accountSnapshot = normalizeAccountSnapshot(accountResponse);
            dispatch({
              type: "setAccountInfo",
              workspaceId: workspace.id,
              account: accountSnapshot,
            });
            loginRequired = requiresOpenaiAuthWithoutAccount(accountSnapshot);
          }

          const providerIncomplete = !isGlobalAiProviderConfigured({
            providerId,
            provider,
            loginRequired,
          });
          if (providerIncomplete) {
            return blockForAiSetup(
              !onRequireAiSetup && shouldRequireOpenaiAuth && loginRequired
                ? OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR
                : undefined,
            );
          }
        } catch (error) {
          onDebug?.({
            id: `${Date.now()}-client-account-preflight-error`,
            timestamp: Date.now(),
            source: "error",
            label: "account/read preflight error",
            payload: {
              workspaceId: workspace.id,
              threadId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          return blockForAiSetup(
            !onRequireAiSetup
              ? `Failed to verify AI setup before sending: ${
                error instanceof Error ? error.message : String(error)
              }`
              : undefined,
          );
        }
      }
      if (!options?.skipTelemetry) {
        Sentry.metrics.count("prompt_sent", 1, {
          attributes: {
            workspace_id: workspace.id,
            thread_id: threadId,
            has_images: images.length > 0 ? "true" : "false",
            text_length: String(finalText.length),
            model: resolvedModel ?? "unknown",
            effort: resolvedEffort ?? "unknown",
            service_tier: resolvedServiceTier ?? "default",
            collaboration_mode: sanitizedCollaborationMode ?? "unknown",
            send_intent: sendIntent,
          },
        });
      }
      const timestamp = Date.now();
      const customThreadName = getCustomName(workspace.id, threadId) ?? null;
      recordThreadActivity(workspace.id, threadId, timestamp);
      dispatch({
        type: "setThreadTimestamp",
        workspaceId: workspace.id,
        threadId,
        timestamp,
      });
      markProcessing(threadId, true);
      safeMessageActivity();
      onDebug?.({
        id: `${Date.now()}-${shouldSteer ? "client-turn-steer" : "client-turn-start"}`,
        timestamp: Date.now(),
        source: "client",
        label: shouldSteer ? "turn/steer" : "turn/start",
        payload: {
          workspaceId: workspace.id,
          threadId,
          turnId: activeTurnId,
          text: finalText,
          images,
          model: resolvedModel,
          effort: resolvedEffort,
          serviceTier: resolvedServiceTier,
          collaborationMode: sanitizedCollaborationMode,
          sendIntent,
          threadCustomName: customThreadName,
        },
      });
      try {
        const shouldPreflightRuntimeCodexArgs =
          shouldPreflightRuntimeCodexArgsForSend?.(workspace.id, threadId) ?? true;
        if (
          !shouldSteer &&
          shouldPreflightRuntimeCodexArgs &&
          ensureWorkspaceRuntimeCodexArgs
        ) {
          await ensureWorkspaceRuntimeCodexArgs(workspace.id, threadId);
        }
        const response: Record<string, unknown> = shouldSteer
          ? (await (appMentions.length > 0
            ? steerTurnService(
              workspace.id,
              threadId,
              activeTurnId ?? "",
              finalText,
              images,
              appMentions,
            )
            : steerTurnService(
              workspace.id,
              threadId,
              activeTurnId ?? "",
              finalText,
              images,
            ))) as Record<string, unknown>
          : (await sendUserMessageService(
            workspace.id,
            threadId,
            finalText,
            buildTurnStartPayload({
              model: resolvedModel,
              effort: resolvedEffort,
              serviceTier: resolvedServiceTier,
              collaborationMode: sanitizedCollaborationMode,
              accessMode: resolvedAccessMode,
              images,
              appMentions,
            }),
          )) as Record<string, unknown>;

        const rpcError = extractRpcErrorMessage(response);

        onDebug?.({
          id: `${Date.now()}-${requestMode === "steer" ? "server-turn-steer" : "server-turn-start"}`,
          timestamp: Date.now(),
          source: "server",
          label: requestMode === "steer" ? "turn/steer response" : "turn/start response",
          payload: response,
        });
        if (rpcError) {
          if (requestMode !== "steer") {
            const recovered = await recoverMissingThread(rpcError);
            if (recovered) {
              return recovered;
            }
            markProcessing(threadId, false);
            setActiveTurnId(threadId, null);
            pushThreadErrorMessage(threadId, `Turn failed to start: ${rpcError}`);
            safeMessageActivity();
            return { status: "blocked" };
          }
          if (isStaleSteerTurnError(rpcError)) {
            markProcessing(threadId, false);
            setActiveTurnId(threadId, null);
          }
          pushThreadErrorMessage(
            threadId,
            `Turn steer failed: ${rpcError}`,
          );
          safeMessageActivity();
          return { status: "steer_failed" };
        }
        if (requestMode === "steer") {
          const result = (response?.result ?? response) as Record<string, unknown>;
          const steeredTurnId = asString(result?.turnId ?? result?.turn_id ?? "");
          if (steeredTurnId) {
            setActiveTurnId(threadId, steeredTurnId);
          }
          return { status: "sent" };
        }
        const result = (response?.result ?? response) as Record<string, unknown>;
        const turn = (result?.turn ?? response?.turn ?? null) as
          | Record<string, unknown>
          | null;
        const turnId = asString(turn?.id ?? "");
        if (!turnId) {
          markProcessing(threadId, false);
          setActiveTurnId(threadId, null);
          pushThreadErrorMessage(threadId, "Turn failed to start.");
          safeMessageActivity();
          return { status: "blocked" };
        }
        setActiveTurnId(threadId, turnId);
        return { status: "sent" };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (requestMode !== "steer") {
          const recovered = await recoverMissingThread(errorMessage);
          if (recovered) {
            return recovered;
          }
          markProcessing(threadId, false);
          setActiveTurnId(threadId, null);
        } else if (isStaleSteerTurnError(errorMessage)) {
          markProcessing(threadId, false);
          setActiveTurnId(threadId, null);
        }
        onDebug?.({
          id: `${Date.now()}-${requestMode === "steer" ? "client-turn-steer-error" : "client-turn-start-error"}`,
          timestamp: Date.now(),
          source: "error",
          label: requestMode === "steer" ? "turn/steer error" : "turn/start error",
          payload: errorMessage,
        });
        pushThreadErrorMessage(
          threadId,
          requestMode === "steer"
            ? `Turn steer failed: ${errorMessage}`
            : errorMessage,
        );
        safeMessageActivity();
        return { status: requestMode === "steer" ? "steer_failed" : "blocked" };
      }
    },
    [
      accessMode,
      collaborationMode,
      customPrompts,
      dispatch,
      effort,
      serviceTier,
      ensureWorkspaceRuntimeCodexArgs,
      shouldPreflightRuntimeCodexArgsForSend,
      activeTurnIdByThread,
      getCustomName,
      markProcessing,
      model,
      onDebug,
      onRequireAiSetup,
      pushThreadErrorMessage,
      replaceMissingThread,
      recordThreadActivity,
      safeMessageActivity,
      setActiveTurnId,
      steerEnabled,
      threadStatusById,
      activeThreadId,
    ],
  );

  const sendUserMessage = useCallback(
    async (
      text: string,
      images: string[] = [],
      appMentions: AppMention[] = [],
      options?: { sendIntent?: ComposerSendIntent },
    ): Promise<SendMessageResult> => {
      if (!activeWorkspace) {
        return { status: "blocked" };
      }
      const messageText = text.trim();
      if (!messageText && images.length === 0) {
        return { status: "blocked" };
      }
      const promptExpansion = expandCustomPromptText(messageText, customPrompts);
      if (promptExpansion && "error" in promptExpansion) {
        if (activeThreadId) {
          pushThreadErrorMessage(activeThreadId, promptExpansion.error);
          safeMessageActivity();
        } else {
          onDebug?.({
            id: `${Date.now()}-client-prompt-expand-error`,
            timestamp: Date.now(),
            source: "error",
            label: "prompt/expand error",
            payload: promptExpansion.error,
          });
        }
        return { status: "blocked" };
      }
      const finalText = promptExpansion?.expanded ?? messageText;
      const threadId = await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for send failed",
      );
      if (!threadId) {
        return { status: "blocked" };
      }
      return sendMessageToThread(activeWorkspace, threadId, finalText, images, {
        skipPromptExpansion: true,
        appMentions,
        sendIntent: options?.sendIntent,
      });
    },
    [
      activeThreadId,
      activeWorkspace,
      customPrompts,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      onDebug,
      pushThreadErrorMessage,
      safeMessageActivity,
      sendMessageToThread,
    ],
  );

  const sendUserMessageToThread = useCallback(
    async (
      workspace: WorkspaceInfo,
      threadId: string,
      text: string,
      images: string[] = [],
      options?: SendMessageOptions,
    ): Promise<SendMessageResult> => {
      return sendMessageToThread(workspace, threadId, text, images, options);
    },
    [sendMessageToThread],
  );

  const interruptTurn = useCallback(async () => {
    if (!activeWorkspace || !activeThreadId) {
      return;
    }
    const activeTurnId = activeTurnIdByThread[activeThreadId] ?? null;
    const turnId = activeTurnId ?? "pending";
    // Keep stop intent latched until a terminal thread event arrives so late
    // `turn/started` / `thread/status active` notifications cannot resurrect
    // a turn the user already asked to stop.
    pendingInterruptsRef.current.add(activeThreadId);
    markProcessing(activeThreadId, false);
    setActiveTurnId(activeThreadId, null);
    dispatch({
      type: "addAssistantMessage",
      threadId: activeThreadId,
      text: "Session stopped.",
    });
    onDebug?.({
      id: `${Date.now()}-client-turn-interrupt`,
      timestamp: Date.now(),
      source: "client",
      label: "turn/interrupt",
      payload: {
        workspaceId: activeWorkspace.id,
        threadId: activeThreadId,
        turnId,
        queued: !activeTurnId,
      },
    });
    try {
      const response = await interruptTurnService(
        activeWorkspace.id,
        activeThreadId,
        turnId,
      );
      onDebug?.({
        id: `${Date.now()}-server-turn-interrupt`,
        timestamp: Date.now(),
        source: "server",
        label: "turn/interrupt response",
        payload: response,
      });
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-turn-interrupt-error`,
        timestamp: Date.now(),
        source: "error",
        label: "turn/interrupt error",
        payload: error instanceof Error ? error.message : String(error),
      });
      pendingInterruptsRef.current.delete(activeThreadId);
    }
  }, [
    activeThreadId,
    activeTurnIdByThread,
    activeWorkspace,
    dispatch,
    markProcessing,
    onDebug,
    pendingInterruptsRef,
    setActiveTurnId,
  ]);

  const startReviewTarget = useCallback(
    async (target: ReviewTarget, workspaceIdOverride?: string): Promise<boolean> => {
      const workspaceId = workspaceIdOverride ?? activeWorkspace?.id ?? null;
      if (!workspaceId) {
        return false;
      }
      const threadId = workspaceIdOverride
        ? await ensureThreadWithFeedback(
          () => ensureThreadForWorkspace(workspaceId),
          "thread/start for review failed",
        )
        : await ensureThreadWithFeedback(
          ensureThreadForActiveWorkspace,
          "thread/start for review failed",
        );
      if (!threadId) {
        return false;
      }

      const lockParentThread = reviewDeliveryMode !== "detached";
      if (lockParentThread) {
        markProcessing(threadId, true);
        markReviewing(threadId, true);
        safeMessageActivity();
      }
      onDebug?.({
        id: `${Date.now()}-client-review-start`,
        timestamp: Date.now(),
        source: "client",
        label: "review/start",
        payload: {
          workspaceId,
          threadId,
          target,
        },
      });
      try {
        const response = await startReviewService(
          workspaceId,
          threadId,
          target,
          reviewDeliveryMode,
        );
        onDebug?.({
          id: `${Date.now()}-server-review-start`,
          timestamp: Date.now(),
          source: "server",
          label: "review/start response",
          payload: response,
        });
        const rpcError = extractRpcErrorMessage(response);
        if (rpcError) {
          if (lockParentThread) {
            markProcessing(threadId, false);
            markReviewing(threadId, false);
            setActiveTurnId(threadId, null);
          }
          pushThreadErrorMessage(threadId, `Review failed to start: ${rpcError}`);
          safeMessageActivity();
          return false;
        }
        const reviewThreadId = extractReviewThreadId(response);
        if (reviewThreadId && reviewThreadId !== threadId) {
          updateThreadParent(threadId, [reviewThreadId]);
          if (reviewDeliveryMode === "detached") {
            registerDetachedReviewChild?.(workspaceId, threadId, reviewThreadId);
            const reviewTitle = buildReviewThreadTitle(target);
            if (reviewTitle && !getCustomName(workspaceId, reviewThreadId)) {
              renameThread?.(workspaceId, reviewThreadId, reviewTitle);
            }
          }
        }
        return true;
      } catch (error) {
        if (lockParentThread) {
          markProcessing(threadId, false);
          markReviewing(threadId, false);
        }
        onDebug?.({
          id: `${Date.now()}-client-review-start-error`,
          timestamp: Date.now(),
          source: "error",
          label: "review/start error",
          payload: error instanceof Error ? error.message : String(error),
        });
        pushThreadErrorMessage(
          threadId,
          error instanceof Error ? error.message : String(error),
        );
        safeMessageActivity();
        return false;
      }
    },
    [
      activeWorkspace,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      ensureThreadForWorkspace,
      getCustomName,
      markProcessing,
      markReviewing,
      onDebug,
      pushThreadErrorMessage,
      safeMessageActivity,
      setActiveTurnId,
      reviewDeliveryMode,
      registerDetachedReviewChild,
      renameThread,
      updateThreadParent,
    ],
  );

  const {
    reviewPrompt,
    openReviewPrompt,
    closeReviewPrompt,
    showPresetStep,
    choosePreset,
    highlightedPresetIndex,
    setHighlightedPresetIndex,
    highlightedBranchIndex,
    setHighlightedBranchIndex,
    highlightedCommitIndex,
    setHighlightedCommitIndex,
    handleReviewPromptKeyDown,
    confirmBranch,
    selectBranch,
    selectBranchAtIndex,
    selectCommit,
    selectCommitAtIndex,
    confirmCommit,
    updateCustomInstructions,
    confirmCustom,
  } = useReviewPrompt({
    activeWorkspace,
    activeThreadId,
    onDebug,
    startReviewTarget,
  });

  const startReview = useCallback(
    async (text: string) => {
      if (!activeWorkspace || !text.trim()) {
        return;
      }
      const trimmed = text.trim();
      const rest = trimmed.replace(/^\/review\b/i, "").trim();
      if (!rest) {
        openReviewPrompt();
        return;
      }

      const target = parseReviewTarget(trimmed);
      await startReviewTarget(target);
    },
    [
      activeWorkspace,
      openReviewPrompt,
      startReviewTarget,
    ],
  );

  const startUncommittedReview = useCallback(
    async (workspaceId?: string | null) => {
      const workspaceOverride = workspaceId ?? undefined;
      await startReviewTarget({ type: "uncommittedChanges" }, workspaceOverride);
    },
    [startReviewTarget],
  );

  const startStatus = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for status failed",
      );
      if (!threadId) {
        return;
      }

      const lines = buildStatusLines({
        model,
        serviceTier,
        effort,
        accessMode,
        collaborationMode,
        rateLimits: rateLimitsByWorkspace[activeWorkspace.id] ?? null,
      });
      const timestamp = Date.now();
      recordThreadActivity(activeWorkspace.id, threadId, timestamp);
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text: lines.join("\n"),
      });
      safeMessageActivity();
    },
    [
      accessMode,
      activeWorkspace,
      collaborationMode,
      dispatch,
      effort,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      model,
      serviceTier,
      rateLimitsByWorkspace,
      recordThreadActivity,
      safeMessageActivity,
    ],
  );

  const startFast = useCallback(
    async (text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for fast failed",
      );
      if (!threadId) {
        return;
      }

      const action = parseFastCommand(text);
      const isEnabled = serviceTier === "fast";
      let nextTier = serviceTier ?? null;
      let message = "";

      if (action === "invalid") {
        message = "Usage: /fast, /fast on, /fast off, or /fast status.";
      } else if (action === "status") {
        message = `Fast mode is ${isEnabled ? "on" : "off"}.`;
      } else {
        nextTier =
          action === "on"
            ? "fast"
            : action === "off"
              ? null
              : isEnabled
                ? null
                : "fast";
        onSelectServiceTier?.(nextTier);
        message = `Fast mode ${nextTier === "fast" ? "enabled" : "disabled"}.`;
      }

      const timestamp = Date.now();
      recordThreadActivity(activeWorkspace.id, threadId, timestamp);
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text: message,
      });
      safeMessageActivity();
    },
    [
      activeWorkspace,
      dispatch,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      onSelectServiceTier,
      recordThreadActivity,
      safeMessageActivity,
      serviceTier,
    ],
  );

  const startMcp = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for mcp failed",
      );
      if (!threadId) {
        return;
      }

      try {
        const response = (await listMcpServerStatusService(
          activeWorkspace.id,
          null,
          null,
        )) as Record<string, unknown> | null;
        const result = (response?.result ?? response) as
          | Record<string, unknown>
          | null;
        const data = Array.isArray(result?.data)
          ? (result?.data as Array<Record<string, unknown>>)
          : [];
        const lines = buildMcpStatusLines(data);

        const timestamp = Date.now();
        recordThreadActivity(activeWorkspace.id, threadId, timestamp);
        dispatch({
          type: "addAssistantMessage",
          threadId,
          text: lines.join("\n"),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load MCP status.";
        dispatch({
          type: "addAssistantMessage",
          threadId,
          text: `MCP tools:\n- ${message}`,
        });
      } finally {
        safeMessageActivity();
      }
    },
    [
      activeWorkspace,
      dispatch,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      recordThreadActivity,
      safeMessageActivity,
    ],
  );

  const startApps = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for apps failed",
      );
      if (!threadId) {
        return;
      }

      try {
        const response = (await getAppsListService(
          activeWorkspace.id,
          null,
          100,
          threadId,
        )) as Record<string, unknown> | null;
        const result = (response?.result ?? response) as
          | Record<string, unknown>
          | null;
        const data = Array.isArray(result?.data)
          ? (result?.data as Array<Record<string, unknown>>)
          : [];
        const lines = buildAppsLines(data);

        const timestamp = Date.now();
        recordThreadActivity(activeWorkspace.id, threadId, timestamp);
        dispatch({
          type: "addAssistantMessage",
          threadId,
          text: lines.join("\n"),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load apps.";
        dispatch({
          type: "addAssistantMessage",
          threadId,
          text: `Apps:\n- ${message}`,
        });
      } finally {
        safeMessageActivity();
      }
    },
    [
      activeWorkspace,
      dispatch,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      recordThreadActivity,
      safeMessageActivity,
    ],
  );

  const startFork = useCallback(
    async (text: string) => {
      if (!activeWorkspace || !activeThreadId) {
        return;
      }
      const trimmed = text.trim();
      const rest = trimmed.replace(/^\/fork\b/i, "").trim();
      const threadId = await forkThreadForWorkspace(activeWorkspace.id, activeThreadId);
      if (!threadId) {
        return;
      }
      updateThreadParent(activeThreadId, [threadId]);
      if (rest) {
        await sendMessageToThread(activeWorkspace, threadId, rest, []);
      }
    },
    [
      activeThreadId,
      activeWorkspace,
      forkThreadForWorkspace,
      sendMessageToThread,
      updateThreadParent,
    ],
  );

  const startResume = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      if (activeThreadId && threadStatusById[activeThreadId]?.isProcessing) {
        return;
      }
      const threadId = activeThreadId ?? (await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for resume failed",
      ));
      if (!threadId) {
        return;
      }
      await refreshThread(activeWorkspace.id, threadId);
      safeMessageActivity();
    },
    [
      activeThreadId,
      activeWorkspace,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      refreshThread,
      safeMessageActivity,
      threadStatusById,
    ],
  );

  const startCompact = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = activeThreadId ?? (await ensureThreadWithFeedback(
        ensureThreadForActiveWorkspace,
        "thread/start for compact failed",
      ));
      if (!threadId) {
        return;
      }
      try {
        await compactThreadService(activeWorkspace.id, threadId);
      } catch (error) {
        pushThreadErrorMessage(
          threadId,
          error instanceof Error
            ? error.message
            : "Failed to start context compaction.",
        );
      } finally {
        safeMessageActivity();
      }
    },
    [
      activeThreadId,
      activeWorkspace,
      ensureThreadWithFeedback,
      ensureThreadForActiveWorkspace,
      pushThreadErrorMessage,
      safeMessageActivity,
    ],
  );

  return {
    interruptTurn,
    sendUserMessage,
    sendUserMessageToThread,
    startFork,
    startReview,
    startUncommittedReview,
    startResume,
    startCompact,
    startApps,
    startMcp,
    startFast,
    startStatus,
    reviewPrompt,
    openReviewPrompt,
    closeReviewPrompt,
    showPresetStep,
    choosePreset,
    highlightedPresetIndex,
    setHighlightedPresetIndex,
    highlightedBranchIndex,
    setHighlightedBranchIndex,
    highlightedCommitIndex,
    setHighlightedCommitIndex,
    handleReviewPromptKeyDown,
    confirmBranch,
    selectBranch,
    selectBranchAtIndex,
    selectCommit,
    selectCommitAtIndex,
    confirmCommit,
    updateCustomInstructions,
    confirmCustom,
  };
}
