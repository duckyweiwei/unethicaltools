import { AppShell } from "@/components/shell/AppShell";
import { StatsClient } from "./StatsClient";

export const metadata = {
  title: "Progress — PDF → Quiz",
};

// Study analytics live under the full app shell (top toolbar + side rail), like
// the library — it's a place you browse, not a focused task. All numbers are
// derived client-side from localStorage attempt history (see StatsClient).
export default function StatsPage() {
  return (
    <AppShell>
      <StatsClient />
    </AppShell>
  );
}
