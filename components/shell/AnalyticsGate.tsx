"use client";

/**
 * Loads Vercel Analytics unless the visitor has opted out on the Privacy
 * Settings page. Reading the flag client-side keeps the root layout a static
 * server component; until hydration we assume opted-in (the common case) and
 * re-evaluate on mount and whenever the preference changes.
 */
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { isAnalyticsOptedOut, PRIVACY_CHANGED_EVENT } from "@/lib/privacy";

export function AnalyticsGate() {
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    const sync = () => setOptedOut(isAnalyticsOptedOut());
    sync();
    window.addEventListener("storage", sync); // other tabs
    window.addEventListener(PRIVACY_CHANGED_EVENT, sync); // this tab
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(PRIVACY_CHANGED_EVENT, sync);
    };
  }, []);

  return optedOut ? null : <Analytics />;
}
