"use client";

import { usePathname } from "next/navigation";
import { getConverter } from "@/lib/converters";
import { DesktopHub } from "./DesktopHub";
import { DesktopConverter } from "./DesktopConverter";

/**
 * Routes the desktop UI based on the current pathname:
 *   /              → DesktopHub (grid of converter cards)
 *   /<slug>        → DesktopConverter for that format
 *   anything else  → fall back to DesktopHub (e.g. /download has no
 *                    meaning inside the native app itself)
 */
export function DesktopShell() {
  const pathname = usePathname();
  const slug = (pathname ?? "/").replace(/^\//, "").replace(/\/$/, "");
  if (!slug) return <DesktopHub />;
  const config = getConverter(slug);
  if (config) return <DesktopConverter config={config} />;
  return <DesktopHub />;
}
