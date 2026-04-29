import { describe, expect, it } from "vitest";
import { buildAppServerEventDebugEntry, buildErrorDebugEntry } from "./debugEntries";

describe("debugEntries", () => {
  it("classifies app-server error notifications as error debug entries", () => {
    const entry = buildAppServerEventDebugEntry(
      {
        workspace_id: "ws-1",
        message: {
          method: "error",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            willRetry: false,
            error: { message: "Codex app-server output ended." },
          },
        },
      },
      123,
    );

    expect(entry).toEqual({
      id: "123-server-error",
      timestamp: 123,
      source: "error",
      label: "error",
      payload: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        turnId: "turn-1",
        willRetry: false,
        message: "Codex app-server output ended.",
        error: { message: "Codex app-server output ended." },
        event: {
          workspace_id: "ws-1",
          message: {
            method: "error",
            params: {
              threadId: "thread-1",
              turnId: "turn-1",
              willRetry: false,
              error: { message: "Codex app-server output ended." },
            },
          },
        },
      },
    });
  });

  it("keeps stack traces for client errors", () => {
    const error = new Error("bridge failed");
    error.stack = "Error: bridge failed\n    at test";

    const entry = buildErrorDebugEntry("turn/start error", error);

    expect(entry.source).toBe("error");
    expect(entry.payload).toEqual({
      name: "Error",
      message: "bridge failed",
      stack: "Error: bridge failed\n    at test",
    });
  });
});

