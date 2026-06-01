/**
 * Renders an audience hub (e.g. /igcse-past-paper-quiz) or a subject page
 * (e.g. /ib-chemistry) from a resolved Landing record. Server component, so the
 * whole page is static HTML — fast to load and fully indexable. Semantic
 * headings, a single clear CTA, internal links, an FAQ (with FAQPage JSON-LD for
 * rich results), and a visible not-affiliated disclaimer.
 */
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Check, Grid, Upload } from "@/components/quiz-editor/icons";
import {
  disclaimerFor,
  materialOf,
  siblingSubjects,
  type Landing,
  type LandingAudience,
} from "@/lib/seo/landing";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Upload your PDF",
    body: "Drop in a past paper, practice set, or question bank. Up to 50 pages.",
  },
  {
    title: "We extract the questions",
    body: "The exact questions are read straight from the file — deterministically, never rewritten.",
  },
  {
    title: "Review and study",
    body: "Fix anything in the editor, then study with instant feedback, retry-wrong, and more.",
  },
];

function whyBullets(a: LandingAudience): string[] {
  return [
    `Exam-style practice from your own ${a.name} ${materialOf(a)} — the questions you'll actually sit.`,
    "Deterministic extraction: nothing is paraphrased, invented, or AI-generated.",
    "Answers detected automatically; upload a separate answer key or mark scheme to match by question number.",
    "Free to convert, edit, and study — no sign-up, and your quizzes stay in your browser.",
  ];
}

function faqFor(landing: Landing): Array<{ q: string; a: string }> {
  const a = landing.audience;
  const scope = landing.kind === "subject" ? `${a.name} ${landing.subject.name}` : a.name;
  const material = materialOf(a);
  const faqs = [
    {
      q: `Do you provide ${a.name} ${material}?`,
      a: `No. You upload your own ${scope} PDFs — ${material}, practice questions, or your own notes — and we turn them into an interactive quiz of the same questions. The original materials remain the property of their owners.`,
    },
    {
      q: "Are the questions rewritten or AI-generated?",
      a: "No. Questions are extracted directly and deterministically from your PDF. Nothing is paraphrased or invented, so you revise the exact wording.",
    },
    {
      q: "Can it read the answers?",
      a: "When your PDF includes the answers we detect them automatically. You can also upload a separate answer key or mark scheme alongside the questions and we'll reconcile answers by question number.",
    },
    {
      q: `Is the ${scope} quiz maker free?`,
      a: "Yes — uploading, extracting, editing, and studying are free with no account. Optional AI-assisted features are a separate paid layer.",
    },
  ];
  return faqs;
}

function Hero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="flex flex-col gap-6">
      <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
        {eyebrow}
      </span>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-neutral-500">{subtitle}</p>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        <Link
          href="/tools/pdf-to-quiz"
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          <Upload className="h-4 w-4" /> Upload a PDF
        </Link>
        <span className="text-sm text-neutral-400">Free &middot; no sign-up</span>
      </div>
    </section>
  );
}

export function LandingPage({ landing }: { landing: Landing }) {
  const a = landing.audience;
  const material = materialOf(a);
  const eyebrow = `${a.name} · exam-style practice`;
  const title =
    landing.kind === "hub"
      ? `Turn your ${a.name} ${material} into quizzes you can click through.`
      : `Turn your ${a.name} ${landing.subject.name} ${material} into interactive quizzes.`;
  const subtitle =
    landing.kind === "hub"
      ? a.tagline
      : `Upload a ${a.longName} ${landing.subject.name}${
          landing.subject.code ? ` (code ${landing.subject.code})` : ""
        } PDF and study the exact questions online — extracted deterministically, then yours to review and revise. ${landing.subject.blurb}`;

  const faqs = faqFor(landing);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <AppShell sidebar={false}>
      <script
        type="application/ld+json"
        // Our own static content — safe to inline for rich results.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="mx-auto w-full max-w-5xl px-6 py-14">
        <Hero eyebrow={eyebrow} title={title} subtitle={subtitle} />

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-neutral-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Subjects (hub) or sibling subjects (subject page) */}
        {landing.kind === "hub" ? (
          <section className="mt-16">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
              Choose your {a.name} subject
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {a.subjects.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${a.slug}-${s.slug}`}
                  className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm outline-none transition hover:border-neutral-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span className="grid h-6 w-6 place-items-center rounded bg-neutral-900 text-white">
                        <Grid className="h-3 w-3" />
                      </span>
                      {a.name} {s.name}
                      {s.code && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-neutral-500">
                          {s.code}
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-300 transition group-hover:text-neutral-900">
                      &rarr;
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.blurb}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-16">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
              More {a.name} subjects
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/${a.hubSlug}`}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                All {a.name} subjects
              </Link>
              {siblingSubjects(landing).map((sib) => (
                <Link
                  key={sib.slug}
                  href={`/${sib.slug}`}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  {sib.kind === "subject" ? `${a.name} ${sib.subject.name}` : a.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Why */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            Why study with unethicaltools
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {whyBullets(a).map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-600"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            Frequently asked questions
          </h2>
          <div className="mt-5 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {faqs.map((f) => (
              <div key={f.q} className="p-5">
                <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            Ready to revise from your {a.name} papers?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
            Upload a PDF and get an interactive quiz of the same questions in seconds.
          </p>
          <div className="mt-5 flex items-center justify-center gap-4">
            <Link
              href="/tools/pdf-to-quiz"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4" /> Upload a PDF
            </Link>
            <Link href="/help" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              How it works
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="mt-10 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-400">
          {disclaimerFor(a)}
        </p>
      </div>
    </AppShell>
  );
}
