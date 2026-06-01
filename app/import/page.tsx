import { AppShell } from "@/components/shell/AppShell";
import { ImportClient } from "./ImportClient";

export const metadata = {
  title: "Import a shared quiz",
};

export default function ImportPage() {
  return (
    <AppShell sidebar={false}>
      <ImportClient />
    </AppShell>
  );
}
