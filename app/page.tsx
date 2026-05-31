import { Check, Grid } from "@/components/quiz-editor/icons";

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

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-16">
        {/* ---- Pitch ---- */}
        <section className="flex flex-col gap-7">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
            unethicaltools
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            Your PDF practice test, now a quiz you can click through.
          </h1>

          <p className="max-w-md text-pretty text-[15px] leading-relaxed text-neutral-500">
            Upload a multiple-choice PDF and get an interactive quiz of the exact
            same questions &mdash; extracted deterministically, then yours to
            review and edit. Nothing is rewritten by a model.
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

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <a
              href="/tools/pdf-to-quiz"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Upload a PDF &rarr;
            </a>
            <a
              href="/tools/pdf-to-quiz/review?sample=1"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 transition hover:bg-white"
            >
              Try a sample
            </a>
            <a
              href="/library"
              className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
            >
              My quizzes &rarr;
            </a>
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
    </main>
  );
}
