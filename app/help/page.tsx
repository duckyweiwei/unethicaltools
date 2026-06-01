import type { Metadata } from "next";
import { Article, Section, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "How to turn a PDF into an interactive quiz: supported files, answer keys, combining papers, attaching figures, where your quizzes are stored, and troubleshooting.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <Article
      title="Help Center"
      lead="Short answers to the questions that come up most. Still stuck? Reach us from the Contact page."
    >
      <Section title="How do I turn a PDF into a quiz?">
        <p>
          Open <A href="/tools/pdf-to-quiz">Convert a PDF</A>, choose your file, and we extract the
          questions for you. You land in a review editor where you can fix anything, then publish the
          quiz to your library to study it.
        </p>
      </Section>

      <Section title="What kinds of PDFs work best?">
        <p>
          Text-based multiple-choice PDFs — practice tests, past papers, and question banks — work
          best, because the text can be read directly from the file. Scanned or photographed pages
          have no selectable text, so they extract poorly. Files up to 50 pages and 6&nbsp;MB are
          supported.
        </p>
      </Section>

      <Section title="Why did some questions get skipped?">
        <p>
          Anything that didn&rsquo;t look like a clean multiple-choice question is set aside rather
          than guessed at. Skipped blocks appear in the review editor — you can promote one into a
          real question and edit it, or dismiss it. Long free-response and fill-in-the-table prompts
          aren&rsquo;t supported as quiz questions and are left out on purpose.
        </p>
      </Section>

      <Section title="It didn&rsquo;t find an answer key — what now?">
        <p>
          Some question-only PDFs carry no answers. We&rsquo;ll flag that with a banner; just click
          the circle beside the correct choice on each question to set it. If you also have a
          separate answer key or mark scheme, you can upload it alongside the questions and we&rsquo;ll
          reconcile the answers by question number.
        </p>
      </Section>

      <Section title="Can I combine several PDFs?">
        <p>
          Yes. Add multiple files before converting and they merge into one quiz, renumbered in
          order, with each question tagged by its source file so you always know where it came from.
        </p>
      </Section>

      <Section title="How do images and figures work?">
        <p>
          Figures are pulled from your PDF and, where we can tell, attached to the question that
          references them automatically. Anything we can&rsquo;t place confidently waits in a review
          tray so you can attach it to the right question or dismiss it.
        </p>
      </Section>

      <Section title="Where are my quizzes stored?">
        <p>
          In your own browser — quizzes and folders in local storage, images in your browser&rsquo;s
          database. They&rsquo;re private to this device and survive reloads. You can remove
          everything at any time from <A href="/privacy-settings">Privacy Settings</A>.
        </p>
      </Section>

      <Section title="Is it free?">
        <p>
          Converting, editing, and studying your quizzes is free. Optional AI-assisted features are a
          separate paid layer; the core converter stays free.
        </p>
      </Section>
    </Article>
  );
}
