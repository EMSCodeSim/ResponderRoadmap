import type { Metadata } from "next";
import { DepartmentInterestForm } from "./interest-form";

type Search = { source?: string };

export const metadata: Metadata = {
  title: "Department test access",
  description: "Request access to the Responder Roadmap department test.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/department-interest" },
};

export default async function DepartmentInterestPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  return <DepartmentInterestForm source={params.source || "department-testing"} />;
}
