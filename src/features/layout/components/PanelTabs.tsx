import { useRef, type KeyboardEvent, type ReactNode } from "react";
import Folder from "lucide-react/dist/esm/icons/folder";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";

export type PanelTabId = "git" | "files" | "prompts";

type PanelTab = {
  id: PanelTabId;
  label: string;
  icon: ReactNode;
};

type PanelTabsProps = {
  active: PanelTabId;
  onSelect: (id: PanelTabId) => void;
  tabs?: PanelTab[];
};

const defaultTabs: PanelTab[] = [
  { id: "git", label: "Git", icon: <GitBranch aria-hidden /> },
  { id: "files", label: "Files", icon: <Folder aria-hidden /> },
  { id: "prompts", label: "Prompts", icon: <ScrollText aria-hidden /> },
];

export function PanelTabs({ active, onSelect, tabs = defaultTabs }: PanelTabsProps) {
  const locale = useAppLocale();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = tabs.findIndex((tab) => tab.id === active);
  const focusableIndex = activeIndex >= 0 ? activeIndex : 0;
  const localizedTabs =
    tabs === defaultTabs
      ? [
          { ...defaultTabs[0], label: m.panel_tabs_git({}, { locale }) },
          { ...defaultTabs[1], label: m.panel_tabs_files({}, { locale }) },
          { ...defaultTabs[2], label: m.panel_tabs_prompts({}, { locale }) },
        ]
      : tabs;

  const selectByIndex = (index: number, options?: { focus?: boolean }) => {
    if (tabs.length === 0) {
      return;
    }
    const normalized = (index + localizedTabs.length) % localizedTabs.length;
    onSelect(localizedTabs[normalized].id);
    if (options?.focus) {
      tabRefs.current[normalized]?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (localizedTabs.length <= 1) {
      return;
    }
    const currentIndex = activeIndex >= 0 ? activeIndex : index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectByIndex(currentIndex + 1, { focus: true });
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectByIndex(currentIndex - 1, { focus: true });
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectByIndex(0, { focus: true });
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectByIndex(localizedTabs.length - 1, { focus: true });
    }
  };

  return (
    <div
      className="panel-tabs"
      role="tablist"
      aria-label={m.panel_tabs_aria({}, { locale })}
      aria-orientation="horizontal"
    >
      {localizedTabs.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`panel-tab${isActive ? " is-active" : ""}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={index === focusableIndex ? 0 : -1}
            aria-label={tab.label}
            title={tab.label}
          >
            <span className="panel-tab-icon" aria-hidden>
              {tab.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}
