import { useState } from "react";
import type { ScoreBreakdownItem } from "../../types/leads";

/** Normalize breakdown from API: may be array or JSON string (Supabase JSONB). */
function normalizeBreakdown(
  value: unknown
): ScoreBreakdownItem[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface ScoreBreakdownProps {
  fitScore: number | null | undefined;
  timingScore: number | null | undefined;
  fitBreakdown: ScoreBreakdownItem[] | null;
  timingBreakdown: ScoreBreakdownItem[] | null;
}

/** Rubric row: same format as EnrichmentScript.py (icon, +pts, criterion, optional evidence). */
function BreakdownSection({
  title,
  totalLabel,
  items,
  defaultCollapsed = true,
}: {
  title: string;
  totalLabel: string;
  items: ScoreBreakdownItem[] | null;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;
  return (
    <div className="breakdown-section">
      <button
        type="button"
        className="breakdown-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "▼" : "▶"} {title} {totalLabel && <span className="breakdown-total">({totalLabel})</span>}
      </button>
      {open && (
        <ul className="breakdown-list">
          {list.map((item, i) => {
            const pts = typeof item.points === "number" ? item.points : 0;
            const crit = typeof item.criterion === "string" ? item.criterion : "—";
            const passed = pts > 0;
            return (
              <li key={i} className="breakdown-item">
                <span className={passed ? "breakdown-check" : "breakdown-x"}>
                  {passed ? "✓" : "✗"}
                </span>
                <span className="breakdown-points">+{pts}</span>
                <span className="breakdown-criterion">{crit}</span>
                {item.evidence && (
                  <span className="breakdown-evidence">{item.evidence}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ScoreBreakdown({
  fitScore,
  timingScore,
  fitBreakdown,
  timingBreakdown,
}: ScoreBreakdownProps) {
  const fitList = normalizeBreakdown(fitBreakdown);
  const timingList = normalizeBreakdown(timingBreakdown);
  const hasAny = fitList.length > 0 || timingList.length > 0;
  const fitTotal = fitScore != null ? `total: ${fitScore}` : "";
  const timingTotal = timingScore != null ? `total: ${timingScore}` : "";

  return (
    <div className="score-breakdown">
      <h3>Rubric score breakdowns</h3>
      <p className="score-breakdown-intro">
        Same rubric points as in the enrichment script: each row is a criterion and the points it contributed.
      </p>
      {hasAny ? (
        <>
          <BreakdownSection
            title="Fit breakdown"
            totalLabel={fitTotal}
            items={fitList}
          />
          <BreakdownSection
            title="Timing breakdown"
            totalLabel={timingTotal}
            items={timingList}
          />
        </>
      ) : (
        <p className="score-breakdown-empty">
          No rubric breakdown data for this lead. Fit and timing breakdowns are populated by the enrichment pipeline when a prospect is scored.
        </p>
      )}
    </div>
  );
}
