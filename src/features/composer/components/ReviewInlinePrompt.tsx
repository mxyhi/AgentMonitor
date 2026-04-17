import { memo, useMemo } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import type {
  ReviewPromptState,
  ReviewPromptStep,
} from "../../threads/hooks/useReviewPrompt";

type ReviewInlinePromptProps = {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onClose: () => void;
  onShowPreset: () => void;
  onChoosePreset: (preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted") => void;
  highlightedPresetIndex: number;
  onHighlightPreset: (index: number) => void;
  highlightedBranchIndex: number;
  onHighlightBranch: (index: number) => void;
  highlightedCommitIndex: number;
  onHighlightCommit: (index: number) => void;
  onSelectBranch: (value: string) => void;
  onSelectBranchAtIndex: (index: number) => void;
  onConfirmBranch: () => Promise<void>;
  onSelectCommit: (sha: string, title: string) => void;
  onSelectCommitAtIndex: (index: number) => void;
  onConfirmCommit: () => Promise<void>;
  onUpdateCustomInstructions: (value: string) => void;
  onConfirmCustom: () => Promise<void>;
};

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

const PresetStep = memo(function PresetStep({
  onChoosePreset,
  isSubmitting,
  highlightedPresetIndex,
  onHighlightPreset,
}: {
  onChoosePreset: ReviewInlinePromptProps["onChoosePreset"];
  isSubmitting: boolean;
  highlightedPresetIndex: number;
  onHighlightPreset: (index: number) => void;
}) {
  const locale = useAppLocale();
  const optionClass = (index: number) =>
    `review-inline-option${index === highlightedPresetIndex ? " is-selected" : ""}`;
  return (
    <div className="review-inline-section">
      <button
        type="button"
        className={optionClass(0)}
        onClick={() => onChoosePreset("baseBranch")}
        onMouseEnter={() => onHighlightPreset(0)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">
          {m.review_prompt_preset_base_branch({}, { locale })}
        </span>
        <span className="review-inline-option-subtitle">
          {m.review_prompt_preset_pr_style({}, { locale })}
        </span>
      </button>
      <button
        type="button"
        className={optionClass(1)}
        onClick={() => onChoosePreset("uncommitted")}
        onMouseEnter={() => onHighlightPreset(1)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">
          {m.review_prompt_preset_uncommitted({}, { locale })}
        </span>
      </button>
      <button
        type="button"
        className={optionClass(2)}
        onClick={() => onChoosePreset("commit")}
        onMouseEnter={() => onHighlightPreset(2)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">
          {m.review_prompt_preset_commit({}, { locale })}
        </span>
      </button>
      <button
        type="button"
        className={optionClass(3)}
        onClick={() => onChoosePreset("custom")}
        onMouseEnter={() => onHighlightPreset(3)}
        disabled={isSubmitting}
      >
        <span className="review-inline-option-title">
          {m.review_prompt_preset_custom({}, { locale })}
        </span>
      </button>
    </div>
  );
});

const BaseBranchStep = memo(function BaseBranchStep({
  reviewPrompt,
  onShowPreset,
  onSelectBranch,
  onSelectBranchAtIndex,
  onConfirmBranch,
  highlightedBranchIndex,
  onHighlightBranch,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onSelectBranch: (value: string) => void;
  onSelectBranchAtIndex: (index: number) => void;
  onConfirmBranch: () => Promise<void>;
  highlightedBranchIndex: number;
  onHighlightBranch: (index: number) => void;
}) {
  const locale = useAppLocale();
  const branches = reviewPrompt.branches;
  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <button
          type="button"
          className="ghost review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          {m.review_prompt_back({}, { locale })}
        </button>
        <button
          type="button"
          className="primary review-inline-confirm"
          onClick={() => void onConfirmBranch()}
          disabled={reviewPrompt.isSubmitting || !reviewPrompt.selectedBranch.trim()}
        >
          {m.review_prompt_start({}, { locale })}
        </button>
      </div>
      <div className="review-inline-hint">
        {m.review_prompt_pick_local_branch({}, { locale })}
      </div>
      <div
        className="review-inline-list"
        role="listbox"
        aria-label={m.review_prompt_base_branches({}, { locale })}
      >
        {reviewPrompt.isLoadingBranches ? (
          <div className="review-inline-empty">
            {m.review_prompt_loading_branches({}, { locale })}
          </div>
        ) : branches.length === 0 ? (
          <div className="review-inline-empty">
            {m.review_prompt_no_branches({}, { locale })}
          </div>
        ) : (
          branches.map((branch, index) => {
            const selected = index === highlightedBranchIndex;
            return (
              <button
                key={branch.name}
                type="button"
                role="option"
                aria-selected={selected}
                className={`review-inline-list-item${selected ? " is-selected" : ""}`}
                onClick={() => onSelectBranch(branch.name)}
                onMouseEnter={() => {
                  onHighlightBranch(index);
                  onSelectBranchAtIndex(index);
                }}
                disabled={reviewPrompt.isSubmitting}
              >
                {branch.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

const CommitStep = memo(function CommitStep({
  reviewPrompt,
  onShowPreset,
  onSelectCommit,
  onSelectCommitAtIndex,
  onConfirmCommit,
  highlightedCommitIndex,
  onHighlightCommit,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onSelectCommit: (sha: string, title: string) => void;
  onSelectCommitAtIndex: (index: number) => void;
  onConfirmCommit: () => Promise<void>;
  highlightedCommitIndex: number;
  onHighlightCommit: (index: number) => void;
}) {
  const locale = useAppLocale();
  const commits = reviewPrompt.commits;
  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <button
          type="button"
          className="ghost review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          {m.review_prompt_back({}, { locale })}
        </button>
        <button
          type="button"
          className="primary review-inline-confirm"
          onClick={() => void onConfirmCommit()}
          disabled={reviewPrompt.isSubmitting || !reviewPrompt.selectedCommitSha}
        >
          {m.review_prompt_start({}, { locale })}
        </button>
      </div>
      <div className="review-inline-hint">
        {m.review_prompt_pick_commit({}, { locale })}
      </div>
      <div
        className="review-inline-list"
        role="listbox"
        aria-label={m.review_prompt_commits({}, { locale })}
      >
        {reviewPrompt.isLoadingCommits ? (
          <div className="review-inline-empty">
            {m.review_prompt_loading_commits({}, { locale })}
          </div>
        ) : commits.length === 0 ? (
          <div className="review-inline-empty">
            {m.review_prompt_no_commits({}, { locale })}
          </div>
        ) : (
          commits.map((commit, index) => {
            const title = commit.summary || commit.sha;
            const selected = index === highlightedCommitIndex;
            return (
              <button
                key={commit.sha}
                type="button"
                role="option"
                aria-selected={selected}
                className={`review-inline-list-item review-inline-commit${
                  selected ? " is-selected" : ""
                }`}
                onClick={() => onSelectCommit(commit.sha, title)}
                onMouseEnter={() => {
                  onHighlightCommit(index);
                  onSelectCommitAtIndex(index);
                }}
                disabled={reviewPrompt.isSubmitting}
              >
                <span className="review-inline-commit-title">{title}</span>
                <span className="review-inline-commit-meta">{shortSha(commit.sha)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

const CustomStep = memo(function CustomStep({
  reviewPrompt,
  onShowPreset,
  onUpdateCustomInstructions,
  onConfirmCustom,
}: {
  reviewPrompt: NonNullable<ReviewPromptState>;
  onShowPreset: () => void;
  onUpdateCustomInstructions: (value: string) => void;
  onConfirmCustom: () => Promise<void>;
}) {
  const locale = useAppLocale();
  const canSubmit = reviewPrompt.customInstructions.trim().length > 0;
  return (
    <div className="review-inline-section">
      <div className="review-inline-row">
        <button
          type="button"
          className="ghost review-inline-back"
          onClick={onShowPreset}
          disabled={reviewPrompt.isSubmitting}
        >
          {m.review_prompt_back({}, { locale })}
        </button>
        <button
          type="button"
          className="primary review-inline-confirm"
          onClick={() => void onConfirmCustom()}
          disabled={reviewPrompt.isSubmitting || !canSubmit}
        >
          {m.review_prompt_start({}, { locale })}
        </button>
      </div>
      <label className="review-inline-label" htmlFor="review-inline-custom-instructions">
        {m.review_prompt_instructions({}, { locale })}
      </label>
      <textarea
        id="review-inline-custom-instructions"
        className="review-inline-textarea"
        value={reviewPrompt.customInstructions}
        onChange={(event) => onUpdateCustomInstructions(event.target.value)}
        placeholder={m.review_prompt_instructions_placeholder({}, { locale })}
        autoFocus
        rows={6}
      />
    </div>
  );
});

export const ReviewInlinePrompt = memo(function ReviewInlinePrompt({
  reviewPrompt,
  onClose,
  onShowPreset,
  onChoosePreset,
  highlightedPresetIndex,
  onHighlightPreset,
  highlightedBranchIndex,
  onHighlightBranch,
  highlightedCommitIndex,
  onHighlightCommit,
  onSelectBranch,
  onSelectBranchAtIndex,
  onConfirmBranch,
  onSelectCommit,
  onSelectCommitAtIndex,
  onConfirmCommit,
  onUpdateCustomInstructions,
  onConfirmCustom,
}: ReviewInlinePromptProps) {
  const locale = useAppLocale();
  const { step, error, isSubmitting } = reviewPrompt;

  const title = useMemo(() => {
    switch (step) {
      case "baseBranch":
        return m.review_prompt_title_base_branch({}, { locale });
      case "commit":
        return m.review_prompt_title_commit({}, { locale });
      case "custom":
        return m.review_prompt_title_custom({}, { locale });
      case "preset":
      default:
        return m.review_prompt_title_preset({}, { locale });
    }
  }, [locale, step]);

  return (
    <div className="review-inline" role="dialog" aria-label={title}>
      <div className="review-inline-header">
        <div className="review-inline-title">{title}</div>
        <div className="review-inline-subtitle">{reviewPrompt.workspace.name}</div>
      </div>

      {step === "preset" ? (
        <PresetStep
          onChoosePreset={onChoosePreset}
          isSubmitting={isSubmitting}
          highlightedPresetIndex={highlightedPresetIndex}
          onHighlightPreset={onHighlightPreset}
        />
      ) : step === "baseBranch" ? (
        <BaseBranchStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onSelectBranch={onSelectBranch}
          onSelectBranchAtIndex={onSelectBranchAtIndex}
          onConfirmBranch={onConfirmBranch}
          highlightedBranchIndex={highlightedBranchIndex}
          onHighlightBranch={onHighlightBranch}
        />
      ) : step === "commit" ? (
        <CommitStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onSelectCommit={onSelectCommit}
          onSelectCommitAtIndex={onSelectCommitAtIndex}
          onConfirmCommit={onConfirmCommit}
          highlightedCommitIndex={highlightedCommitIndex}
          onHighlightCommit={onHighlightCommit}
        />
      ) : (
        <CustomStep
          reviewPrompt={reviewPrompt}
          onShowPreset={onShowPreset}
          onUpdateCustomInstructions={onUpdateCustomInstructions}
          onConfirmCustom={onConfirmCustom}
        />
      )}

      {error && <div className="review-inline-error">{error}</div>}

      <div className="review-inline-actions">
        <button type="button" className="ghost review-inline-button" onClick={onClose}>
          {m.action_close({}, { locale })}
        </button>
      </div>
    </div>
  );
});
