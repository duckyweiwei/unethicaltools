"use client";

/**
 * Interactive privacy controls. Two real, user-initiated actions:
 *   1. Analytics opt-out — a flag in localStorage that AnalyticsGate honours, so
 *      toggling it off stops Vercel Analytics from loading on the next render.
 *   2. Clear local data — wipes every `pdfquiz:` key from local/session storage
 *      and deletes the image database, after an explicit confirm. The analytics
 *      preference is deliberately preserved (a privacy choice shouldn't reset
 *      itself when you clear data).
 */
import { useEffect, useState } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptedOut, ANALYTICS_OPT_OUT_KEY } from "@/lib/privacy";

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function clearLocalData() {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k && k.startsWith("pdfquiz:") && k !== ANALYTICS_OPT_OUT_KEY) ls.removeItem(k);
    }
    const ss = window.sessionStorage;
    for (let i = ss.length - 1; i >= 0; i--) {
      const k = ss.key(i);
      if (k && k.startsWith("pdfquiz:")) ss.removeItem(k);
    }
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("pdfquiz");
  } catch {
    /* storage disabled — nothing to clear */
  }
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
        on ? "bg-neutral-900" : "bg-neutral-200",
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function PrivacySettingsClient() {
  // null until hydrated, so SSR and first client render agree (no mismatch).
  const [optedOut, setOptedOut] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => setOptedOut(isAnalyticsOptedOut()), []);

  function toggleAnalytics() {
    const next = !(optedOut ?? false);
    setOptedOut(next);
    setAnalyticsOptedOut(next);
  }

  function confirmClear() {
    clearLocalData();
    setConfirming(false);
    setCleared(true);
  }

  const analyticsOn = optedOut === null ? true : !optedOut;

  return (
    <div className="space-y-6">
      {/* Analytics */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Usage analytics</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Anonymous, aggregate analytics help us see what&rsquo;s used and what to improve. No
              cookies, no personal information. Turn it off and nothing is collected from this
              browser.
            </p>
          </div>
          <Toggle on={analyticsOn} onClick={toggleAnalytics} label="Usage analytics" />
        </div>
        <p className="mt-3 text-xs font-medium text-neutral-400">
          {optedOut === null
            ? " "
            : analyticsOn
              ? "Analytics is on."
              : "Analytics is off — nothing is collected from this browser."}
        </p>
      </div>

      {/* Clear local data */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Clear data on this device</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          Permanently removes every quiz, folder, and image stored in this browser, along with your
          study preferences. This can&rsquo;t be undone. Your analytics choice above is kept.
        </p>

        {cleared ? (
          <p className="mt-4 inline-flex items-center rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700">
            All local data cleared from this browser.
          </p>
        ) : confirming ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">
              Remove everything stored on this device?
            </span>
            <button
              type="button"
              onClick={confirmClear}
              className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              Yes, clear it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-lg border border-neutral-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
          >
            Clear local data
          </button>
        )}
      </div>
    </div>
  );
}
