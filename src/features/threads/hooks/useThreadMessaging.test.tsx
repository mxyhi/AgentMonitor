/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import {
  sendUserMessage as sendUserMessageService,
  steerTurn as steerTurnService,
  startReview as startReviewService,
  interruptTurn as interruptTurnService,
  getAppsList as getAppsListService,
  listMcpServerStatus as listMcpServerStatusService,
  compactThread as compactThreadService,
  getAccountInfo as getAccountInfoService,
  getGlobalAiSettings as getGlobalAiSettingsService,
} from "@services/tauri";
import type { WorkspaceInfo } from "@/types";
import { OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR } from "../utils/threadErrorMessages";
import { useThreadMessaging } from "./useThreadMessaging";

vi.mock("@sentry/react", () => ({
  metrics: {
    count: vi.fn(),
  },
}));

vi.mock("@services/tauri", () => ({
  sendUserMessage: vi.fn(),
  steerTurn: vi.fn(),
  startReview: vi.fn(),
  interruptTurn: vi.fn(),
  getAppsList: vi.fn(),
  listMcpServerStatus: vi.fn(),
  compactThread: vi.fn(),
  getAccountInfo: vi.fn(),
  getGlobalAiSettings: vi.fn(),
}));

vi.mock("./useReviewPrompt", () => ({
  useReviewPrompt: () => ({
    reviewPrompt: null,
    openReviewPrompt: vi.fn(),
    closeReviewPrompt: vi.fn(),
    showPresetStep: vi.fn(),
    choosePreset: vi.fn(),
    highlightedPresetIndex: 0,
    setHighlightedPresetIndex: vi.fn(),
    highlightedBranchIndex: 0,
    setHighlightedBranchIndex: vi.fn(),
    highlightedCommitIndex: 0,
    setHighlightedCommitIndex: vi.fn(),
    handleReviewPromptKeyDown: vi.fn(() => false),
    confirmBranch: vi.fn(),
    selectBranch: vi.fn(),
    selectBranchAtIndex: vi.fn(),
    selectCommit: vi.fn(),
    selectCommitAtIndex: vi.fn(),
    confirmCommit: vi.fn(),
    updateCustomInstructions: vi.fn(),
    confirmCustom: vi.fn(),
  }),
}));

describe("useThreadMessaging telemetry", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValue({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "airouter",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: "sk-airouter",
          builtIn: true,
        },
      ],
    });
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(steerTurnService).mockResolvedValue(
      {
        result: {
          turnId: "turn-1",
        },
      } as unknown as Awaited<ReturnType<typeof steerTurnService>>,
    );
    vi.mocked(startReviewService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startReviewService>>,
    );
    vi.mocked(interruptTurnService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof interruptTurnService>>,
    );
    vi.mocked(getAppsListService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getAppsListService>>,
    );
    vi.mocked(listMcpServerStatusService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof listMcpServerStatusService>>,
    );
    vi.mocked(compactThreadService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof compactThreadService>>,
    );
  });

  it("records prompt_sent once for one message send", async () => {
    const ensureWorkspaceRuntimeCodexArgs = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        ensureWorkspaceRuntimeCodexArgs,
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
    });

    expect(Sentry.metrics.count).toHaveBeenCalledTimes(1);
    expect(Sentry.metrics.count).toHaveBeenCalledWith(
      "prompt_sent",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          workspace_id: "ws-1",
          thread_id: "thread-1",
          has_images: "false",
          text_length: "5",
        }),
      }),
    );
    expect(ensureWorkspaceRuntimeCodexArgs).toHaveBeenCalledTimes(1);
    expect(ensureWorkspaceRuntimeCodexArgs).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("blocks turn/start when account/read says OpenAI auth is required but no account exists", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "openai",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          baseUrl: null,
          apiKey: null,
          builtIn: true,
        },
      ],
    });
    vi.mocked(getAccountInfoService).mockResolvedValueOnce({
      result: {
        account: null,
        requiresOpenaiAuth: true,
      },
    } as Awaited<ReturnType<typeof getAccountInfoService>>);
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity,
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "blocked" });
    });

    expect(getAccountInfoService).toHaveBeenCalledWith("ws-1");
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      OPENAI_AUTH_REQUIRED_BEFORE_SENDING_ERROR,
    );
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("does not block turn/start when openai provider already has an API key", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "openai",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: null,
          builtIn: true,
        },
        {
          id: "openai",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-openai",
          builtIn: true,
        },
        {
          id: "local",
          name: "Local",
          baseUrl: "http://127.0.0.1:9208/v1",
          apiKey: null,
          builtIn: true,
        },
      ],
    });
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "sent" });
    });

    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
  });

  it("does not block turn/start when fixed airouter provider is configured even if OpenAI auth is missing", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "airouter",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: "test-key",
          builtIn: true,
        },
      ],
    });
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "sent" });
    });

    expect(getGlobalAiSettingsService).toHaveBeenCalledTimes(1);
    expect(getAccountInfoService).not.toHaveBeenCalled();
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
  });

  it("blocks turn/start and requests AI setup when airouter API key is missing", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const onRequireAiSetup = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "airouter",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: null,
          builtIn: true,
        },
      ],
    });
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity,
        onDebug: vi.fn(),
        onRequireAiSetup,
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "blocked" });
    });

    expect(getAccountInfoService).not.toHaveBeenCalled();
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
    expect(onRequireAiSetup).toHaveBeenCalledTimes(1);
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("still requests AI setup when airouter API key is missing even if account/read throws", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const onRequireAiSetup = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "airouter",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: null,
          builtIn: true,
        },
      ],
    });
    vi.mocked(getAccountInfoService).mockRejectedValueOnce(
      new Error("account/read exploded"),
    );

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity,
        onDebug: vi.fn(),
        onRequireAiSetup,
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "blocked" });
    });

    expect(getGlobalAiSettingsService).toHaveBeenCalledTimes(1);
    expect(getAccountInfoService).not.toHaveBeenCalled();
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
    expect(onRequireAiSetup).toHaveBeenCalledTimes(1);
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("blocks turn/start when account/read preflight returns an rpc error", async () => {
    const markProcessing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    vi.mocked(getGlobalAiSettingsService).mockResolvedValueOnce({
      configPath: "/tmp/config.toml",
      sessionDefaults: {
        modelProvider: "openai",
        model: null,
        modelReasoningEffort: null,
      },
      providers: [
        {
          id: "airouter",
          name: "Airouter",
          baseUrl: "https://airouter.mxyhi.com/v1",
          apiKey: "sk-airouter",
          builtIn: true,
        },
        {
          id: "openai",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: null,
          builtIn: true,
        },
      ],
    });
    vi.mocked(getAccountInfoService).mockResolvedValueOnce({
      error: {
        code: -32600,
        message: "Invalid request: missing field `params`",
      },
    } as Awaited<ReturnType<typeof getAccountInfoService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity,
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "blocked" });
    });

    expect(getAccountInfoService).toHaveBeenCalledWith("ws-1");
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Failed to read account state before sending: Invalid request: missing field `params`",
    );
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("forwards explicit app mentions to turn/start", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessage("hello $calendar", [], [
        { name: "Calendar App", path: "app://connector_calendar" },
      ]);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello $calendar",
      expect.objectContaining({
        appMentions: [{ name: "Calendar App", path: "app://connector_calendar" }],
      }),
    );
  });

  it("forwards the selected service tier to turn/start", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        serviceTier: "fast",
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessage("hello");
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        serviceTier: "fast",
      }),
    );
  });

  it("replaces missing threads and retries turn/start once", async () => {
    const replaceMissingThread = vi.fn(async () => "thread-2");
    const setActiveTurnId = vi.fn();
    vi.mocked(sendUserMessageService)
      .mockResolvedValueOnce({
        error: { message: "thread not found: thread-1" },
      } as Awaited<ReturnType<typeof sendUserMessageService>>)
      .mockResolvedValueOnce({
        result: {
          turn: { id: "turn-2" },
        },
      } as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        replaceMissingThread,
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
      expect(sendResult).toEqual({ status: "sent" });
    });

    expect(replaceMissingThread).toHaveBeenCalledWith("ws-1", "thread-1", {
      activate: true,
    });
    expect(sendUserMessageService).toHaveBeenCalledTimes(2);
    expect(sendUserMessageService).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "thread-2",
      "hello",
      expect.any(Object),
    );
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-2", "turn-2");
    expect(Sentry.metrics.count).toHaveBeenCalledTimes(1);
  });

  it("omits service tier when no override is selected", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        serviceTier: undefined,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessage("hello");
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.not.objectContaining({
        serviceTier: expect.anything(),
      }),
    );
  });

  it("does not forward service tier to review/start", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        serviceTier: "fast",
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startUncommittedReview();
    });

    expect(startReviewService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      { type: "uncommittedChanges" },
      "inline",
    );
  });

  it("toggles fast mode through the built-in handler", async () => {
    const dispatch = vi.fn();
    const onSelectServiceTier = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        serviceTier: null,
        collaborationMode: null,
        onSelectServiceTier,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startFast("/fast on");
    });

    expect(onSelectServiceTier).toHaveBeenCalledWith("fast");
    expect(dispatch).toHaveBeenCalledWith({
      type: "addAssistantMessage",
      threadId: "thread-1",
      text: "Fast mode enabled.",
    });
  });

  it("uses turn/steer when steer mode is enabled and an active turn is present", async () => {
    const dispatch = vi.fn();
    const ensureWorkspaceRuntimeCodexArgs = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        ensureWorkspaceRuntimeCodexArgs,
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer this",
        [],
      );
    });

    expect(steerTurnService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "steer this",
      [],
    );
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(ensureWorkspaceRuntimeCodexArgs).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "upsertItem" }),
    );
  });

  it("resets stale processing state when turn/steer reports no active turn", async () => {
    const pushThreadErrorMessage = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: { message: "no active turn to steer" },
    } as unknown as Awaited<ReturnType<typeof steerTurnService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer should fail",
        [],
      );
      expect(sendResult).toEqual({ status: "steer_failed" });
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: no active turn to steer",
    );
  });

  it("clears processing state when turn/steer returns an rpc error", async () => {
    const pushThreadErrorMessage = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: { message: "steer request timed out" },
    } as unknown as Awaited<ReturnType<typeof steerTurnService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer timeout",
        [],
      );
      expect(sendResult).toEqual({ status: "steer_failed" });
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: steer request timed out",
    );
  });

  it("returns steer_failed and clears processing state when turn/steer throws", async () => {
    const pushThreadErrorMessage = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    vi.mocked(steerTurnService).mockRejectedValueOnce(
      new Error("steer network failure"),
    );

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      const sendResult = await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer exception",
        [],
      );
      expect(sendResult).toEqual({ status: "steer_failed" });
    });

    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: steer network failure",
    );
  });

  it("latches pending interrupt and clears local turn state before awaiting stop", async () => {
    const pendingInterruptsRef = { current: new Set<string>() };
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const dispatch = vi.fn();

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef,
        dispatch,
        getCustomName: vi.fn(() => undefined),
        markProcessing,
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(pendingInterruptsRef.current.has("thread-1")).toBe(true);
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(dispatch).toHaveBeenCalledWith({
      type: "addAssistantMessage",
      threadId: "thread-1",
      text: "Session stopped.",
    });
    expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
  });

  it("clears pending interrupt when stop submission itself fails", async () => {
    const pendingInterruptsRef = { current: new Set<string>() };
    vi.mocked(interruptTurnService).mockRejectedValueOnce(new Error("stop failed"));

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef,
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(pendingInterruptsRef.current.has("thread-1")).toBe(false);
  });

  it("routes uncommitted review to an explicit workspace override", async () => {
    const ensureThreadForActiveWorkspace = vi.fn(async () => "thread-active");
    const ensureThreadForWorkspace = vi.fn(async () => "thread-override");

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-active",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "detached",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace,
        ensureThreadForWorkspace,
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startUncommittedReview("ws-2");
    });

    expect(ensureThreadForActiveWorkspace).not.toHaveBeenCalled();
    expect(ensureThreadForWorkspace).toHaveBeenCalledWith("ws-2");
    expect(startReviewService).toHaveBeenCalledWith(
      "ws-2",
      "thread-override",
      { type: "uncommittedChanges" },
      "detached",
    );
  });

  it("names detached commit review child threads from commit context", async () => {
    vi.mocked(startReviewService).mockResolvedValueOnce({
      result: {
        review_thread_id: "thread-review-1",
      },
    } as unknown as Awaited<ReturnType<typeof startReviewService>>);
    const renameThread = vi.fn();

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-parent",
        accessMode: "current",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "detached",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-parent"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-parent"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
        renameThread,
      }),
    );

    await act(async () => {
      await result.current.startReview(
        "/review commit abcdef1234567890 Tighten sidebar commit selection",
      );
    });

    expect(renameThread).toHaveBeenCalledWith(
      "ws-1",
      "thread-review-1",
      "Review abcdef1: Tighten sidebar commit…",
    );
  });
});
