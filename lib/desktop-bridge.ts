/**
 * Bridge to Tauri's IPC layer. The same React UI runs in both contexts:
 *   - Browser:  isDesktop() returns false → use lib/converter-engine.ts (WASM)
 *   - Tauri:    isDesktop() returns true  → use lib/desktop-engine.ts (native IPC)
 *
 * Tauri injects a global __TAURI_INTERNALS__ object into the webview at
 * preload time. Sniffing that object is the safe way to detect the runtime
 * — checking user-agent strings is unreliable across system WebViews.
 */

export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

/**
 * Lazy-import the Tauri APIs only when we know we're in the desktop runtime.
 * In the browser they'd error out (the packages assume the global is present).
 */
export async function getTauriApis() {
  if (!isDesktop()) throw new Error("Not running in Tauri");
  const [{ invoke }, eventMod, dialogMod] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/event"),
    import("@tauri-apps/plugin-dialog"),
  ]);
  return {
    invoke,
    listen: eventMod.listen as <T>(
      event: string,
      cb: (e: { payload: T }) => void,
    ) => Promise<() => void>,
    open: dialogMod.open,
    save: dialogMod.save,
  };
}
