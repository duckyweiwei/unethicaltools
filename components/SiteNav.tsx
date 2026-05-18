"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Top nav. Logo on the left, primary tabs in the middle, Desktop-app CTA on
 * the right. Active tab is computed from `usePathname()` so it works on
 * every route without each page passing a `current` prop.
 *
 * Tabs:
 *   Home              → /
 *   Profanity Censor  → /bleep
 *   Video to Text     → /transcribe
 *   Converters        ▼  (dropdown — see below)
 *   FAQ               → /faq
 *   Suggestions       → /suggestions
 *
 * Converters dropdown: click the pill → opens a small menu with 3 direct
 * shortcuts (Video / Audio / Image). The /converters chooser page still
 * exists at its URL and remains the breadcrumb anchor; this dropdown is
 * a power-user shortcut for people who already know which type they want.
 * The pill highlights as active across the chooser, all three category
 * hubs, and every per-format slug (`*-to-mp4` / `*-to-mp3` / `*-to-jpg`
 * etc.) — same matching logic as before the dropdown.
 *
 * Logo behavior:
 *   - Desktop (sm+): wordmark image at public/brand/wordmark.png
 *   - Mobile:        compact icon at public/brand/icon.png
 *   Rendered as-is — no CSS filters. Source PNGs should ship with the colors
 *   the brand actually wants on dark.
 */
const CONVERTER_HUB_PATHS = new Set([
  "/converters",
  "/video-converter",
  "/audio-converter",
  "/image-converter",
]);
const CONVERTER_SLUG_PATH = /^\/[a-z0-9]+-to-(?:mp4|mp3|jpg|png|webp)$/;

function isAnyConverterRoute(p: string): boolean {
  return CONVERTER_HUB_PATHS.has(p) || CONVERTER_SLUG_PATH.test(p);
}

interface DropdownItem {
  href: string;
  label: string;
  /** Optional second-line hint shown smaller below the label. */
  hint?: string;
}

type TabConfig =
  | {
      kind: "link";
      href: string;
      label: string;
      isActive: (pathname: string) => boolean;
    }
  | {
      kind: "dropdown";
      label: string;
      isActive: (pathname: string) => boolean;
      items: DropdownItem[];
    };

const TABS: TabConfig[] = [
  {
    kind: "link",
    href: "/",
    label: "Home",
    // Each tool has its own tab now, so Home only highlights on /. Other
    // misc routes (e.g. /about, /download) deliberately leave no tab
    // highlighted — they're outside the tools axis.
    isActive: (p) => p === "/",
  },
  {
    kind: "link",
    href: "/bleep",
    label: "Profanity Censor",
    isActive: (p) => p === "/bleep",
  },
  {
    kind: "link",
    href: "/transcribe",
    label: "Video to Text",
    isActive: (p) => p === "/transcribe",
  },
  {
    kind: "dropdown",
    label: "Converters",
    isActive: isAnyConverterRoute,
    items: [
      { href: "/video-converter", label: "Video Converter", hint: "TS, MOV, MKV → MP4" },
      { href: "/audio-converter", label: "Audio Converter", hint: "WAV, FLAC, M4A → MP3" },
      { href: "/image-converter", label: "Image Converter", hint: "HEIC, AVIF, WEBP → JPG" },
    ],
  },
  {
    kind: "link",
    href: "/faq",
    label: "FAQ",
    isActive: (p) => p === "/faq",
  },
  {
    kind: "link",
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
        // Wider container + smaller left padding pushes the brand wordmark
        // closer to the viewport edge on desktop (the rest of the site
        // content keeps its narrower max-w-5xl, so this affects nav only).
        className="mx-auto max-w-7xl pl-2 sm:pl-3 pr-4 sm:pr-6 pt-4 sm:pt-5 pb-2 flex flex-wrap items-center justify-between gap-y-2 gap-x-3"
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
         *
         * `overflow-visible` on the tab pill (instead of overflow-x-auto)
         * lets the dropdown menu escape the pill bounds — important for
         * the Converters dropdown to render below the row. Mobile keeps
         * its scroll behavior via the inner ul-wrapper class change.
         */}
        <ul className="order-last sm:order-none w-full sm:w-auto flex items-center justify-center gap-0.5 sm:gap-1 rounded-full glass p-1">
          {TABS.map((tab) => {
            const active = tab.isActive(pathname);
            if (tab.kind === "link") {
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
            }
            return (
              <DropdownPill
                key={tab.label}
                label={tab.label}
                items={tab.items}
                active={active}
                currentPath={pathname}
              />
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

/**
 * One nav slot rendered as a button-toggled dropdown rather than a link.
 * Click toggles open; click outside / Esc / link-click closes. The button
 * itself never navigates — users pick a destination from the menu.
 */
function DropdownPill({
  label,
  items,
  active,
  currentPath,
}: {
  label: string;
  items: DropdownItem[];
  active: boolean;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);

  // Close on outside pointer / Esc. Listeners installed only while open
  // so we don't pay event-handler cost on every nav click site-wide.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen((o) => !o)}
        className={[
          "inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap cursor-pointer",
          active
            ? "bg-white/[0.08] text-[var(--color-text)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        ].join(" ")}
      >
        {label}
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={label}
          // Solid background (var(--color-bg-elev) = #0d0d14) — `glass`
          // looked translucent over busy hero content; user wanted opaque.
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 min-w-[220px] rounded-2xl bg-[var(--color-bg-elev)] border border-[var(--color-border-strong)] p-1.5 shadow-2xl z-30 fade-in"
        >
          {items.map((item) => {
            const itemActive = item.href === currentPath;
            return (
              <li key={item.href} role="none">
                <Link
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={[
                    "block px-3 py-2 rounded-xl transition-colors whitespace-nowrap",
                    itemActive
                      ? "bg-white/[0.08] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="text-xs font-medium">{item.label}</div>
                  {item.hint && (
                    <div className="text-[10px] font-mono text-[var(--color-text-dim)] mt-0.5">
                      {item.hint}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
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
