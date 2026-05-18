import React, { createContext, useContext, useState, useCallback } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Toast system
// Polite, non-blocking, auto-dismissing notifications.
// Usage: const { toast } = useToast(); toast.success("Done", { msg: "..." });
// Honors aria-live for screen readers; respects reduced-motion via CSS.
// ─────────────────────────────────────────────────────────────────────────────

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 220);
  }, []);

  const push = useCallback((kind, title, opts = {}) => {
    const id = ++_id;
    const item = {
      id,
      kind,
      title,
      msg: opts.msg ?? null,
      ttl: opts.ttl ?? 4500,
      leaving: false,
    };
    setItems((prev) => [...prev, item]);
    if (item.ttl > 0) setTimeout(() => dismiss(id), item.ttl);
    return id;
  }, [dismiss]);

  const value = {
    success: (title, opts) => push("success", title, opts),
    error:   (title, opts) => push("error", title, opts),
    info:    (title, opts) => push("info", title, opts),
    dismiss,
  };

  return (
    <ToastCtx.Provider value={{ toast: value }}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.leaving ? "is-leaving" : ""}`} role={t.kind === "error" ? "alert" : "status"}>
            <span className={`toast-icon ${t.kind === "success" ? "success" : t.kind === "error" ? "danger" : "info"}`}>
              <Icon name={t.kind === "success" ? "check" : t.kind === "error" ? "alert" : "info"} size={20} />
            </span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
};

export default ToastProvider;
