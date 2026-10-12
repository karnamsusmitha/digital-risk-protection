import React from "react";
import { CheckCircleIcon, AlertOctagonIcon, InfoIcon } from "./Icons";

export function ToastContainer({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" id="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type || "info"}`}
          onClick={() => onDismiss && onDismiss(t.id)}
          style={{ cursor: "pointer" }}
        >
          {t.type === "success" && <CheckCircleIcon size={18} style={{ color: "var(--sev-low)" }} />}
          {t.type === "error" && <AlertOctagonIcon size={18} style={{ color: "var(--sev-critical)" }} />}
          {t.type === "info" && <InfoIcon size={18} style={{ color: "var(--primary-cyan)" }} />}
          <div style={{ flex: 1, fontSize: "0.84rem", color: "var(--text-primary)" }}>
            {t.message}
          </div>
        </div>
      ))}
    </div>
  );
}
