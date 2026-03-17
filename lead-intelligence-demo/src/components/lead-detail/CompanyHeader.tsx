import type { BulkProspect } from "../../types/leads";

interface CompanyHeaderProps {
  lead: BulkProspect;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "gray";
  if (score >= 7) return "green";
  if (score >= 4) return "yellow";
  return "red";
}

function urgencyClass(urgency: string | null | undefined): string {
  if (!urgency) return "urgency-future";
  if (urgency === "immediate") return "urgency-immediate";
  if (urgency === "near-term") return "urgency-near";
  return "urgency-future";
}

export function CompanyHeader({ lead }: CompanyHeaderProps) {
  const name = [lead["First Name"], lead["Last Name"]].filter(Boolean).join(" ") || "—";
  const company = lead["Company Name"] ?? "—";
  const email = lead["Email"];
  const website = lead["Website"];
  const companyLi = lead["Company Linkedin Url"];
  const personLi = lead["Person Linkedin Url"];
  const location = [lead["City"], lead["State"], lead["Country"]].filter(Boolean).join(", ") || "—";
  const employees = lead["# Employees"];
  const industry = lead["Industry"] ?? "—";
  const revenue = lead["Annual Revenue"];
  const latestFunding = lead["Latest Funding"];
  const latestAmount = lead["Latest Funding Amount"];
  const lastRaised = lead["Last Raised At"];
  const approach = lead.recommended_contact_approach;

  return (
    <div className="company-header">
      <h2 className="company-name">{company}</h2>
      <div className="company-contact">
        <span className="contact-name">{name}</span>
        {lead["Title"] && <span className="contact-title">{lead["Title"]}</span>}
        {email && (
          <a href={`mailto:${email}`} className="contact-email">
            {email}
          </a>
        )}
        {approach && (
          <span className="contact-approach">Contact approach: {approach}</span>
        )}
      </div>
      <div className="company-links">
        {website && typeof website === "string" && (
          <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer">
            Website
          </a>
        )}
        {companyLi && typeof companyLi === "string" && (
          <a href={companyLi} target="_blank" rel="noopener noreferrer">
            Company LinkedIn
          </a>
        )}
        {personLi && typeof personLi === "string" && (
          <a href={personLi} target="_blank" rel="noopener noreferrer">
            Person LinkedIn
          </a>
        )}
      </div>
      <div className="company-meta">
        <span>Location: {location}</span>
        {employees != null && <span>{employees} employees</span>}
        <span>Industry: {industry}</span>
        {revenue && <span>Revenue: {revenue}</span>}
      </div>
      {(latestFunding || latestAmount || lastRaised) && (
        <div className="company-funding">
          Funding: {[latestFunding, latestAmount, lastRaised].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="company-scores">
        <span className={`score-badge score-${scoreColor(lead.fit_score)}`}>
          Fit {lead.fit_score ?? "—"}/10
        </span>
        <span className={`score-badge score-${scoreColor(lead.timing_score)}`}>
          Timing {lead.timing_score ?? "—"}/10
        </span>
        <span className={`score-badge score-${scoreColor(lead.overall_score)}`}>
          Overall {lead.overall_score ?? "—"}/10
        </span>
        <span className={`urgency-badge ${urgencyClass(lead.urgency_level)}`}>
          {lead.urgency_level ?? "future"}
        </span>
        {lead.icp_company_type && (
          <span className="icp-badge">{lead.icp_company_type}</span>
        )}
      </div>
    </div>
  );
}
