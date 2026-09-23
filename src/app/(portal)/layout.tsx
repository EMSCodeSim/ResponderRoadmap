import { AppShell } from "@/components/AppShell";
import { FireOpsTaskBridge } from "@/components/FireOpsTaskBridge";
import { ResponderAiDesk } from "@/components/ResponderAiDesk";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <FireOpsTaskBridge />
      {children}
      <ResponderAiDesk />
    </AppShell>
  );
}
