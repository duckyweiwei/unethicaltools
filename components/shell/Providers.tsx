"use client";

/**
 * Client-side context that needs to wrap the whole app. Right now that's just
 * Auth.js's SessionProvider, which lets any client component call `useSession()`
 * to know who's signed in. It fetches /api/auth/session once and shares it, so
 * the header avatar and the upgrade screen stay in sync without prop-drilling.
 */
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { setSessionAccount } from "@/lib/auth/account";

/** Mirror the Google session into the account store so `getAccount()` (and thus
 *  the quiz library's ownership scoping) reflects a Google sign-in, not just the
 *  local profile. Renders nothing. */
function SessionAccountSync() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "loading") return; // wait until we actually know who's signed in
    setSessionAccount(session?.user ?? null);
  }, [status, session?.user?.email, session?.user?.name]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionAccountSync />
      {children}
    </SessionProvider>
  );
}
