import { useState } from "react";
import {
  getStoredOwnerSecret,
  setStoredOwnerSecret,
  clearStoredOwnerSecret,
  updateEstimateStatus,
  type EstimateVersionRow,
} from "@/lib/supabase-client";
import type { DocumentType } from "@/lib/invoice-document";

// Mirrors the estimate_versions_status_check CHECK constraint — the only
// values the DB will actually accept per document_type.
const VALID_STATUSES: Record<DocumentType, string[]> = {
  quote: ["draft", "sent", "accepted", "final", "archived"],
  invoice: ["draft", "issued", "paid", "archived"],
};

export function getOrPromptOwnerSecret(promptMessage: string): string | null {
  let secret = getStoredOwnerSecret();
  if (!secret) {
    secret = window.prompt(promptMessage);
    if (!secret) return null;
    setStoredOwnerSecret(secret);
  }
  return secret;
}

type StatusPatch = Pick<EstimateVersionRow, "status" | "invoice_meta" | "updated_at">;

export function StatusToggle({
  documentType,
  id,
  status,
  onChanged,
  style,
}: {
  documentType: DocumentType;
  id: string;
  status: string;
  onChanged: (patch: StatusPatch) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = VALID_STATUSES[documentType];

  const choose = async (next: string) => {
    if (next === status) {
      setOpen(false);
      return;
    }
    const ownerSecret = getOrPromptOwnerSecret("Enter the owner passphrase to change status:");
    if (!ownerSecret) return;

    setSaving(true);
    setError(null);
    const result = await updateEstimateStatus(id, next, undefined, ownerSecret);
    setSaving(false);

    if (!result.success || !result.estimate) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setError("Incorrect owner passphrase.");
      } else {
        setError(result.error ?? "Failed to update status.");
      }
      return;
    }
    onChanged(result.estimate);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          display: "inline-block",
          background: "#F5A62326",
          color: "#0D1B2A",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          textTransform: "capitalize",
          whiteSpace: "nowrap",
          border: "none",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        {status} ▾
      </button>
      {open && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            zIndex: 20,
            background: "#fff",
            border: "1px solid #DDE3EA",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 130,
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={saving}
              onClick={() => choose(opt)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                background: opt === status ? "#F1F4F8" : "#fff",
                border: "none",
                fontSize: 12,
                textTransform: "capitalize",
                cursor: saving ? "default" : "pointer",
                color: "#0D1B2A",
                fontWeight: opt === status ? 700 : 500,
              }}
            >
              {opt}
            </button>
          ))}
          {error && (
            <div style={{ padding: "6px 12px", fontSize: 10, color: "#C0392B", borderTop: "1px solid #EEF0F5", maxWidth: 200 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
