import { PdfUploader } from "./PdfUploader";

export const metadata = {
  title: "PDF → Quiz",
};

export default function PdfToQuizPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
        <a
          href="/"
          className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400 transition hover:text-neutral-600"
        >
          &larr; unethicaltools
        </a>

        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Turn a PDF practice test into an interactive quiz
        </h1>
        <p className="text-pretty text-[15px] leading-relaxed text-neutral-500">
          Upload one or more multiple-choice PDFs &mdash; add a separate answer
          key too, if the answers live in their own file &mdash; then build one
          clickable quiz of the exact same questions. Extracted deterministically,
          answers detected, yours to review and edit. Nothing is rewritten by a model.
        </p>

        <PdfUploader />

        <div className="flex items-center gap-3 pt-2 text-sm text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          or
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <a
          href="/tools/pdf-to-quiz/review?sample=1"
          className="mx-auto inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
        >
          Try the editor with a sample quiz &rarr;
        </a>
      </div>
    </main>
  );
}
