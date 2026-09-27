import "server-only";

/** AI configuration comes only from server-side environment variables. */
export function aiConfig() {
  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  return {
    provider,
    model: process.env.AI_MODEL?.trim() || "claude-opus-5",
    configured: provider === "anthropic" && Boolean(apiKey),
    fallbacks: (process.env.AI_REFUSAL_FALLBACK ?? "default") !== "off",
    dailyLimit: Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 200),
    priceIn: Number(process.env.AI_PRICE_INPUT_PER_MTOK ?? 0) || null,
    priceOut: Number(process.env.AI_PRICE_OUTPUT_PER_MTOK ?? 0) || null,
  };
}
