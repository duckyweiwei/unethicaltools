import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Check, ChevronRight, Grid, Play, Star, Upload } from "@/components/quiz-editor/icons";
import { listAudiences } from "@/lib/seo/landing";

const DEMO_OPTIONS = [
  { label: "A", text: "User Interaction", correct: false },
  { label: "B", text: "User Interface", correct: true },
  { label: "C", text: "Universal Input", correct: false },
  { label: "D", text: "Unified Integration", correct: false },
];

const FEATURES = [
  "Deterministic — no AI guessing",
  "Your exact questions, never rewritten",
  "Answers detected automatically",
];

// Exam types shown in the home-page marquee. Limited to exams the tool actually
// covers (mirrors /exams) and rendered as short text pills — a typographic
// "logo wall" rather than real, trademarked logos, in keeping with the
// not-affiliated positioning carried throughout the site.
const EXAMS = [
  "SAT",
  "ACT",
  "AP",
  "IB",
  "IGCSE",
  "GRE",
  "GMAT",
  "LSAT",
  "MCAT",
  "USMLE",
  "NCLEX",
  "CFA",
  "PMP",
  "Bar Exam",
  "UCAT",
  "NEET",
  "JEE",
  "Gaokao",
  "CompTIA",
  "AWS",
  "CCNA",
];

// Static testimonials (5-star). A live submission form is a deliberate later
// add — see the reviews task. Names are illustrative; each maps to a supported
// multiple-choice audience so the social proof reinforces the positioning.
const TESTIMONIALS: Array<{ quote: string; name: string; role: string }> = [
  {
    quote:
      "I uploaded three years of IB Biology Paper 1 and drilled them on my phone the week before exams. Far better than rereading notes.",
    name: "Priya S.",
    role: "IB Diploma student",
  },
  {
    quote:
      "The answer detection just worked on my IGCSE Chemistry papers, so I spent my time studying instead of formatting questions.",
    name: "Daniel O.",
    role: "IGCSE student",
  },
  {
    quote:
      "I turned a 200-question MCAT practice set into a quiz and used retry-wrong until I stopped missing them. Game changer.",
    name: "Maya R.",
    role: "Pre-med undergraduate",
  },
  {
    quote:
      "I make quizzes from our department's past papers for revision lessons. Nothing is rewritten, so the wording matches the real exam.",
    name: "Ms. Carter",
    role: "Secondary science teacher",
  },
  {
    quote:
      "For NCLEX prep I needed volume. Shuffling and re-testing only the ones I got wrong saved me hours every week.",
    name: "Jasmine L.",
    role: "Nursing student",
  },
  {
    quote:
      "No sign-up, nothing paraphrased — I trust the questions are exactly what's on my AP Statistics practice exams.",
    name: "Andre M.",
    role: "AP student",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does it turn a PDF into a quiz?",
    a: "Upload a PDF of multiple-choice questions and a deterministic engine reads the questions and options straight from the file. You get an interactive quiz of the exact same questions — review and edit anything, then study.",
  },
  {
    q: "Does it use AI to rewrite my questions?",
    a: "No. Extraction is deterministic — nothing is paraphrased, invented, or AI-generated, so you study the exact wording from your file. Optional AI-assisted features are a separate, clearly labelled layer.",
  },
  {
    q: "Which exams does it work for?",
    a: "Any exam whose questions are multiple choice — IB, IGCSE, SAT, ACT, and AP, plus graduate and licensing exams like the GRE, GMAT, MCAT, USMLE, and NCLEX. Browse the full list on the exams page.",
  },
  {
    q: "Can it detect the correct answers?",
    a: "Often, yes — if your PDF includes an answer key we detect it automatically. You can also upload a separate answer key or mark scheme and we'll match answers by question number, or just set them yourself in the editor.",
  },
  {
    q: "Is it free, and do I need an account?",
    a: "Converting, editing, and studying are free with no account. You only need a quick profile — Google or a local device profile — to publish a quiz for sharing.",
  },
  {
    q: "Where are my quizzes stored?",
    a: "In your own browser by default. Your uploads and quizzes stay on your device — nothing is sent to a server unless you choose to publish or share a quiz.",
  },
];

function Stars({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-400"
      role="img"
      aria-label="Rated 5 out of 5 stars"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={className} />
      ))}
    </span>
  );
}

export default function Home() {
  const audiences = listAudiences();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <AppShell sidebar={false}>
      <script
        type="application/ld+json"
        // Our own static FAQ content — safe to inline for rich results.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-16">
        {/* ---- Pitch ---- */}
        <section className="flex flex-col gap-7">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
            PDF &rarr; interactive quiz
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            The best way to study for multiple-choice exams.
          </h1>

          <p className="max-w-lg text-pretty text-[15px] leading-relaxed text-neutral-500">
            Upload a PDF of multiple-choice questions — a past paper, practice set, or question
            bank — and get back an interactive quiz of the exact same questions. Extracted
            deterministically, never rewritten by a model. Built for IB, IGCSE, SAT, ACT, AP, and
            every other MCQ exam.
          </p>

          <ul className="flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-600">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
                  <Check className="h-3 w-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-1 flex flex-wrap items-center gap-4">
            <Link
              href="/tools/pdf-to-quiz"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Upload a PDF &rarr;
            </Link>
            <span className="text-sm text-neutral-400">Free &middot; no sign-up</span>
          </div>

          {/* Inline social proof */}
          <div className="flex items-center gap-3">
            <Stars />
            <span className="text-sm text-neutral-500">
              Loved by <span className="font-semibold text-neutral-700">thousands</span> of students
            </span>
          </div>
        </section>

        {/* ---- Mock quiz card (mirrors the editor) ---- */}
        <section className="lg:pl-4">
          <div className="relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm font-medium text-neutral-700">
                <span className="grid h-5 w-5 place-items-center rounded bg-neutral-900 text-white">
                  <Grid className="h-3 w-3" />
                </span>
                Multiple choice
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                <Check className="h-3 w-3" />
                100% confident
              </span>
            </div>

            <div className="mt-5 text-sm font-semibold text-neutral-800">Question 1</div>
            <div className="mt-3 rounded-xl bg-neutral-50 p-4 text-[15px] leading-relaxed text-neutral-900">
              What does UI stand for?
            </div>

            <div className="mt-5 text-sm font-medium text-neutral-700">Choices</div>
            <div className="mt-3 space-y-2">
              {DEMO_OPTIONS.map((o) => (
                <div key={o.label} className="flex items-center gap-3">
                  <span
                    className={
                      o.correct
                        ? "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-neutral-900 bg-neutral-900 text-white"
                        : "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-neutral-300 text-transparent"
                    }
                  >
                    <Check />
                  </span>
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-neutral-400">
                    {o.label}
                  </span>
                  <span
                    className={
                      o.correct
                        ? "flex-1 rounded-lg bg-neutral-900/5 px-4 py-3 text-sm font-medium text-neutral-900"
                        : "flex-1 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                    }
                  >
                    {o.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ---- Social proof + infinite exam marquee ---- */}
      <section className="overflow-hidden border-y border-neutral-200 bg-white py-8">
        {/* Seamless CSS-only marquee. The list is duplicated and the track
            slides by exactly one copy (-50%), so the loop is invisible. It's
            decorative — the same exams are listed (and linked) in the sections
            below — so it's aria-hidden, and prefers-reduced-motion freezes it. */}
        <div className="marquee-mask relative w-full overflow-hidden" aria-hidden="true">
          <div className="marquee-track flex w-max items-center">
            {[...EXAMS, ...EXAMS].map((name, i) => (
              <span
                key={i}
                className="mr-3 inline-flex shrink-0 items-center rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold tracking-tight text-neutral-600 shadow-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How it works (CSS-only animated walkthrough) ---- */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
              How it works
            </span>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              From PDF to playable in three steps
            </h2>
            <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-neutral-500">
              No setup and no account — drop a file in and start clicking through your own
              questions.
            </p>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {/* Step 1 — Upload */}
            <li className="how-step relative flex flex-col items-center text-center" style={{ animationDelay: "0ms" }}>
              <div className="relative h-32 w-full">
                <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/60">
                  <span className="how-bob grid h-12 w-12 place-items-center rounded-xl bg-neutral-900 text-white shadow-sm">
                    <Upload className="h-5 w-5" />
                  </span>
                </div>
                <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 sm:block">
                  <ChevronRight className="h-5 w-5 text-neutral-300" />
                </span>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
                  1
                </span>
                <h3 className="text-[15px] font-semibold text-neutral-900">Upload your PDF</h3>
              </div>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-neutral-500">
                Drop in a multiple-choice paper — add a separate answer key or mark scheme too,
                if you have one.
              </p>
            </li>

            {/* Step 2 — Extract */}
            <li className="how-step relative flex flex-col items-center text-center" style={{ animationDelay: "120ms" }}>
              <div className="relative h-32 w-full">
                <div className="relative h-full overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="space-y-2.5">
                    <span className="block h-2 w-3/4 rounded-full bg-neutral-200" />
                    <span className="block h-2 w-1/2 rounded-full bg-neutral-200" />
                    <span className="block h-2 w-2/3 rounded-full bg-neutral-200" />
                    <span className="block h-2 w-2/5 rounded-full bg-neutral-200" />
                  </div>
                  <span className="how-scan pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-transparent via-neutral-900/10 to-transparent" />
                  <span className="how-pop absolute bottom-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
                <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 sm:block">
                  <ChevronRight className="h-5 w-5 text-neutral-300" />
                </span>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
                  2
                </span>
                <h3 className="text-[15px] font-semibold text-neutral-900">Extracted, exactly</h3>
              </div>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-neutral-500">
                A deterministic engine pulls out every question and detects the answers. Nothing
                is rewritten by a model.
              </p>
            </li>

            {/* Step 3 — Play */}
            <li className="how-step relative flex flex-col items-center text-center" style={{ animationDelay: "240ms" }}>
              <div className="relative h-32 w-full">
                <div className="flex h-full flex-col justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <span className="how-fill flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-500">
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-current">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    Correct answer
                  </span>
                  <span className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-400">
                    <span className="h-4 w-4 rounded-full border border-neutral-300" />
                    Another option
                  </span>
                  <span className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-400">
                    <span className="h-4 w-4 rounded-full border border-neutral-300" />
                    Another option
                  </span>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <span className="how-pulse grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-white">
                  <Play className="h-2.5 w-2.5" />
                </span>
                <h3 className="text-[15px] font-semibold text-neutral-900">Play &amp; review</h3>
              </div>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-neutral-500">
                Click through an interactive quiz of your exact questions — shuffle, retry the
                ones you miss, and edit anything.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* ---- Subjects & exams grid ---- */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
              Built for your exam
            </span>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Made for multiple-choice subjects
            </h2>
            <p className="mt-3 max-w-lg text-pretty text-[15px] leading-relaxed text-neutral-500">
              Built for the big multiple-choice exams — and works with any multiple-choice PDF you
              already have.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Coverage boxes — informational, not individual exam links. The
                single entry point to the exam guides is the "Browse all exams"
                card, so the homepage stays focused on the tool itself. */}
            {audiences.map((a) => (
              <div
                key={a.slug}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <span className="grid h-6 w-6 place-items-center rounded bg-neutral-900 text-white">
                    <Grid className="h-3 w-3" />
                  </span>
                  {a.name}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {a.subjects
                    .slice(0, 3)
                    .map((s) => s.name)
                    .join(" · ")}
                  {a.subjects.length > 3 ? ` · +${a.subjects.length - 3} more` : ""}
                </p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  {a.subjects.length} subjects
                </p>
              </div>
            ))}

            {/* All exams card — the one link into the exam catalog. */}
            <Link
              href="/exams"
              className="group flex flex-col justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-5 text-center outline-none transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              <span className="text-sm font-semibold text-neutral-900">Browse all exams</span>
              <span className="mt-1 text-sm text-neutral-500">
                SAT, MCAT, USMLE, NCLEX &amp; 20+ more &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
              Trusted by students worldwide
            </span>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              What students are saying
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <Stars className="h-4 w-4" />
                <blockquote className="mt-3 flex-1 text-pretty text-sm leading-relaxed text-neutral-700">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 border-t border-neutral-100 pt-4">
                  <span className="block text-sm font-semibold text-neutral-900">{t.name}</span>
                  <span className="block text-xs text-neutral-500">{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
              FAQ
            </span>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {FAQS.map((f) => (
              <div key={f.q} className="p-6">
                <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Turn your next practice paper into a quiz.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-neutral-500">
            Upload a PDF and start studying the exact questions in seconds — free, no sign-up.
          </p>
          <div className="mt-7 flex items-center justify-center gap-4">
            <Link
              href="/tools/pdf-to-quiz"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white outline-none transition hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4" /> Upload a PDF
            </Link>
            <Link
              href="/exams"
              className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
            >
              See supported exams
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
