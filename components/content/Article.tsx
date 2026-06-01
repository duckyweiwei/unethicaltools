/**
 * Shared layout for the site's prose pages (About, Help, legal, etc.): a
 * centered, readable column inside the standard AppShell (no sidebar). Exports a
 * few small typographic helpers so each page reads as content, not markup.
 * Server components throughout — these pages are static and indexable.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";

const LINK =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-900";

export function Article({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <AppShell sidebar={false}>
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <header className="border-b border-neutral-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            {title}
          </h1>
          {lead && (
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-neutral-500">{lead}</p>
          )}
          {updated && <p className="mt-4 text-xs text-neutral-400">Last updated {updated}</p>}
        </header>
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </AppShell>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-600">{children}</div>
    </section>
  );
}

/** Bulleted list with the site's muted styling. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-neutral-600">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** A content link — internal via next/link, external/mailto via a plain anchor. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {children}
      </a>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={LINK}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK}>
      {children}
    </Link>
  );
}
