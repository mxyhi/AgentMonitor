import { useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAppLocale } from "@/i18n/I18nProvider";
import * as m from "@/i18n/messages";
import type { DebugEntry } from "../../../types";

type DebugPanelProps = {
  entries: DebugEntry[];
  isOpen: boolean;
  onClear: () => void;
  onCopy: () => void;
  onResizeStart?: (event: ReactMouseEvent) => void;
  variant?: "dock" | "full";
};

function formatPayload(payload: unknown) {
  if (payload === undefined) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function DebugPanel({
  entries,
  isOpen,
  onClear,
  onCopy,
  onResizeStart,
  variant = "dock",
}: DebugPanelProps) {
  const locale = useAppLocale();
  const isVisible = variant === "full" || isOpen;

  type FormattedDebugEntry = DebugEntry & {
    timeLabel: string;
    payloadText?: string;
  };

  const previousEntriesRef = useRef<DebugEntry[] | null>(null);
  const previousFormattedRef = useRef<FormattedDebugEntry[] | null>(null);

  const formattedEntries = useMemo(() => {
    if (!isVisible) {
      return previousFormattedRef.current ?? [];
    }
    const previousEntries = previousEntriesRef.current;
    const previousFormatted = previousFormattedRef.current;

    const canReusePrevious =
      previousEntries !== null &&
      previousFormatted !== null &&
      previousEntries.length === entries.length &&
      entries.every((entry, index) => {
        const previous = previousEntries[index];
        return (
          previous !== undefined &&
          previous.id === entry.id &&
          previous.timestamp === entry.timestamp &&
          previous.source === entry.source &&
          previous.label === entry.label &&
          previous.payload === entry.payload
        );
      });

    if (canReusePrevious) {
      return previousFormatted;
    }

    const nextFormatted = entries.map((entry) => ({
      ...entry,
      timeLabel: new Date(entry.timestamp).toLocaleTimeString(),
      payloadText:
        entry.payload !== undefined ? formatPayload(entry.payload) : undefined,
    }));

    previousEntriesRef.current = entries;
    previousFormattedRef.current = nextFormatted;

    return nextFormatted;
  }, [entries, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <section
      className={`debug-panel ${variant === "full" ? "full" : isOpen ? "open" : ""}`}
    >
      {variant !== "full" && isOpen && onResizeStart ? (
        <div
          className="debug-panel-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label={m.debug_resize({}, { locale })}
          onMouseDown={onResizeStart}
        />
      ) : null}
      <div className="debug-header">
        <div className="debug-title">{m.debug_title({}, { locale })}</div>
        <div className="debug-actions">
          <button className="ghost" onClick={onCopy}>
            {m.debug_copy({}, { locale })}
          </button>
          <button className="ghost" onClick={onClear}>
            {m.debug_clear({}, { locale })}
          </button>
        </div>
      </div>
      {isOpen ? (
        <div className="debug-list">
          {formattedEntries.length === 0 ? (
            <div className="debug-empty">{m.debug_empty({}, { locale })}</div>
          ) : null}
          {formattedEntries.map((entry) => (
            <div key={entry.id} className="debug-row">
              <div className="debug-meta">
                <span className={`debug-source ${entry.source}`}>
                  {entry.source}
                </span>
                <span className="debug-time">{entry.timeLabel}</span>
                <span className="debug-label">{entry.label}</span>
              </div>
              {entry.payloadText !== undefined ? (
                <pre className="debug-payload">{entry.payloadText}</pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
