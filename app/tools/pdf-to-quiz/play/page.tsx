import { AppShell } from "@/components/shell/AppShell";
import { PlayClient } from "./PlayClient";

export const metadata = {
  title: "Take the quiz — PDF → Quiz",
};

// The player lives under the global top toolbar for consistent navigation, but
// without the side rail (and footer) so studying stays distraction-free. The
// player renders a slim context line rather than its own full bar (see
// `inShell`), so there's a single top toolbar — no double bar.
export default function PlayPage() {
  return (
    <AppShell sidebar={false} footer={false}>
      <PlayClient />
    </AppShell>
  );
}
