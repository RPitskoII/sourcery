import { useState } from "react";

interface EmailDraftProps {
  subject: string | null;
  body: string | null;
  serviceLine: string | null;
  hasDraft: boolean;
}

export function EmailDraft({ subject, body, serviceLine, hasDraft }: EmailDraftProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const s = subject != null ? String(subject) : "";
    const b = body != null ? String(body) : "";
    if (!s && !b) return;
    const text = `Subject: ${s}\n\n${b}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!hasDraft) {
    return (
      <div className="email-draft">
        <h3>Email draft</h3>
        <p className="email-draft-empty">No email drafted — overall score below threshold.</p>
      </div>
    );
  }

  const subjectStr = subject != null ? String(subject) : "";
  const bodyStr = body != null ? String(body) : "";
  const serviceStr = serviceLine != null ? String(serviceLine) : "";
  return (
    <div className="email-draft">
      <h3>Email draft</h3>
      {serviceStr && (
        <div className="email-draft-service-line">{serviceStr}</div>
      )}
      {subjectStr && (
        <div className="email-draft-subject">
          <strong>Subject:</strong> {subjectStr}
        </div>
      )}
      {bodyStr && (
        <div className="email-draft-body">{bodyStr}</div>
      )}
      <button
        type="button"
        className="btn-copy"
        onClick={handleCopy}
        aria-label="Copy email to clipboard"
      >
        {copied ? "Copied" : "Copy email"}
      </button>
    </div>
  );
}
