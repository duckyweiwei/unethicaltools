"use client";

/**
 * Client-side context that needs to wrap the whole app. Right now that's just
 * Auth.js's SessionProvider, which lets any client component call `useSession()`
 * to know who's signed in. It fetches /api/auth/session once and shares it, so
 * the header avatar and the upgrade screen stay in sync without prop-drilling.
 */
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
