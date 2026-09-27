/**
 * End-to-end smoke test: signs up a fresh account (or signs in), walks every
 * main section, performs core flows and fails on console errors or 5xx.
 *
 *   BASE_URL=http://localhost:3000 E2E_EMAIL=you@example.com E2E_PASSWORD=... node tests/e2e/smoke.mjs
 *
 * Requires ALLOW_SIGNUP=true (or an empty database) when no credentials are given.
 * Set CHROMIUM_PATH if Chromium isn't at /opt/pw-browsers/chromium.
 */
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? `e2e-${Date.now()}@example.test`;
const password = process.env.E2E_PASSWORD ?? "e2e-password-123";
const mobile = process.argv.includes("--mobile");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().includes("hydrated") && problems.push(`console: ${m.text().slice(0, 200)}`));
page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    problems.push(`${name}: ${err.message.split("\n")[0]}`);
    console.log(`✗ ${name}`);
  }
}

await step("sign in / sign up", async () => {
  if (process.env.E2E_EMAIL) {
    await page.goto(`${base}/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  } else {
    await page.goto(`${base}/signup`);
    await page.fill('input[name="name"]', "E2E Artist");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirm"]', password);
    await page.click('button[type="submit"]');
  }
  await page.waitForURL(/dashboard|onboarding/, { timeout: 30000 });
});

await step("onboarding answers persist", async () => {
  await page.goto(`${base}/onboarding?step=identity`);
  await page.fill('textarea[name$="__bio"]', "E2E biography.");
  await page.click('button:has-text("Save & continue")');
  await page.waitForURL(/step=goals/, { timeout: 30000 });
  await page.goto(`${base}/profile`);
  await page.waitForSelector("text=E2E biography.");
});

await step("create track", async () => {
  await page.goto(`${base}/catalog/new`);
  await page.fill('input[name="title"]', "E2E Track");
  await page.click('button:has-text("Create track")');
  await page.waitForURL(/catalog\/[0-9a-f-]{36}/, { timeout: 30000 });
});

await step("create release and see only missing questions", async () => {
  await page.goto(`${base}/releases/new`);
  await page.locator('input[name="trackIds"]').first().check();
  await page.fill("#rel-title", "E2E Release");
  await page.click('button:has-text("Create release")');
  await page.waitForURL(/questions/, { timeout: 30000 });
  await page.waitForSelector("text=reused");
});

await step("create task", async () => {
  await page.goto(`${base}/tasks/new`);
  await page.fill('input[name="title"]', "E2E task");
  await page.click('button:has-text("Create task")');
  await page.waitForURL(/tasks\/[0-9a-f-]{36}/, { timeout: 30000 });
});

const pages = [
  "/dashboard", "/assistant", "/information", "/profile", "/business", "/workflow", "/workflow/foundation", "/catalog", "/releases",
  "/releases?view=month", "/rights", "/marketing", "/marketing/new", "/content", "/planner", "/analytics", "/finances", "/finances?tab=ledger",
  "/contacts", "/contacts?view=pipeline", "/tasks", "/tasks?view=kanban", "/tasks?view=timeline", "/tasks/projects", "/documents", "/automations",
  "/reports", "/reports/finance", "/reports/quarterly", "/settings", "/settings/integrations", "/settings/ai", "/settings/data", "/settings/security",
  "/search?q=e2e", "/notifications",
];
for (const p of pages) {
  await step(`page ${p}`, async () => {
    const res = await page.goto(`${base}${p}`);
    if (!res || res.status() >= 400) throw new Error(`status ${res?.status()}`);
    await page.waitForSelector("main h1", { timeout: 30000 });
    if (mobile) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) throw new Error(`horizontal overflow ${overflow}px`);
    }
  });
}

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
