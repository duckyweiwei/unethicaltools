/**
 * Privacy preferences kept in localStorage — currently a single analytics
 * opt-out flag, shared by the Privacy Settings page (which writes it) and the
 * AnalyticsGate (which reads it to decide whether to load Vercel Analytics).
 *
 * A same-tab change won't fire the `storage` event (that only fires in OTHER
 * tabs), so writers also dispatch PRIVACY_CHANGED_EVENT for the gate in this
 * tab to react immediately. SSR-safe: no-ops without `localStorage`.
 */
export const ANALYTICS_OPT_OUT_KEY = "pdfquiz:analytics-opt-out";
export const PRIVACY_CHANGED_EVENT = "pdfquiz:privacy-changed";

export function isAnalyticsOptedOut(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAnalyticsOptedOut(optedOut: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (optedOut) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
    window.dispatchEvent(new Event(PRIVACY_CHANGED_EVENT));
  } catch {
    /* storage disabled — preference simply won't persist */
  }
}
