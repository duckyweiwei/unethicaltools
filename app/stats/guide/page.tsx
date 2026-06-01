import { AppShell } from "@/components/shell/AppShell";
import { GuideClient } from "./GuideClient";

export const metadata = {
  title: "Your study guide — PDF → Quiz",
};

// A prescriptive companion to /stats: the same localStorage attempt history, but
// turned into an ordered plan (focus areas, questions to review, next actions).
// Lives under the app shell like /stats; the footer is off so it reads as a
// focused, printable document (the Print button strips the shell chrome via the
// global @media print rules).
export default function StudyGuidePage() {
  return (
    <AppShell footer={false}>
      <GuideClient />
    </AppShell>
  );
}
