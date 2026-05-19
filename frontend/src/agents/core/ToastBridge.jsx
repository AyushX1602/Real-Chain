// ─────────────────────────────────────────────────────────────────────────────
// ToastBridge — listens for TOAST envelopes on the agent bus and forwards
// them to the existing <ToastProvider>.
//
// This isolates the React UI library from the agent layer: agents only know
// how to dispatch a TOAST envelope; this component knows how to render one.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useOrchestrator } from "./AgentProvider";
import { useToast } from "../../components/Toast";
import { MSG } from "./messageTypes";

export default function ToastBridge() {
  const orch = useOrchestrator();
  const { toast } = useToast();

  useEffect(() => {
    if (!orch) return undefined;
    return orch.bus.on(MSG.TOAST, (env) => {
      const { kind = "info", title, message } = env.payload || {};
      const t = title || message || "Notice";
      const opts = title && message ? { msg: message } : undefined;
      if (kind === "error") toast.error(t, opts);
      else if (kind === "success") toast.success(t, opts);
      else toast.info(t, opts);
    });
  }, [orch, toast]);

  return null;
}
