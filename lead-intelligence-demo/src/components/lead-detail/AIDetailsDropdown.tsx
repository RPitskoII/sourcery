import { useState } from "react";
import type { ReactNode } from "react";

interface AIDetailsDropdownProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function AIDetailsDropdown({
  title,
  children,
  defaultOpen = false,
}: AIDetailsDropdownProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="ai-details-dropdown">
      <button
        type="button"
        className="ai-details-dropdown-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "▼" : "▶"} {title}
      </button>
      {open && <div className="ai-details-dropdown-content">{children}</div>}
    </div>
  );
}

