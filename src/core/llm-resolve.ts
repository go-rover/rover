/**
 * Resolve OpenAI-compatible LLM endpoint + API key from environment with minimal friction.
 * Works for self-hosted (.env / rover.config) and managed (platform sets any supported var).
 *
 * Priority:
 * 1. LLM_BASE_URL set → custom / local; key = first of LLM_API_KEY, OPENROUTER_*, OPENAI_*, GOOGLE_*, GEMINI_*, GROQ_*.
 * 2. Else provider-specific keys (unambiguous): OPENROUTER → OpenRouter, OPENAI → OpenAI, GROQ → Groq, GOOGLE/GEMINI → Gemini OpenAI-compat.
 * 3. Else LLM_API_KEY only → heuristic prefix (sk-or-* OpenRouter, sk-proj-/sk-svcacct- OpenAI, gsk_ Groq), else legacy default OpenRouter.
 */

function t(v: string | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

function firstKey(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const s = t(c);
    if (s) return s;
  }
  return "";
}

function isLocalOpenAiBase(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export type ResolvedLlm = {
  baseURL: string;
  apiKey: string;
  /** Short label for logs (no secrets) */
  provider: string;
};

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENAI_BASE = "https://api.openai.com/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

function inferFromLlmApiKeyOnly(key: string): Omit<ResolvedLlm, "apiKey"> {
  const k = key.trim();
  if (/^sk-or-v1-/i.test(k) || /^sk-or-/i.test(k)) {
    return { baseURL: OPENROUTER_BASE, provider: "openrouter" };
  }
  if (/^sk-proj-/i.test(k) || /^sk-svcacct-/i.test(k)) {
    return { baseURL: OPENAI_BASE, provider: "openai" };
  }
  if (/^gsk_/i.test(k)) {
    return { baseURL: GROQ_BASE, provider: "groq" };
  }
  if (/^AIza/i.test(k)) {
    return { baseURL: GEMINI_OPENAI_BASE, provider: "gemini" };
  }
  // Backward compatible: historical default when only LLM_API_KEY was documented for OpenRouter
  return { baseURL: OPENROUTER_BASE, provider: "openrouter (default)" };
}

/**
 * Resolve LLM connection. Returns apiKey possibly empty only for misconfiguration;
 * callers should validate before chat.completions.
 */
export function resolveLlmConnection(): ResolvedLlm {
  const baseExplicit = t(process.env.LLM_BASE_URL);

  if (baseExplicit) {
    const apiKey = firstKey(
      process.env.LLM_API_KEY,
      process.env.OPENROUTER_API_KEY,
      process.env.OPENAI_API_KEY,
      process.env.GROQ_API_KEY,
      process.env.GOOGLE_API_KEY,
      process.env.GEMINI_API_KEY
    );
    const key =
      apiKey || (isLocalOpenAiBase(baseExplicit) ? t(process.env.LLM_API_KEY) || "lm-studio" : "");
    return {
      baseURL: baseExplicit.replace(/\/+$/, "") || baseExplicit,
      apiKey: key,
      provider: isLocalOpenAiBase(baseExplicit) ? "local-openai-compat" : "custom",
    };
  }

  const keyOr = t(process.env.OPENROUTER_API_KEY);
  if (keyOr) {
    return { baseURL: OPENROUTER_BASE, apiKey: keyOr, provider: "openrouter" };
  }

  const keyOai = t(process.env.OPENAI_API_KEY);
  if (keyOai) {
    return { baseURL: OPENAI_BASE, apiKey: keyOai, provider: "openai" };
  }

  const keyGroq = t(process.env.GROQ_API_KEY);
  if (keyGroq) {
    return { baseURL: GROQ_BASE, apiKey: keyGroq, provider: "groq" };
  }

  const keyGem = firstKey(process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY);
  if (keyGem) {
    return { baseURL: GEMINI_OPENAI_BASE, apiKey: keyGem, provider: "gemini" };
  }

  const keyLlm = t(process.env.LLM_API_KEY);
  if (keyLlm) {
    const inferred = inferFromLlmApiKeyOnly(keyLlm);
    return { baseURL: inferred.baseURL, apiKey: keyLlm, provider: inferred.provider };
  }

  return {
    baseURL: OPENROUTER_BASE,
    apiKey: "",
    provider: "unconfigured",
  };
}

/** One-line summary for startup logs (no API key material). */
export function formatLlmStartupSummary(): string {
  const r = resolveLlmConnection();
  let host: string;
  try {
    host = new URL(r.baseURL).host;
  } catch {
    host = r.baseURL;
  }
  const keyOk = r.apiKey ? "key=set" : "key=MISSING";
  return `${r.provider} · ${host} · ${keyOk}`;
}
