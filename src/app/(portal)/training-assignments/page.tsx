import { redirect } from "next/navigation";

export default function TrainingAssignmentsRedirect() {
  redirect("/assignments/new");
}
