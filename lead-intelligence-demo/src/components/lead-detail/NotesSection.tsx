import { useState, useEffect } from "react";

interface NotesSectionProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
}

export function NotesSection({ notes, onSave }: NotesSectionProps) {
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(notes ?? "");
  }, [notes]);

  async function handleBlur() {
    const trimmed = value.trim();
    if (trimmed === (notes ?? "").trim()) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveClick() {
    setSaving(true);
    try {
      await onSave(value.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notes-section">
      <h3>Notes</h3>
      <textarea
        className="notes-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Jot notes after a call or meeting..."
        rows={4}
        aria-label="Lead notes"
      />
      <button
        type="button"
        className="btn-save"
        onClick={handleSaveClick}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
    </div>
  );
}
