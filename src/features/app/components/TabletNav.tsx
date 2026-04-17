import type { ReactNode } from "react";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";

type TabletNavTab = "codex" | "git" | "log";

type TabletNavProps = {
  activeTab: TabletNavTab;
  onSelect: (tab: TabletNavTab) => void;
};

export function TabletNav({ activeTab, onSelect }: TabletNavProps) {
  const locale = useAppLocale();
  const tabs: { id: TabletNavTab; label: string; icon: ReactNode }[] = [
    { id: "codex", label: m.tab_codex({}, { locale }), icon: <MessagesSquare className="tablet-nav-icon" /> },
    { id: "git", label: m.tab_git({}, { locale }), icon: <GitBranch className="tablet-nav-icon" /> },
    { id: "log", label: m.tab_log({}, { locale }), icon: <TerminalSquare className="tablet-nav-icon" /> },
  ];
  return (
    <nav className="tablet-nav" aria-label={m.tab_workspace({}, { locale })}>
      <div className="tablet-nav-group">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tablet-nav-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onSelect(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
            <span className="tablet-nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
