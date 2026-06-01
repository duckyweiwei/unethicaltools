import type { Metadata } from "next";
import { Article, Section, Bullets, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "Report an issue",
  description:
    "Found a misparsed question or a bug in unethicaltools? Here's how to report it and what details help us fix it fastest.",
  alternates: { canonical: "/report" },
};

export default function ReportPage() {
  return (
    <Article
      title="Report an issue"
      lead="A question that came out wrong, a figure on the wrong card, or anything broken — tell us and we'll fix it."
    >
      <Section title="What to include">
        <p>The more of this you can share, the faster we can reproduce and fix it:</p>
        <Bullets
          items={[
            "The PDF you were converting (or the specific page), if you're able to share it.",
            "What you expected versus what actually happened.",
            "The quiz or question number involved, if it's a parsing issue.",
            "Your browser and device, for anything visual or performance-related.",
          ]}
        />
      </Section>

      <Section title="How to send it">
        <p>
          Email <A href="mailto:support@unethicaltools.com">support@unethicaltools.com</A> with the
          details above. General questions and feedback are welcome on the{" "}
          <A href="/contact">Contact</A> page.
        </p>
        <p className="text-sm text-neutral-500">
          Please don&rsquo;t include sensitive personal information in a report — share only what we
          need to reproduce the problem.
        </p>
      </Section>
    </Article>
  );
}
