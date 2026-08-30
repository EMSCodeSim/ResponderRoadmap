import type { Metadata } from "next";
import { Suspense } from "react";
import { isDemoAvailable } from "@/server/demo";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Sign in",
};

export default async function LoginPage() {
  const demoAvailable = await isDemoAvailable();
  return (
    <Suspense>
      <LoginForm demoAvailable={demoAvailable} />
    </Suspense>
  );
}
