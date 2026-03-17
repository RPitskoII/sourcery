interface ResearchSummaryProps {
  text: string | null;
}

export function ResearchSummary({ text }: ResearchSummaryProps) {
  const str = typeof text === "string" ? text : "";
  if (!str.trim()) return null;
  const paragraphs = str.split(/\n\n+/).filter(Boolean);
  return (
    <div className="research-summary">
      <h3>Research summary</h3>
      <div className="research-summary-content">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
