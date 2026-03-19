interface CalendarEventMap {
  [isoDate: string]: string[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Static proof-of-concept events for March 2026.
const MARCH_2026_EVENTS: CalendarEventMap = {
  "2026-03-03": ["Prep call notes"],
  "2026-03-05": ["Partner follow-up"],
  "2026-03-09": ["Discovery call"],
  "2026-03-12": ["Send revised proposal"],
  "2026-03-16": ["Compliance review"],
  "2026-03-19": ["Prospect Q&A"],
  "2026-03-23": ["Negotiation checkpoint"],
  "2026-03-25": ["Partiful Demo call"],
  "2026-03-27": ["Decision deadline"],
  "2026-03-30": ["Close plan sync"],
};

type DayCell = {
  isoDate: string;
  day: number;
};

interface CalendarMarch2026Props {
  highlightPartifulDemoCall?: boolean;
}

function buildMarch2026Cells(): Array<DayCell | null> {
  const daysInMonth = 31;
  const firstWeekdayIndex = 0; // March 1, 2026 is Sunday
  const cells: Array<DayCell | null> = [];

  for (let i = 0; i < firstWeekdayIndex; i += 1) cells.push(null);

  for (let d = 1; d <= daysInMonth; d += 1) {
    const isoDate = `2026-03-${String(d).padStart(2, "0")}`;
    cells.push({ isoDate, day: d });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarMarch2026({
  highlightPartifulDemoCall = false,
}: CalendarMarch2026Props) {
  const cells = buildMarch2026Cells();

  return (
    <section className="calendar-march-2026" aria-label="March 2026 calendar">
      <header className="calendar-header">
        <h3 className="calendar-title">March 2026</h3>
        <p className="calendar-subtitle">Static demo calendar</p>
      </header>

      <div className="calendar-grid" role="table" aria-label="March 2026 dates">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}

        {cells.map((cell, index) => {
          if (!cell)
            return (
              <div
                key={`blank-${index}`}
                className="calendar-cell calendar-cell-blank"
                role="cell"
              />
            );

          const events = MARCH_2026_EVENTS[cell.isoDate] ?? [];
          const isPartifulDemoDate =
            highlightPartifulDemoCall && cell.isoDate === "2026-03-25";
          return (
            <div
              key={cell.isoDate}
              className={`calendar-cell ${
                isPartifulDemoDate ? "calendar-cell-partiful" : ""
              }`}
              role="cell"
            >
              <div className="calendar-day">{cell.day}</div>
              {events.length > 0 ? (
                <ul className="calendar-events">
                  {events.map((event, eventIndex) => (
                    <li key={`${cell.isoDate}-${eventIndex}`} className="calendar-event">
                      {event}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="calendar-no-events">-</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

