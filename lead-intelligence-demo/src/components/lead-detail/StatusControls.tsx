import { useState, useEffect } from "react";
import type { LeadActivity, LeadStatus } from "../../types/leads";
import { LEAD_STATUSES } from "../../types/leads";

interface StatusControlsProps {
  activity: LeadActivity | null;
  onSave: (payload: Partial<LeadActivity>) => Promise<void>;
}

export function StatusControls({ activity, onSave }: StatusControlsProps) {
  const [status, setStatus] = useState<string>(activity?.status ?? "new");
  const [nextAction, setNextAction] = useState(activity?.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    activity?.next_action_date?.slice(0, 16) ?? ""
  );
  const [meetingDate, setMeetingDate] = useState(
    activity?.meeting_date?.slice(0, 16) ?? ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(activity?.status ?? "new");
    setNextAction(activity?.next_action ?? "");
    setNextActionDate(activity?.next_action_date?.slice(0, 16) ?? "");
    setMeetingDate(activity?.meeting_date?.slice(0, 16) ?? "");
  }, [activity]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        status: status as LeadStatus,
        next_action: nextAction || null,
        next_action_date: nextActionDate ? new Date(nextActionDate).toISOString() : null,
        meeting_date: meetingDate ? new Date(meetingDate).toISOString() : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="status-controls">
      <h3>Status</h3>
      <div className="status-controls-row">
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Lead status"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Next action
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="e.g. Follow up on email"
            aria-label="Next action"
          />
        </label>
        <label>
          Next action date
          <input
            type="datetime-local"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
            aria-label="Next action date"
          />
        </label>
        {status === "meeting_scheduled" && (
          <label>
            Meeting date
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              aria-label="Meeting date"
            />
          </label>
        )}
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
