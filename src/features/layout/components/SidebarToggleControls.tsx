import PanelLeftClose from "lucide-react/dist/esm/icons/panel-left-close";
import PanelLeftOpen from "lucide-react/dist/esm/icons/panel-left-open";
import PanelRightClose from "lucide-react/dist/esm/icons/panel-right-close";
import PanelRightOpen from "lucide-react/dist/esm/icons/panel-right-open";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

export type SidebarToggleProps = {
  isCompact: boolean;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  onCollapseRightPanel: () => void;
  onExpandRightPanel: () => void;
};

export function SidebarCollapseButton({
  isCompact,
  sidebarCollapsed,
  onCollapseSidebar,
}: SidebarToggleProps) {
  const locale = useAppLocale();
  if (isCompact || sidebarCollapsed) {
    return null;
  }
  return (
    <button
      type="button"
      className="ghost main-header-action ds-tooltip-trigger"
      onClick={onCollapseSidebar}
      data-tauri-drag-region="false"
      aria-label={m.layout_hide_threads_sidebar({}, { locale })}
      title={m.layout_hide_threads_sidebar({}, { locale })}
      data-tooltip={m.layout_hide_threads_sidebar({}, { locale })}
      data-tooltip-placement="bottom"
    >
      <PanelLeftClose size={14} aria-hidden />
    </button>
  );
}

export function RightPanelCollapseButton({
  isCompact,
  rightPanelCollapsed,
  onCollapseRightPanel,
}: SidebarToggleProps) {
  const locale = useAppLocale();
  if (isCompact || rightPanelCollapsed) {
    return null;
  }
  return (
    <button
      type="button"
      className="ghost main-header-action ds-tooltip-trigger"
      onClick={onCollapseRightPanel}
      data-tauri-drag-region="false"
      aria-label={m.layout_hide_git_sidebar({}, { locale })}
      title={m.layout_hide_git_sidebar({}, { locale })}
      data-tooltip={m.layout_hide_git_sidebar({}, { locale })}
      data-tooltip-placement="bottom"
    >
      <PanelRightClose size={14} aria-hidden />
    </button>
  );
}

export function RightPanelExpandButton({
  isCompact,
  rightPanelCollapsed,
  onExpandRightPanel,
}: SidebarToggleProps) {
  const locale = useAppLocale();
  if (isCompact || !rightPanelCollapsed) {
    return null;
  }
  return (
    <button
      type="button"
      className="ghost main-header-action ds-tooltip-trigger"
      onClick={onExpandRightPanel}
      data-tauri-drag-region="false"
      aria-label={m.layout_show_git_sidebar({}, { locale })}
      title={m.layout_show_git_sidebar({}, { locale })}
      data-tooltip={m.layout_show_git_sidebar({}, { locale })}
      data-tooltip-placement="bottom"
    >
      <PanelRightOpen size={14} aria-hidden />
    </button>
  );
}

export function TitlebarExpandControls({
  isCompact,
  sidebarCollapsed,
  onExpandSidebar,
}: SidebarToggleProps) {
  const locale = useAppLocale();
  if (isCompact || !sidebarCollapsed) {
    return null;
  }
  return (
    <div className="titlebar-controls">
      {sidebarCollapsed && (
        <div className="titlebar-toggle titlebar-toggle-left">
          <button
            type="button"
            className="ghost main-header-action ds-tooltip-trigger"
            onClick={onExpandSidebar}
            data-tauri-drag-region="false"
            aria-label={m.layout_show_threads_sidebar({}, { locale })}
            title={m.layout_show_threads_sidebar({}, { locale })}
            data-tooltip={m.layout_show_threads_sidebar({}, { locale })}
            data-tooltip-placement="bottom"
          >
            <PanelLeftOpen size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
