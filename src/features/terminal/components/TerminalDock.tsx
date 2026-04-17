import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import * as m from "@/i18n/messages";
import { useAppLocale } from "@/i18n/I18nProvider";
import type { TerminalTab } from "../hooks/useTerminalTabs";

type TerminalDockProps = {
  isOpen: boolean;
  terminals: TerminalTab[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (terminalId: string) => void;
  onResizeStart?: (event: ReactMouseEvent) => void;
  terminalNode: ReactNode;
};

export function TerminalDock({
  isOpen,
  terminals,
  activeTerminalId,
  onSelectTerminal,
  onNewTerminal,
  onCloseTerminal,
  onResizeStart,
  terminalNode,
}: TerminalDockProps) {
  const locale = useAppLocale();
  if (!isOpen) {
    return null;
  }

  return (
    <section className="terminal-panel">
      {onResizeStart && (
        <div
          className="terminal-panel-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label={m.terminal_resize_panel({}, { locale })}
          onMouseDown={onResizeStart}
        />
      )}
      <div className="terminal-header">
        <div
          className="terminal-tabs"
          role="tablist"
          aria-label={m.terminal_tabs_aria({}, { locale })}
        >
          {terminals.map((tab) => (
            <button
              key={tab.id}
              className={`terminal-tab${
                tab.id === activeTerminalId ? " active" : ""
              }`}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTerminalId}
              onClick={() => onSelectTerminal(tab.id)}
            >
              <span className="terminal-tab-label">{tab.title}</span>
              <span
                className="terminal-tab-close"
                role="button"
                aria-label={m.terminal_close_tab({ value: tab.title }, { locale })}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTerminal(tab.id);
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button
            className="terminal-tab-add"
            type="button"
            onClick={onNewTerminal}
            aria-label={m.terminal_new({}, { locale })}
            title={m.terminal_new({}, { locale })}
          >
            +
          </button>
        </div>
      </div>
      <div className="terminal-body">{terminalNode}</div>
    </section>
  );
}
