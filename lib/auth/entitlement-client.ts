"use client";

/**
 * Client view of "am I Pro?". Asks the server (which is the only thing that
 * actually knows) via /api/entitlement and exposes a `refresh()` so the UI can
 * re-check right after returning from Stripe checkout. This is for *display*
 * only — real gating is enforced server-side; the client can't grant itself Pro
 * by lying to this hook.
 */
import { useCallback, useEffect, useState } from "react";

export interface ViewerEntitlement {
  signedIn: boolean;
  pro: boolean;
  loading: boolean;
}

export function useEntitlement(): ViewerEntitlement & { refresh: () => void } {
  const [state, setState] = useState<ViewerEntitlement>({
    signedIn: false,
    pro: false,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    fetch("/api/entitlement", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signedIn: false, pro: false }))
      .then((d: { signedIn?: boolean; pro?: boolean }) => {
        if (active) {
          setState({ signedIn: Boolean(d.signedIn), pro: Boolean(d.pro), loading: false });
        }
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  return { ...state, refresh };
}
