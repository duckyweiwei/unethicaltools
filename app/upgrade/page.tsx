import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { UpgradeClient } from "./UpgradeClient";

export const metadata: Metadata = {
  title: "Upgrade to Pro",
  description: "Go Pro to unlock the full converter. Cancel anytime.",
};

export default function UpgradePage() {
  return (
    <AppShell sidebar={false}>
      {/* UpgradeClient reads ?status (useSearchParams); the Suspense boundary
          keeps the route statically renderable in Next 15. */}
      <Suspense fallback={null}>
        <UpgradeClient />
      </Suspense>
    </AppShell>
  );
}
