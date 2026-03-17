import { useState } from "react";

interface GetLeadsModalProps {
  onConfirm: () => Promise<void>;
}

const LEADS_COUNT = 5;
const PRICE_PER_LEAD = 75;
const TOTAL = PRICE_PER_LEAD * LEADS_COUNT;

export function GetLeadsModal({ onConfirm }: GetLeadsModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="get-leads-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="get-leads-modal-title">
      <div className="get-leads-modal">
        <h2 id="get-leads-modal-title" className="get-leads-modal-title">Get leads</h2>
        <label className="get-leads-modal-label">
          Number of leads
          <select className="get-leads-modal-select" aria-label="Number of leads" value={LEADS_COUNT} disabled>
            <option value={5}>5</option>
          </select>
        </label>
        <div className="get-leads-modal-total">
          <span className="get-leads-modal-total-label">Total</span>
          <span className="get-leads-modal-total-amount">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(TOTAL)}
          </span>
        </div>
        <div className="get-leads-modal-actions">
          <button
            type="button"
            className="get-leads-modal-btn"
            onClick={handleClick}
            disabled={loading}
          >
            {loading ? "Loading…" : "Get leads"}
          </button>
        </div>
      </div>
    </div>
  );
}
