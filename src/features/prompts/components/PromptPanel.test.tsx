// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { PromptPanel } from "./PromptPanel";

describe("PromptPanel", () => {
  it("renders localized section labels in zh-CN", () => {
    render(
      <I18nProvider locale="zh-CN">
        <PromptPanel
          prompts={[]}
          workspacePath="/tmp/workspace"
          filePanelMode="prompts"
          onFilePanelModeChange={vi.fn()}
          onSendPrompt={vi.fn()}
          onSendPromptToNewAgent={vi.fn()}
          onCreatePrompt={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeletePrompt={vi.fn()}
          onMovePrompt={vi.fn()}
          onRevealWorkspacePrompts={vi.fn()}
          onRevealGeneralPrompts={vi.fn()}
          canRevealGeneralPrompts={true}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("工作区提示词")).toBeTruthy();
    expect(screen.getByText("通用提示词")).toBeTruthy();
    expect(screen.getByPlaceholderText("筛选提示词")).toBeTruthy();
  });
});
