// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { MobileServerSetupWizard } from "./MobileServerSetupWizard";

describe("MobileServerSetupWizard", () => {
  it("renders simplified chinese copy when locale switches", () => {
    render(
      <I18nProvider locale="zh-CN">
        <MobileServerSetupWizard
          remoteHostDraft=""
          remoteTokenDraft=""
          busy={false}
          checking={false}
          statusMessage={null}
          statusError={false}
          onClose={vi.fn()}
          onRemoteHostChange={vi.fn()}
          onRemoteTokenChange={vi.fn()}
          onConnectTest={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("连接到桌面端后端")).toBeTruthy();
    expect(screen.getByLabelText("关闭移动端设置")).toBeTruthy();
    expect(screen.getByLabelText("Tailscale 主机")).toBeTruthy();
    expect(screen.getByRole("button", { name: "连接并测试" })).toBeTruthy();
  });
});
