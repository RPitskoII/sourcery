import type { BulkProspect } from "../../types/leads";

interface CompanyHeaderProps {
  lead: BulkProspect;
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
      </div>
    </div>
  );
}
