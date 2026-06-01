/**
 * The LLM-client seam. ALL model access goes through this interface so the
 * PROVIDER and MODEL are selectable per feature, never hardcoded app-wide — the
 * monetization plan's routing requirement.
 *
 * Two providers live behind one interface today: Google Gemini and Anthropic.
 * The active provider is auto-detected from which API key is present (Gemini is
 * preferred; override with AI_PROVIDER). Adding another provider means a new
 * LlmClient implementation here, not edits scattered across feature code.
 *
 * SERVER-ONLY: reads the provider API key and must never reach the client
 * bundle. Like the rest of the paid layer it degrades gracefully —
 * getLlmClient() returns null when no key is set, and callers answer 503
 * "not configured yet".
 */
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, type Content } from "@google/genai";
import { recordUsage } from "./usage";

/** Every billable AI capability. Each routes to its own model below. */
export type Feature = "answer-solve" | "explain" | "tutor" | "generate" | "parse-repair";

/** The model providers we know how to talk to. */
export type Provider = "gemini" | "anthropic";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CompleteOptions {
  feature: Feature;
  /** Identity for usage attribution (the Google subject id). */
  userKey: string;
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmClient {
  complete(opts: CompleteOptions): Promise<LlmResult>;
}

// ---- Provider selection ----------------------------------------------------
// Gemini accepts either env name (its SDK defaults to GEMINI_API_KEY; many
// setups use GOOGLE_GENERATIVE_AI_API_KEY) — honour both.
function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || undefined;
}
function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

/** The active provider, or null when no provider key is configured. An explicit
 *  AI_PROVIDER wins (when its key is present); otherwise Gemini is preferred,
 *  then Anthropic. */
export function activeProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "gemini" && geminiKey()) return "gemini";
  if (explicit === "anthropic" && anthropicKey()) return "anthropic";
  if (geminiKey()) return "gemini";
  if (anthropicKey()) return "anthropic";
  return null;
}

/** True when the AI layer has a usable provider key — mirrors Stripe's
 *  `configured` gate. */
export function isAiConfigured(): boolean {
  return activeProvider() !== null;
}

// ---- Per-feature model routing --------------------------------------------
// Each feature maps to a default model PER PROVIDER, overridable by env so the
// exact model string can change without a code change (providers reprice/rename
// over time). AI_MODEL_DEFAULT overrides all features; a per-feature env
// (e.g. AI_MODEL_SOLVE) overrides one. Override values are used verbatim, so a
// single env can point a feature at any provider's model id.
interface ModelRoute {
  env: string;
  gemini: string;
  anthropic: string;
}

const ROUTES: Record<Feature, ModelRoute> = {
  // Reasoning, not extraction → a capable-but-affordable mid-tier per provider.
  "answer-solve": { env: "AI_MODEL_SOLVE", gemini: "gemini-2.5-flash", anthropic: "claude-sonnet-4-5" },
  // User-facing quality, but cheap-first: explanations start on a budget model.
  explain: { env: "AI_MODEL_EXPLAIN", gemini: "gemini-2.5-flash-lite", anthropic: "claude-3-5-haiku-latest" },
  tutor: { env: "AI_MODEL_TUTOR", gemini: "gemini-2.5-flash", anthropic: "claude-sonnet-4-5" },
  generate: { env: "AI_MODEL_GENERATE", gemini: "gemini-2.5-flash", anthropic: "claude-sonnet-4-5" },
  // Structured JSON repair — reliability over eloquence → budget.
  "parse-repair": { env: "AI_MODEL_REPAIR", gemini: "gemini-2.5-flash-lite", anthropic: "claude-3-5-haiku-latest" },
};

export function modelFor(feature: Feature, provider: Provider): string {
  const r = ROUTES[feature];
  return process.env[r.env] || process.env.AI_MODEL_DEFAULT || r[provider];
}

// ---- Pricing (USD per million tokens) -------------------------------------
// Indicative rates, used only to ESTIMATE the cost we log. Matched by model
// family so a dated/suffixed id still resolves. More specific patterns first.
const PRICING: { match: RegExp; inPerM: number; outPerM: number }[] = [
  // Gemini 2.5
  { match: /flash-lite/i, inPerM: 0.1, outPerM: 0.4 },
  { match: /flash/i, inPerM: 0.3, outPerM: 2.5 },
  { match: /gemini.*pro/i, inPerM: 1.25, outPerM: 10 },
  // Anthropic Claude
  { match: /opus/i, inPerM: 5, outPerM: 25 },
  { match: /sonnet/i, inPerM: 3, outPerM: 15 },
  { match: /haiku/i, inPerM: 0.8, outPerM: 4 },
];

function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING.find((x) => x.match.test(model)) ?? { inPerM: 1, outPerM: 5 };
  return (inputTokens / 1e6) * p.inPerM + (outputTokens / 1e6) * p.outPerM;
}

// ---- Gemini ----------------------------------------------------------------
class GeminiClient implements LlmClient {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(opts: CompleteOptions): Promise<LlmResult> {
    const model = modelFor(opts.feature, "gemini");
    const contents: Content[] = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Our features want direct, low-temperature output, not extended reasoning,
    // so disable "thinking" to keep output predictable and cheap. Pro-tier
    // models require thinking, so leave it alone there.
    const disableThinking = !/pro/i.test(model);

    const res = await this.ai.models.generateContent({
      model,
      contents,
      config: {
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        temperature: opts.temperature ?? 0,
        maxOutputTokens: opts.maxTokens ?? 1024,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const text = (res.text ?? "").trim();
    const inputTokens = res.usageMetadata?.promptTokenCount ?? 0;
    // Gemini 2.5 bills "thinking" tokens at the output rate — count them so the
    // logged cost matches the bill.
    const outputTokens =
      (res.usageMetadata?.candidatesTokenCount ?? 0) +
      (res.usageMetadata?.thoughtsTokenCount ?? 0);
    const cost = costUsd(model, inputTokens, outputTokens);

    await recordUsage({
      userKey: opts.userKey,
      feature: opts.feature,
      model,
      inputTokens,
      outputTokens,
      costUsd: cost,
    });

    return { text, model, inputTokens, outputTokens, costUsd: cost };
  }
}

// ---- Anthropic (dormant alternative behind the same interface) -------------
class AnthropicClient implements LlmClient {
  private sdk: Anthropic;

  constructor(apiKey: string) {
    this.sdk = new Anthropic({ apiKey });
  }

  async complete(opts: CompleteOptions): Promise<LlmResult> {
    const model = modelFor(opts.feature, "anthropic");
    const res = await this.sdk.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const inputTokens = res.usage?.input_tokens ?? 0;
    const outputTokens = res.usage?.output_tokens ?? 0;
    const cost = costUsd(model, inputTokens, outputTokens);

    // Log every call (best-effort; never throws).
    await recordUsage({
      userKey: opts.userKey,
      feature: opts.feature,
      model,
      inputTokens,
      outputTokens,
      costUsd: cost,
    });

    return { text, model, inputTokens, outputTokens, costUsd: cost };
  }
}

/** The configured client for the active provider, or null when no key is set. */
export function getLlmClient(): LlmClient | null {
  const provider = activeProvider();
  if (provider === "gemini") return new GeminiClient(geminiKey()!);
  if (provider === "anthropic") return new AnthropicClient(anthropicKey()!);
  return null;
}
