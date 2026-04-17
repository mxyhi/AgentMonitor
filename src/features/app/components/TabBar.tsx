import type { ReactNode } from "react";
import FolderKanban from "lucide-react/dist/esm/icons/folder-kanban";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import House from "lucide-react/dist/esm/icons/house";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";

type TabKey = "home" | "projects" | "codex" | "git" | "log";

type TabBarProps = {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
};

export function TabBar({ activeTab, onSelect }: TabBarProps) {
  const locale = useAppLocale();
  const tabs: { id: TabKey; label: string; icon: ReactNode }[] = [
    { id: "home", label: m.tab_home({}, { locale }), icon: <House className="tabbar-icon" /> },
    {
      id: "projects",
      label: m.tab_projects({}, { locale }),
      icon: <FolderKanban className="tabbar-icon" />,
    },
    { id: "codex", label: m.tab_codex({}, { locale }), icon: <MessagesSquare className="tabbar-icon" /> },
    { id: "git", label: m.tab_git({}, { locale }), icon: <GitBranch className="tabbar-icon" /> },
    { id: "log", label: m.tab_log({}, { locale }), icon: <TerminalSquare className="tabbar-icon" /> },
  ];
  return (
    <nav className="tabbar" aria-label={m.tab_primary({}, { locale })}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tabbar-item ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onSelect(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.icon}
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
