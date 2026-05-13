"use client";

import { usePathname } from "next/navigation";

/**
 * Tiny page-transition wrapper. The `key={pathname}` makes React unmount the
 * previous page's tree and mount a fresh one on every navigation — the
 * `.page-fade` keyframe (globals.css) animates the new tree's opacity in.
 *
 * Lives between the layout's persistent chrome (nav, animated background,
 * footer) and the page-specific {children}, so only the actual page content
 * fades — the nav stays put and never flashes.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}
