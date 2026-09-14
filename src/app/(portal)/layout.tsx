import { AppShell } from "@/components/AppShell";
import { FireOpsTaskBridge } from "@/components/FireOpsTaskBridge";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <FireOpsTaskBridge />
      {children}
    </AppShell>
  );
}
