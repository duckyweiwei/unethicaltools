"use client";

import { useEffect } from "react";
import { isDesktop } from "@/lib/desktop-bridge";

/**
 * Adds `body.desktop` when running inside the Tauri webview. CSS in
 * globals.css uses this class to drop expensive effects (backdrop-filter,
 * animated gradient orbs) that hammer WKWebView/WebView2 performance.
 *
 * Mounted in app/layout.tsx so it applies on every page.
 */
export function DesktopBodyClass() {
  useEffect(() => {
    if (isDesktop()) document.body.classList.add("desktop");
    return () => {
      document.body.classList.remove("desktop");
    };
  }, []);
  return null;
}
