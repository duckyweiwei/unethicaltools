"use client";

/**
 * Global top toolbar — the site's primary navigation, present on every shell'd
 * page. Wordmark links home; primary links (Convert, My quizzes) highlight the
 * active route; a persistent "New quiz" action sits on the right. Kept to a
 * single thin sticky bar so it frames content without competing with it.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@/components/quiz-editor/icons";
import { AccountMenu } from "@/components/shell/AccountMenu";

const NAV = [
  { href: "/tools/pdf-to-quiz", label: "Convert" },
  { href: "/library", label: "My quizzes" },
  { href: "/stats", label: "Progress" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-14 w-full items-center gap-1 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-2 rounded-lg px-2 py-1.5 text-sm font-semibold tracking-tight text-neutral-900 outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          unethical<span className="text-neutral-400">tools</span>
          <span className="ml-0.5 align-super text-[10px] font-semibold text-neutral-400">beta</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-0.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                  active
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/tools/pdf-to-quiz"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" /> New quiz
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
