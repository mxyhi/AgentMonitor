// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { ReviewPromptState } from "../../threads/hooks/useReviewPrompt";
import { ReviewInlinePrompt } from "./ReviewInlinePrompt";

const reviewPrompt: NonNullable<ReviewPromptState> = {
  workspace: {
    id: "workspace-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: { sidebarCollapsed: false },
  },
  threadIdSnapshot: "thread-1",
  step: "preset",
  branches: [],
  commits: [],
  isLoadingBranches: false,
  isLoadingCommits: false,
  selectedBranch: "",
  selectedCommitSha: "",
  selectedCommitTitle: "",
  customInstructions: "",
  error: null,
  isSubmitting: false,
};

describe("ReviewInlinePrompt", () => {
  it("renders localized preset copy in zh-CN", () => {
    render(
      <I18nProvider locale="zh-CN">
        <ReviewInlinePrompt
          reviewPrompt={reviewPrompt}
          onClose={vi.fn()}
          onShowPreset={vi.fn()}
          onChoosePreset={vi.fn()}
          highlightedPresetIndex={0}
          onHighlightPreset={vi.fn()}
          highlightedBranchIndex={0}
          onHighlightBranch={vi.fn()}
          highlightedCommitIndex={0}
          onHighlightCommit={vi.fn()}
          onSelectBranch={vi.fn()}
          onSelectBranchAtIndex={vi.fn()}
          onConfirmBranch={vi.fn()}
          onSelectCommit={vi.fn()}
          onSelectCommitAtIndex={vi.fn()}
          onConfirmCommit={vi.fn()}
          onUpdateCustomInstructions={vi.fn()}
          onConfirmCustom={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("选择审查预设")).toBeTruthy();
    expect(screen.getByText("基于基础分支审查")).toBeTruthy();
    expect(screen.getByText("审查未提交改动")).toBeTruthy();
    expect(screen.getByText("自定义审查说明")).toBeTruthy();
  });
});
