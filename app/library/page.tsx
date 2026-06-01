import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { LibraryClient } from "./LibraryClient";

export const metadata = {
  title: "My quizzes — PDF → Quiz",
};

export default function LibraryPage() {
  return (
    <AppShell>
      {/* Suspense boundary required by Next 15 because LibraryClient reads
          useSearchParams (folder selection comes from the URL query). */}
      <Suspense fallback={null}>
        <LibraryClient />
      </Suspense>
    </AppShell>
  );
}
