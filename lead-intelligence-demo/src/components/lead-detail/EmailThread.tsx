import type { BulkProspect } from "../../types/leads";

interface EmailThreadProps {
  lead: BulkProspect;
}

type ThreadMessage = {
  id: string;
  from: "You" | "Prospect";
  body: string;
};

/**
 * Email thread mapping (demo-only):
 * - email_draft_body: first email from user (You)
 * - email2: prospect response
 * - email3: next user response
 * - email4: latest prospect response
 *
 * UI order: latest email at the top.
 */
function buildThread(lead: BulkProspect): ThreadMessage[] {
  const messages: Array<ThreadMessage | null> = [
    // Latest at the top
    lead.email4 != null
      ? { id: "email4", from: "Prospect", body: String(lead.email4) }
      : null,
    lead.email3 != null
      ? { id: "email3", from: "You", body: String(lead.email3) }
      : null,
    lead.email2 != null
      ? { id: "email2", from: "Prospect", body: String(lead.email2) }
      : null,
    // First email from the user
    lead.email_draft_body != null
      ? {
          id: "email_draft_body",
          from: "You",
          body: String(lead.email_draft_body),
        }
      : null,
  ];

  return messages.filter((m): m is ThreadMessage => m != null);
}

export function EmailThread({ lead }: EmailThreadProps) {
  const thread = buildThread(lead);
  if (thread.length === 0) return null;

  // Debug: confirm which email fields are arriving from Supabase.
  console.debug("[EmailThread] email fields present:", {
    email_draft_body: lead.email_draft_body != null,
    email2: lead.email2 != null,
    email3: lead.email3 != null,
    email4: lead.email4 != null,
    primary: lead.Primary,
  });

  return (
    <div className="email-thread" aria-label="Email thread">
      <h3 className="email-thread-title">Email thread</h3>
      <div className="email-thread-list">
        {thread.map((m) => (
          <div
            key={m.id}
            className={`email-thread-msg ${
              m.from === "You" ? "email-thread-msg-you" : "email-thread-msg-prospect"
            }`}
          >
            <div className="email-thread-from">{m.from}</div>
            <div className="email-thread-body">{m.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

