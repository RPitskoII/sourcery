interface OutreachAngleProps {
  text: string | null;
}

export function OutreachAngle({ text }: OutreachAngleProps) {
  const str = typeof text === "string" ? text : "";
  if (!str.trim()) return null;
  return (
    <div className="outreach-angle">
      <h3>Outreach angle</h3>
      <div className="outreach-angle-content">{str}</div>
    </div>
  );
}
