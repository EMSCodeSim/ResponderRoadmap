import { Suspense } from "react";
import { isDemoAvailable } from "@/server/demo";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const demoAvailable = await isDemoAvailable();
  return (
    <Suspense>
      <LoginForm demoAvailable={demoAvailable} />
    </Suspense>
  );
}
