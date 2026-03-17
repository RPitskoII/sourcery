import type { BulkProspect } from "../../types/leads";

interface ComplianceDetailsProps {
  lead: BulkProspect;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function ComplianceDetails({ lead }: ComplianceDetailsProps) {
  const compliance = asStringArray(lead.compliance_needs);
  const sensitive = asStringArray(lead.sensitive_data_categories);
  const gaps = asStringArray(lead.privacy_gaps);
  const posture = typeof lead.current_privacy_posture === "string" ? lead.current_privacy_posture : "";
  const breach = lead.breach_flag && lead.breach_details && typeof lead.breach_details === "object";
  const competitors = Array.isArray(lead.competitor_signals) ? lead.competitor_signals : [];
  const risks = asStringArray(lead.risk_factors);

  const hasAny =
    compliance.length > 0 ||
    sensitive.length > 0 ||
    gaps.length > 0 ||
    posture ||
    breach ||
    competitors.length > 0 ||
    risks.length > 0;

  if (!hasAny) return null;

  return (
    <div className="compliance-details">
      <h3>Compliance & privacy</h3>
      {compliance.length > 0 && (
        <div className="compliance-badges">
          <span className="label">Compliance needs:</span>
          {compliance.map((c, i) => (
            <span key={i} className="badge">{c}</span>
          ))}
        </div>
      )}
      {sensitive.length > 0 && (
        <div className="compliance-badges">
          <span className="label">Sensitive data:</span>
          {sensitive.map((s, i) => (
            <span key={i} className="badge">{s}</span>
          ))}
        </div>
      )}
      {posture && (
        <p className="privacy-posture">
          <strong>Current privacy posture:</strong> {posture}
        </p>
      )}
      {gaps.length > 0 && (
        <div>
          <strong>Privacy gaps:</strong>
          <ul>
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {breach && lead.breach_details && typeof lead.breach_details === "object" && (
        <div className="breach-alert">
          <strong>Breach alert</strong>
          <ul>
            {lead.breach_details.date && <li>Date: {String(lead.breach_details.date)}</li>}
            {lead.breach_details.scope && <li>Scope: {String(lead.breach_details.scope)}</li>}
            {lead.breach_details.data_types && (
              <li>Data types: {String(lead.breach_details.data_types)}</li>
            )}
            {lead.breach_details.source && <li>Source: {String(lead.breach_details.source)}</li>}
            {lead.breach_details.regulatory_status && (
              <li>Regulatory: {String(lead.breach_details.regulatory_status)}</li>
            )}
          </ul>
        </div>
      )}
      {competitors.length > 0 && (
        <div>
          <strong>Competitor signals:</strong>
          <pre className="competitor-json">{JSON.stringify(competitors, null, 2)}</pre>
        </div>
      )}
      {risks.length > 0 && (
        <div>
          <strong>Risk factors:</strong>
          <ul>
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
