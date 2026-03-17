interface FooterProps {
  leadCount: number;
  lastEnrichedAt: string | null;
}

export function Footer({ leadCount, lastEnrichedAt }: FooterProps) {
  const enrichedLabel = lastEnrichedAt
    ? new Date(lastEnrichedAt).toLocaleString()
    : "—";
  return (
    <footer className="app-footer">
      <span>{leadCount} leads shown</span>
      <span>Last enriched: {enrichedLabel}</span>
    </footer>
  );
}
