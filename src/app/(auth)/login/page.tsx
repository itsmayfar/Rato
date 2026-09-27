import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signupAllowed } from "@/lib/actions/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const canSignup = await signupAllowed();
  return (
    <>
      <h1 className="mb-6 text-xl font-extralight">Sign in</h1>
      <LoginForm next={next ?? ""} />
      {canSignup && (
        <p className="mt-6 text-center text-xs text-muted">
          No account yet?{" "}
          <Link href="/signup" className="text-fg underline decoration-accent underline-offset-4">
            Create one
          </Link>
        </p>
      )}
    </>
  );
}
