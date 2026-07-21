"use client";

import { memo, useMemo, useState } from "react";
import type { SimulationPolicy } from "@/lib/domain/commands";
import type { AuthorityEvent, AuthorityEventType } from "@/lib/domain/events";

const rowTones: Partial<Record<AuthorityEventType, string>> = {
  STOP_INJECTED: "stop",
  EFFECT_COMMITTED: "breach",
  STALE_AUTHORITY_REJECTED: "safe",
  EFFECT_REJECTED: "safe",
  QUIESCENCE_REACHED: "quiescence",
};

export const EvidenceLedger = memo(function EvidenceLedger({
  events,
  started,
  citedIds,
  runId,
  policy,
  focusedEventId = null,
}: {
  events: readonly AuthorityEvent[];
  started: boolean;
  citedIds: ReadonlySet<string>;
  runId: string | null;
  policy: SimulationPolicy;
  focusedEventId?: string | null;
}) {
  const [view, setView] = useState<"table" | "jsonl">("table");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [lastFocusedEventId, setLastFocusedEventId] = useState(focusedEventId);
  const jsonlLines = useMemo(
    () => events.map((event) => JSON.stringify(event)),
    [events],
  );

  if (focusedEventId !== lastFocusedEventId) {
    setLastFocusedEventId(focusedEventId);
    if (focusedEventId) setView("table");
  }

  function downloadJsonl() {
    const blob = new Blob([jsonlLines.join("\n") + "\n"], {
      type: "application/x-ndjson",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${runId ?? "quiesce"}-${policy}-events.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyJsonl() {
    try {
      await navigator.clipboard.writeText(jsonlLines.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <section className="evidence-region" aria-labelledby="evidence-title">
      <div className="evidence-region__bar">
        <div className="region-heading">
          <span className="region-index">05</span>
          <h3 id="evidence-title">Evidence ledger</h3>
        </div>
        {started ? (
          <div className="evidence-toolbar">
            <span className="evidence-count">
              {events.length} events · append-only
            </span>
            <div
              className="view-toggle"
              role="group"
              aria-label="Evidence view"
            >
              <button
                type="button"
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
              >
                Table
              </button>
              <button
                type="button"
                aria-pressed={view === "jsonl"}
                onClick={() => setView("jsonl")}
              >
                Raw JSONL
              </button>
            </div>
            <button
              className="evidence-action"
              type="button"
              onClick={copyJsonl}
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy JSONL"}
            </button>
            <button
              className="evidence-action"
              type="button"
              onClick={downloadJsonl}
            >
              Download .jsonl
            </button>
          </div>
        ) : null}
      </div>
      {!started ? (
        <p>
          No events recorded. Start a shutdown test to create an append-only
          evidence trail.
        </p>
      ) : view === "jsonl" ? (
        <pre
          className="jsonl"
          tabIndex={0}
          aria-label="Raw JSONL event evidence"
        >
          {jsonlLines.map((line, index) => (
            <code key={events[index].eventId}>{line}</code>
          ))}
        </pre>
      ) : (
        <div className="ledger-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Event</th>
                <th>Time</th>
                <th>Type</th>
                <th>Actor</th>
                <th>Subject</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const tone = rowTones[event.type];
                const focused = event.eventId === focusedEventId;
                const classNames = [
                  citedIds.has(event.eventId) ? "is-cited" : "",
                  tone ? `ledger-row--${tone}` : "",
                  focused ? "is-focused" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    className={classNames}
                    ref={
                      focused
                        ? (node) =>
                            node?.scrollIntoView({
                              block: "nearest",
                              behavior: "auto",
                            })
                        : undefined
                    }
                    key={event.eventId}
                  >
                    <td>{event.eventId}</td>
                    <td>{event.logicalTimeMs} ms</td>
                    <td>{event.type}</td>
                    <td>{event.actorId}</td>
                    <td>{event.subjectId ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
});
