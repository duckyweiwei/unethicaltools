import { AppShell } from "@/components/shell/AppShell";
import { PdfUploader } from "./PdfUploader";

export const metadata = {
  title: "PDF → Quiz",
};

export default function PdfToQuizPage() {
  return (
    <AppShell sidebar={false}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-12 pb-40 md:pb-56">
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
      </div>
    </AppShell>
  );
}
