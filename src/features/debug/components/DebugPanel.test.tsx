// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { DebugPanel } from "./DebugPanel";

describe("DebugPanel", () => {
  it("renders simplified chinese copy when locale switches", () => {
    const onCopy = vi.fn();
    const onClear = vi.fn();

    render(
      <I18nProvider locale="zh-CN">
        <DebugPanel entries={[]} isOpen onClear={onClear} onCopy={onCopy} />
      </I18nProvider>,
    );

    expect(screen.getByText("调试")).toBeTruthy();
    expect(screen.getByText("还没有调试事件。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    fireEvent.click(screen.getByRole("button", { name: "清空" }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
