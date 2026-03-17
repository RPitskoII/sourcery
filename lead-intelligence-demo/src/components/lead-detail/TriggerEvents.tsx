import type { TriggerEvent } from "../../types/leads";

interface TriggerEventsProps {
  events: TriggerEvent[] | null;
}

export function TriggerEvents({ events }: TriggerEventsProps) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return null;
  return (
    <div className="trigger-events">
      <h3>Trigger events</h3>
      <div className="signal-cards">
        {list.map((e, i) => (
          <div key={i} className="signal-card">
            {e.type && <span className="signal-type">{e.type}</span>}
            {e.date && <span className="signal-date">{e.date}</span>}
            {e.description && <p className="signal-evidence">{e.description}</p>}
            {e.source && (
              <a href={e.source} target="_blank" rel="noopener noreferrer" className="signal-link">
                Source
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
