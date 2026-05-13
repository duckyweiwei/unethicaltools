"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top nav. Logo on the left, primary tabs in the middle, Desktop-app CTA on
 * the right. Active tab is computed from `usePathname()` so it works on
 * every route without each page passing a `current` prop.
 *
 * Tabs:
 *   Home          → /     (active on / and every /<converter-slug> route,
 *                          since converter pages are the "Home → pick a format"
 *                          flow continuation)
 *   FAQ           → /faq
 *   Suggestions   → /suggestions
 *
 * Logo behavior:
 *   - Desktop (sm+): wordmark image at public/brand/wordmark.png
 *   - Mobile:        compact icon at public/brand/icon.png
 *   Rendered as-is — no CSS filters. Source PNGs should ship with the colors
 *   the brand actually wants on dark. (If a future variant needs the dark
 *   source flipped, do it in image editing software, not via filter.)
 */
const TABS: Array<{
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}> = [
  {
    href: "/",
    label: "Home",
    // Active on / and on per-format routes — Home covers the "browse +
    // pick a converter" path. Only /faq, /suggestions, /download have
    // their own tabs / CTA, so anything else is "home territory".
    isActive: (p) =>
      p === "/" ||
      (p !== "/faq" && p !== "/suggestions" && p !== "/download"),
  },
  {
    href: "/faq",
    label: "FAQ",
    isActive: (p) => p === "/faq",
  },
  {
    href: "/suggestions",
    label: "Suggestions",
    isActive: (p) => p === "/suggestions",
  },
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="relative z-10">
      {/*
       * Two-row layout on mobile to avoid cramping the brand + tabs + CTA
       * into <375px. On sm+ everything fits on one line.
       *   Row 1 (mobile): logo + name (left), Desktop CTA (right)
       *   Row 2 (mobile): full-width tab pill, centered
       *   On sm+ both rows reflow into a single row.
       */}
      <nav
        className="mx-auto max-w-5xl px-4 sm:px-6 pt-4 sm:pt-5 pb-2 flex flex-wrap items-center justify-between gap-y-2 gap-x-3"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="group inline-flex items-center gap-2 sm:gap-2.5 shrink-0"
          aria-label="unethical tools — home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/icon.png"
            alt=""
            aria-hidden
            className="h-7 w-7 sm:h-9 sm:w-9"
          />
          <span className="text-sm sm:text-base font-medium tracking-tight text-white whitespace-nowrap">
            unethical tools
          </span>
        </Link>

        {/*
         * DOM order is Logo → Tabs → CTA so desktop reads naturally with
         * justify-between (logo left, tabs center, CTA right). On mobile
         * `order-last` + `w-full` pushes the tab pill onto its own second
         * row below the logo + CTA.
         */}
        <ul
          className="order-last sm:order-none w-full sm:w-auto flex items-center justify-center gap-0.5 sm:gap-1 rounded-full glass p-1 overflow-x-auto scrollbar-thin"
        >
          {TABS.map((tab) => {
            const active = tab.isActive(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap",
                    active
                      ? "bg-white/[0.08] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/download"
          className="text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <DesktopIcon />
          <span className="hidden sm:inline">Desktop app</span>
        </Link>
      </nav>
    </header>
  );
}

function DesktopIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
