import type { Metadata } from "next";
import { Article, A } from "@/components/content/Article";
import { PrivacySettingsClient } from "./PrivacySettingsClient";

export const metadata: Metadata = {
  title: "Privacy Settings",
  description:
    "Manage your privacy on unethicaltools: opt out of anonymous analytics, and permanently clear the quizzes, folders, and images stored in this browser.",
  alternates: { canonical: "/privacy-settings" },
};

export default function PrivacySettingsPage() {
  return (
    <Article
      title="Privacy Settings"
      lead={
        <>
          Control analytics and the data stored in this browser. For the full picture, see the{" "}
          <A href="/privacy">Privacy Policy</A>.
        </>
      }
    >
      <PrivacySettingsClient />
    </Article>
  );
}
