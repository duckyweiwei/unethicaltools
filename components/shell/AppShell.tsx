/**
 * Page chrome for the site: a sticky top toolbar over an optional left nav rail,
 * with the page's own content in the main column. Marketing/focus pages pass
 * `sidebar={false}` for a clean full-width canvas; app pages get the rail.
 *
 * A skip link precedes the header so keyboard users can jump straight to
 * content. Server component — it only composes the (client) nav pieces, so the
 * pages that use it stay statically rendered.
 */
import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SideNav } from "./SideNav";
import { SiteFooter } from "./SiteFooter";

export function AppShell({
  children,
  sidebar = true,
  footer = true,
  contentClassName = "min-w-0 flex-1",
}: {
  children: ReactNode;
  sidebar?: boolean;
  /** Show the global footer (info + legal links). Off for surfaces that want a
   *  clean edge. Defaults on. */
  footer?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-neutral-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader />
      <div className="flex w-full flex-1">
        {/* SideNav reads useSearchParams (folder/review highlight); a Suspense
            boundary keeps the host page statically renderable in Next 15. The
            fallback reserves the rail's width so content doesn't shift. */}
        {sidebar && (
          <Suspense
            fallback={
              <div className="hidden w-44 shrink-0 border-r border-neutral-200 bg-white/40 lg:block" />
            }
          >
            <SideNav />
          </Suspense>
        )}
        <main id="main" className={contentClassName}>
          {children}
        </main>
      </div>
      {footer && <SiteFooter />}
    </div>
  );
}
