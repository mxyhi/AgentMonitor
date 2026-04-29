// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDebugLog } from "./useDebugLog";

describe("useDebugLog", () => {
  it("keeps error-labeled events when the debug panel is closed", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "event-error",
        timestamp: 1,
        source: "event",
        label: "error",
        payload: { message: "app-server failed" },
      });
    });

    expect(result.current.debugEntries).toHaveLength(1);
    expect(result.current.hasDebugAlerts).toBe(true);
  });
});

