import type { Metadata } from "next";
import { Article, Section, Bullets, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How unethicaltools handles your data: quizzes stay in your browser, uploaded PDFs are processed transiently and not stored, and analytics are privacy-friendly and optional.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Article
      title="Privacy Policy"
      lead="unethicaltools is built local-first: your quizzes live in your browser, not on our servers. Here's exactly what that means."
      updated="May 31, 2026"
    >
      <Section title="What we store on your device">
        <p>
          Your quizzes, folders, and study preferences are saved in your browser&rsquo;s local
          storage, and your question images in your browser&rsquo;s database (IndexedDB). This data
          stays on your device, is private to it, and is never uploaded to us. Clearing your browser
          data — or using <A href="/privacy-settings">Privacy Settings</A> — removes it.
        </p>
      </Section>

      <Section title="What we send to our servers">
        <p>
          When you convert a PDF, the file is sent to our server only to extract its text and images.
          It is processed in memory and discarded immediately afterwards — we do not store your PDFs
          or the extracted content. The resulting quiz is returned to your browser, where you decide
          whether to save it locally.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          We use Vercel Analytics to understand aggregate, anonymous usage — things like page views
          and overall traffic. It is privacy-friendly by design:
        </p>
        <Bullets
          items={[
            "No cookies are used for analytics.",
            "We don't collect names, emails, or other directly identifying information.",
            "Data is aggregated — we can't single you out from it.",
          ]}
        />
        <p>
          You can turn analytics off entirely from{" "}
          <A href="/privacy-settings">Privacy Settings</A>.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We don&rsquo;t use tracking or advertising cookies. The only browser storage we rely on is
          the local storage and database described above, which keep your quizzes working between
          visits.
        </p>
      </Section>

      <Section title="Your choices">
        <Bullets
          items={[
            <>
              Opt out of analytics at any time in <A href="/privacy-settings">Privacy Settings</A>.
            </>,
            <>
              Permanently remove all locally stored quizzes, folders, and images from the same page.
            </>,
            "Use your browser's own controls to clear site data whenever you like.",
          ]}
        />
      </Section>

      <Section title="Children">
        <p>
          The service is intended for general study use and is not directed at children under 13. We
          don&rsquo;t knowingly collect personal information from children.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy from time to time; the &ldquo;last updated&rdquo; date above
          reflects the latest version.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about your privacy? Email{" "}
          <A href="mailto:support@unethicaltools.com">support@unethicaltools.com</A>.
        </p>
      </Section>
    </Article>
  );
}
