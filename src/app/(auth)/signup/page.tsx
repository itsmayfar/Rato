import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signupAllowed } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/primitives";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const allowed = await signupAllowed();
  return (
    <>
      <h1 className="mb-6 text-xl font-extralight">Create your account</h1>
      {allowed ? (
        <SignupForm />
      ) : (
        <Notice tone="warning" title="Sign-up is closed">
          This installation already has an owner. Set ALLOW_SIGNUP=true to allow additional accounts.
        </Notice>
      )}
      <p className="mt-6 text-center text-xs text-muted">
        Already registered?{" "}
        <Link href="/login" className="text-fg underline decoration-accent underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
