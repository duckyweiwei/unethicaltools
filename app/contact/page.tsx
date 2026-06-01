import type { Metadata } from "next";
import { Article, Section, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the unethicaltools team for help, feedback, or partnership enquiries.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Article
      title="Contact"
      lead="Questions, feedback, or partnership ideas — we'd like to hear from you."
    >
      <Section title="Email">
        <p>
          Reach us at{" "}
          <A href="mailto:support@unethicaltools.com">support@unethicaltools.com</A>. We read every
          message and aim to reply within a couple of business days.
        </p>
      </Section>

      <Section title="Reporting a problem">
        <p>
          If something looks wrong with a converted quiz, the{" "}
          <A href="/report">Report an issue</A> page lists the details that help us fix it fastest.
        </p>
      </Section>

      <Section title="Looking for answers first?">
        <p>
          The <A href="/help">Help Center</A> covers supported files, answer keys, combining papers,
          figures, and where your quizzes are stored.
        </p>
      </Section>
    </Article>
  );
}
