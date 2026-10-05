import { AssignmentWorkspaceTabs } from "@/components/AssignmentWorkspaceTabs";

export default function AssignmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AssignmentWorkspaceTabs />
      {children}
    </>
  );
}
