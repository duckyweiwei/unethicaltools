import type { Metadata } from "next";
import { Article, Section, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "About",
  description:
    "unethicaltools turns multiple-choice PDFs — practice tests, past papers, and question banks — into interactive quizzes. Questions are extracted deterministically and never rewritten by a model.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Article
      title="About unethicaltools"
      lead="A faster way to study from the multiple-choice PDFs you already have."
    >
      <Section title="What it does">
        <p>
          unethicaltools converts a multiple-choice PDF into an interactive quiz you can click
          through. Upload a practice test, a past paper, or a question bank and you get the exact
          same questions as a quiz — ready to review, edit, and study at your own pace.
        </p>
      </Section>

      <Section title="Deterministic, not generated">
        <p>
          Every question is extracted directly from your file. Nothing is paraphrased, invented, or
          rewritten by a language model — what you wrote, or what your exam board wrote, is what you
          study. When a PDF includes an answer key, we detect the correct answers automatically; when
          it doesn&rsquo;t, you can set them in a couple of clicks.
        </p>
      </Section>

      <Section title="Who it&rsquo;s for">
        <p>
          Students and self-learners preparing from exam-style material: IB and IGCSE past papers,
          university question banks, certification practice tests, and classroom handouts. If your
          study material is a multiple-choice PDF, it belongs here.
        </p>
      </Section>

      <Section title="Your data stays with you">
        <p>
          Your quizzes, folders, and images are stored in your own browser, not on our servers. A PDF
          is sent to our servers only briefly to extract its text and images, then discarded — see
          the <A href="/privacy">Privacy Policy</A> for the full picture, and{" "}
          <A href="/privacy-settings">Privacy Settings</A> to manage what&rsquo;s stored locally.
        </p>
      </Section>

      <Section title="Free to use">
        <p>
          Uploading, extracting, editing, and studying your quizzes is free. Optional AI-assisted
          features are planned as a separate paid layer; the core converter will stay free.
        </p>
      </Section>
    </Article>
  );
}
