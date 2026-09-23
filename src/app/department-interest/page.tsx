import type { Metadata } from "next";
import { DepartmentInterestForm } from "./interest-form";
import { interestCopy, planFromQuery } from "@/lib/pricing";

type Search = { plan?: string; source?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}): Promise<Metadata> {
  const params = await Promise.resolve(searchParams);
  const copy = interestCopy(planFromQuery(params.plan));
  return {
    title: copy.formTitle,
    description: copy.intro,
    alternates: { canonical: "/department-interest" },
  };
}

export default async function DepartmentInterestPage({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}) {
  const params = await Promise.resolve(searchParams);
  return (
    <DepartmentInterestForm
      plan={planFromQuery(params.plan)}
      source={params.source || "department-interest"}
    />
  );
}
