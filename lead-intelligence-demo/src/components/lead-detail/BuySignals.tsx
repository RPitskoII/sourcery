import type { BuySignal } from "../../types/leads";

interface BuySignalsProps {
  signals: BuySignal[] | null;
}

export function BuySignals({ signals }: BuySignalsProps) {
  const list = Array.isArray(signals) ? signals : [];
  if (list.length === 0) return null;
  return (
    <div className="buy-signals">
      <h3>Buy signals</h3>
      <div className="signal-cards">
        {list.map((s, i) => (
          <div key={i} className="signal-card">
            {s.type && <span className="signal-type">{s.type}</span>}
            {s.evidence && <p className="signal-evidence">{s.evidence}</p>}
            {s.source_url && (
              <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="signal-link">
                Source
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
