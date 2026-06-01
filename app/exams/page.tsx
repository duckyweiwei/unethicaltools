/**
 * /exams — an SEO catalog of the multiple-choice exams this tool helps with.
 *
 * The pitch the whole site rests on: if your prep comes as a PDF of
 * multiple-choice questions, you can turn it into an interactive quiz. This page
 * makes that concrete across the exams people actually search for, grouped by
 * kind, and links the well-supported ones (SAT/ACT/AP/IGCSE/IB) to their
 * dedicated landing hubs for deeper internal linking.
 *
 * Server component → static HTML, fully indexable. We never host exam papers;
 * the copy is about turning the user's OWN practice material into quizzes, and a
 * visible disclaimer notes we're independent of every named body.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Check, Grid, Upload } from "@/components/quiz-editor/icons";

export const metadata: Metadata = {
  title: "Multiple-Choice Exams You Can Turn Into Quizzes",
  description:
    "Turn your own practice questions from the SAT, ACT, AP, IB, IGCSE, GRE, GMAT, MCAT, USMLE, NCLEX and dozens more multiple-choice exams into interactive quizzes. Upload a PDF — deterministic, free, no sign-up.",
  alternates: { canonical: "/exams" },
  openGraph: {
    type: "website",
    url: "/exams",
    title: "Multiple-Choice Exams You Can Turn Into Quizzes · unethicaltools",
    description:
      "From the SAT and AP to the MCAT, USMLE, and CFA — turn your own multiple-choice practice PDFs into interactive quizzes.",
  },
  twitter: {
    card: "summary",
    title: "Multiple-Choice Exams You Can Turn Into Quizzes",
    description:
      "Turn your own multiple-choice practice PDFs — SAT, ACT, AP, MCAT, USMLE and more — into interactive quizzes.",
  },
};

interface ExamEntry {
  name: string;
  /** What it is + why it's a fit (it's multiple choice). */
  note: string;
  /** Region/scope shown as a small tag. */
  region: string;
  /** Landing hub for the well-supported audiences; absent = informational only. */
  href?: string;
}

interface ExamGroup {
  title: string;
  blurb: string;
  exams: ExamEntry[];
}

const GROUPS: ExamGroup[] = [
  {
    title: "Curriculum & school exams",
    blurb: "International school qualifications with multiple-choice science and commerce papers.",
    exams: [
      {
        name: "Cambridge IGCSE",
        region: "Global",
        note: "Biology, Chemistry, Physics, Combined & Co-ordinated Sciences, Economics, and Accounting all have multiple-choice papers.",
        href: "/igcse-past-paper-quiz",
      },
      {
        name: "IB Diploma",
        region: "Global",
        note: "Sciences and Design Technology Paper 1A is entirely multiple choice.",
        href: "/ib-past-paper-quiz",
      },
    ],
  },
  {
    title: "National & college entrance exams",
    blurb: "High-stakes admissions tests, many of them built largely on multiple-choice questions.",
    exams: [
      {
        name: "SAT",
        region: "United States",
        note: "Digital SAT Reading & Writing and Math are multiple choice.",
        href: "/sat-practice-questions",
      },
      {
        name: "ACT",
        region: "United States",
        note: "English, Math, Reading, and Science are all multiple choice.",
        href: "/act-practice-questions",
      },
      {
        name: "AP",
        region: "United States",
        note: "Section I of every Advanced Placement exam is multiple choice.",
        href: "/ap-practice-questions",
      },
      {
        name: "Gaokao",
        region: "China",
        note: "China's national college entrance exam includes multiple-choice sections across subjects.",
      },
      {
        name: "JEE (Main)",
        region: "India",
        note: "Joint Entrance Examination for engineering — multiple-choice and numerical-answer questions.",
      },
      {
        name: "NEET",
        region: "India",
        note: "National medical-admissions test — 180 multiple-choice questions.",
      },
      {
        name: "CSAT (Suneung)",
        region: "South Korea",
        note: "The College Scholastic Ability Test is multiple choice across its sections.",
      },
      {
        name: "ICFES Saber 11",
        region: "Colombia",
        note: "Colombia's secondary-exit and university-entrance test is multiple choice.",
      },
      {
        name: "UCAT",
        region: "UK & Australia",
        note: "University Clinical Aptitude Test for medical and dental school — multiple choice.",
      },
    ],
  },
  {
    title: "Graduate & professional admissions",
    blurb: "Postgraduate gateway tests with substantial multiple-choice sections.",
    exams: [
      {
        name: "GRE",
        region: "Global",
        note: "Verbal Reasoning and Quantitative Reasoning are multiple choice.",
      },
      {
        name: "GMAT",
        region: "Global",
        note: "Business-school admissions test — multiple-choice quant, verbal, and data insights.",
      },
      {
        name: "LSAT",
        region: "US & Canada",
        note: "Law-school admissions — logical reasoning and reading comprehension are multiple choice.",
      },
      {
        name: "MCAT",
        region: "US & Canada",
        note: "Medical College Admission Test — multiple choice across four sections.",
      },
    ],
  },
  {
    title: "Professional licensing & certification",
    blurb: "Licensing boards and IT/finance certifications dominated by multiple-choice items.",
    exams: [
      {
        name: "USMLE",
        region: "United States",
        note: "United States Medical Licensing Examination — multiple choice across Steps 1–3.",
      },
      {
        name: "NCLEX",
        region: "US & Canada",
        note: "Nursing licensure exam — multiple-choice and alternate-format questions.",
      },
      {
        name: "Bar Exam (MBE)",
        region: "United States",
        note: "The Multistate Bar Examination is 200 multiple-choice questions.",
      },
      {
        name: "MPRE",
        region: "United States",
        note: "Multistate Professional Responsibility Examination — 60 multiple-choice questions.",
      },
      {
        name: "CFA",
        region: "Global",
        note: "Chartered Financial Analyst Levels I & II are multiple choice and item sets.",
      },
      {
        name: "PMP",
        region: "Global",
        note: "Project Management Professional — multiple-choice and multiple-response questions.",
      },
      {
        name: "AWS Certification",
        region: "Global",
        note: "Amazon Web Services exams — multiple-choice and multiple-response.",
      },
      {
        name: "CompTIA",
        region: "Global",
        note: "A+, Network+, Security+ and more — multiple choice.",
      },
      {
        name: "Cisco CCNA",
        region: "Global",
        note: "Cisco Certified Network Associate — multiple choice and simulations.",
      },
    ],
  },
];

/** ItemList JSON-LD for the audiences we have dedicated guides for. */
function supportedItemListLd() {
  const supported = GROUPS.flatMap((g) => g.exams).filter((e) => e.href);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Multiple-choice exams supported by unethicaltools",
    itemListElement: supported.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${e.name} practice quizzes`,
      url: `https://unethicaltools.com${e.href}`,
    })),
  };
}

function ExamCard({ exam }: { exam: ExamEntry }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-900 text-white">
            <Grid className="h-3 w-3" />
          </span>
          {exam.name}
        </span>
        {exam.href ? (
          <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white">
            Guide &rarr;
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
            {exam.region}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">{exam.note}</p>
      {exam.href && (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
          {exam.region}
        </p>
      )}
    </>
  );

  if (exam.href) {
    return (
      <Link
        href={exam.href}
        className="group block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm outline-none transition hover:border-neutral-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">{inner}</div>;
}

export default function ExamsPage() {
  return (
    <AppShell sidebar={false}>
      <script
        type="application/ld+json"
        // Our own static catalog — safe to inline for rich results.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(supportedItemListLd()) }}
      />
      <div className="mx-auto w-full max-w-5xl px-6 py-14">
        {/* Hero */}
        <section className="flex flex-col gap-6">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
            Exam coverage
          </span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            The best way to study for multiple-choice exams.
          </h1>
          <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-neutral-500">
            If your prep comes as a PDF of multiple-choice questions, you can turn it into an
            interactive quiz — extracted deterministically, never rewritten by a model. Here are the
            exams it fits, from school sciences to graduate admissions and professional licensing.
          </p>
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

        {/* Groups */}
        {GROUPS.map((group) => (
          <section key={group.title} className="mt-14">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{group.title}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
              {group.blurb}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.exams.map((exam) => (
                <ExamCard key={exam.name} exam={exam} />
              ))}
            </div>
          </section>
        ))}

        {/* Don't see yours */}
        <section className="mt-14 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            Don&rsquo;t see your exam?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
            The converter doesn&rsquo;t care which exam a PDF is from — any multiple-choice question
            bank, practice set, or past paper works. Upload yours and study the exact questions.
          </p>
          <ul className="mx-auto mt-5 flex max-w-md flex-col gap-2.5 text-left">
            {[
              "Answers detected automatically, or upload a separate key",
              "Shuffle, retry-wrong, and instant-feedback study modes",
              "Track accuracy over time and see what to review next",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-600">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/tools/pdf-to-quiz"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4" /> Convert a PDF
            </Link>
            <Link href="/help" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              How it works
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="mt-10 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-400">
          Independent study tool — not affiliated with, endorsed by, or sponsored by any of the
          examinations or organisations named on this page. All exam names and trademarks belong to
          their respective owners. Upload only materials you have the right to use.
        </p>
      </div>
    </AppShell>
  );
}
