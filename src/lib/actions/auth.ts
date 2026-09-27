"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { artistProfiles, userSettings, users } from "@/lib/db/schema";
import {
  clearFailures,
  createSession,
  destroySession,
  hashPassword,
  isThrottled,
  recordFailure,
  verifyPassword,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, type ActionState } from "@/lib/action-state";
import { ensureDefaultAutomations } from "@/lib/automations/defaults";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error));
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${parsed.data.email}`;
  if (isThrottled(key)) return fail("Too many sign-in attempts. Wait 15 minutes and try again.");

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    recordFailure(key);
    return fail("Email or password is incorrect.");
  }
  clearFailures(key);
  await createSession(user.id);
  await audit(user.id, "auth.login", "user", user.id, "Signed in");
  redirect(safeNext(form.get("next")));
}

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export async function signupAllowed() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n === 0 || process.env.ALLOW_SIGNUP === "true";
}

export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await signupAllowed())) return fail("Sign-up is disabled. Ask the account owner for access.");
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error));
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (exists.length) return fail("An account with this email already exists.", { email: "Already registered." });

  const passwordHash = await hashPassword(parsed.data.password);
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
      .returning({ id: users.id });
    await tx.insert(userSettings).values({ userId: u.id });
    await tx.insert(artistProfiles).values({ userId: u.id });
    return u.id;
  });
  await ensureDefaultAutomations(userId);
  await createSession(userId);
  await audit(userId, "auth.signup", "user", userId, "Account created");
  redirect("/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
}
