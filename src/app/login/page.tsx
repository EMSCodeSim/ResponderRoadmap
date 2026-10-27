import { Suspense } from "react";
import { isOpenAccountCreationAvailable } from "@/lib/account-access";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm accountCreationOpen={isOpenAccountCreationAvailable()} />
    </Suspense>
  );
}
