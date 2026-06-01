import type { Metadata } from "next";
import { Article, Section, A } from "@/components/content/Article";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of unethicaltools — what the service is, your responsibilities for the content you upload, and the usual disclaimers.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <Article
      title="Terms of Use"
      lead="Plain-language terms for using unethicaltools. By using the service you agree to them."
      updated="May 31, 2026"
    >
      <Section title="1. The service">
        <p>
          unethicaltools converts multiple-choice PDFs into interactive quizzes that you can review,
          edit, and study. Questions are extracted from your file deterministically; the service does
          not guarantee perfect extraction, and you are responsible for reviewing a quiz before
          relying on it.
        </p>
      </Section>

      <Section title="2. Your content">
        <p>
          You keep all rights to the files you upload and the quizzes you create. You are responsible
          for making sure you have the right to upload and use that material. Do not upload content
          you don&rsquo;t have permission to use, or that is unlawful.
        </p>
      </Section>

      <Section title="3. Acceptable use">
        <p>
          Don&rsquo;t use the service to break the law, infringe others&rsquo; rights, or disrupt,
          overload, or reverse-engineer the service. Don&rsquo;t attempt to access data that
          isn&rsquo;t yours.
        </p>
      </Section>

      <Section title="4. Intellectual property">
        <p>
          The unethicaltools name, site, and software are owned by us and provided to you under a
          limited, revocable licence to use the service as intended. These terms grant you no rights
          in our trademarks.
        </p>
      </Section>

      <Section title="5. Free and paid features">
        <p>
          Uploading, extracting, editing, and studying quizzes is free. Some optional, AI-assisted
          features may require payment; any such terms will be shown before you buy.
        </p>
      </Section>

      <Section title="6. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind, to the fullest extent permitted by law. We don&rsquo;t warrant that
          extraction will be accurate or that the service will be uninterrupted or error-free. It is
          a study aid, not a substitute for your own judgement or your course&rsquo;s official
          materials.
        </p>
      </Section>

      <Section title="7. Limitation of liability">
        <p>
          To the fullest extent permitted by law, unethicaltools is not liable for any indirect,
          incidental, or consequential damages, or for any loss of data, arising from your use of the
          service.
        </p>
      </Section>

      <Section title="8. Changes">
        <p>
          We may update these terms from time to time. Material changes will be reflected by the
          &ldquo;last updated&rdquo; date above; continuing to use the service means you accept the
          current terms.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about these terms? Email{" "}
          <A href="mailto:support@unethicaltools.com">support@unethicaltools.com</A>.
        </p>
      </Section>
    </Article>
  );
}
