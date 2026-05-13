"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { isDesktop } from "@/lib/desktop-bridge";

/**
 * Renders Vercel Web Analytics only when running on the actual website.
 *
 * The same code is loaded inside the Tauri desktop app's webview, where we
 * don't want to ping vercel.com on every navigation — desktop users are
 * specifically choosing the offline-capable native build and shouldn't have
 * their pageviews counted.
 *
 * `isDesktop()` reads `window.__TAURI_INTERNALS__`, which is undefined
 * server-side. To avoid hydration mismatch we wait for the post-mount tick
 * before deciding whether to render Analytics.
 */
export function WebAnalytics() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  if (isDesktop()) return null;
  return <Analytics />;
}
