import { memo } from "react";
import AlignLeft from "lucide-react/dist/esm/icons/align-left";
import Columns2 from "lucide-react/dist/esm/icons/columns-2";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import type { SidebarToggleProps } from "../../layout/components/SidebarToggleControls";
import {
  RightPanelCollapseButton,
  RightPanelExpandButton,
} from "../../layout/components/SidebarToggleControls";

type MainHeaderActionsProps = {
  centerMode: "chat" | "diff";
  gitDiffViewStyle: "split" | "unified";
  onSelectDiffViewStyle: (style: "split" | "unified") => void;
  isCompact: boolean;
  rightPanelCollapsed: boolean;
  sidebarToggleProps: SidebarToggleProps;
};

export const MainHeaderActions = memo(function MainHeaderActions({
  centerMode,
  gitDiffViewStyle,
  onSelectDiffViewStyle,
  isCompact,
  rightPanelCollapsed,
  sidebarToggleProps,
}: MainHeaderActionsProps) {
  const locale = useAppLocale();
  return (
    <>
      {centerMode === "diff" && (
        <div
          className="diff-view-toggle"
          role="group"
          aria-label={m.layout_diff_view({}, { locale })}
        >
          <button
            type="button"
            className={`diff-view-toggle-button${
              gitDiffViewStyle === "split" ? " is-active" : ""
            } ds-tooltip-trigger`}
            onClick={() => onSelectDiffViewStyle("split")}
            aria-pressed={gitDiffViewStyle === "split"}
            title={m.layout_dual_panel_diff({}, { locale })}
            data-tooltip={m.layout_dual_panel_diff({}, { locale })}
            data-tooltip-placement="bottom"
            data-tauri-drag-region="false"
          >
            <Columns2 size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={`diff-view-toggle-button${
              gitDiffViewStyle === "unified" ? " is-active" : ""
            } ds-tooltip-trigger`}
            onClick={() => onSelectDiffViewStyle("unified")}
            aria-pressed={gitDiffViewStyle === "unified"}
            title={m.layout_single_column_diff({}, { locale })}
            data-tooltip={m.layout_single_column_diff({}, { locale })}
            data-tooltip-placement="bottom"
            data-tauri-drag-region="false"
          >
            <AlignLeft size={14} aria-hidden />
          </button>
        </div>
      )}
      {!isCompact ? (
        rightPanelCollapsed ? (
          <RightPanelExpandButton {...sidebarToggleProps} />
        ) : (
          <RightPanelCollapseButton {...sidebarToggleProps} />
        )
      ) : null}
    </>
  );
});
