/**
 * Global site footer — rendered by AppShell on every shell'd page (the immersive
 * editor/player don't use AppShell, so they stay chrome-free). Two link groups
 * the brief asks for — INFORMATION and LEGAL — plus the wordmark, a one-line
 * pitch, and an independence disclaimer. Server component: just links.
 */
import Link from "next/link";

interface FooterLink {
  href: string;
  label: string;
}

const INFORMATION: FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/exams", label: "Exam guides" },
  { href: "/help", label: "Help Center" },
  { href: "/report", label: "Report an issue" },
  { href: "/contact", label: "Contact" },
];

const LEGAL: FooterLink[] = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/privacy-settings", label: "Privacy Settings" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-neutral-500 outline-none transition hover:text-neutral-900 focus-visible:text-neutral-900"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-neutral-900 outline-none focus-visible:underline"
            >
              unethical<span className="text-neutral-400">tools</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Turn a multiple-choice PDF — practice tests, past papers, question banks — into an
              interactive quiz. Extracted deterministically, never rewritten by a model.
            </p>
          </div>
          <FooterColumn title="Information" links={INFORMATION} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-neutral-100 pt-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} unethicaltools. All rights reserved.</p>
          <p>
            Independent study tool — not affiliated with or endorsed by any examination board.
          </p>
        </div>
      </div>
    </footer>
  );
}
