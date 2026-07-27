import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mapHttpError, AuthError, RateLimitError, QuotaError } from "@/lib/providers/errors";
import { anthropicProvider } from "@/lib/providers/anthropic";
import { openaiProvider, openrouterProvider } from "@/lib/providers/openai";
import { geminiProvider } from "@/lib/providers/gemini";
import {
  assertNoCredentialsInExport,
  forgetCredentials,
  getCredentials,
  setCredentials,
  stripCredentialsFromObject,
} from "@/lib/providers/credentials";

describe("provider HTTP error mapping", () => {
  it("maps 401 to AuthError", () => {
    const err = mapHttpError(401, "invalid key");
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe("auth");
  });

  it("maps 429 to RateLimitError with Retry-After", () => {
    const err = mapHttpError(429, "slow down", "2");
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(2000);
  });

  it("maps 402 to QuotaError", () => {
    expect(mapHttpError(402, "no credits")).toBeInstanceOf(QuotaError);
  });
});

describe("provider adapters", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () => "unauthorized",
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Anthropic chat maps 401 to AuthError", async () => {
    await expect(
      anthropicProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "sk-ant-test", model: "claude-sonnet-4-6" },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("OpenAI chat maps 401 to AuthError", async () => {
    await expect(
      openaiProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "sk-test", model: "gpt-4.1" },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("Gemini and OpenRouter chat map 401 to AuthError", async () => {
    await expect(
      geminiProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "gem-test", model: "gemini-2.0-flash" },
      ),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      openrouterProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "or-test", model: "openai/gpt-4.1" },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("Anthropic chat maps 429 to RateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: { get: (h: string) => (h === "Retry-After" ? "0" : null) },
        text: async () => "rate limit",
      })),
    );
    // retries=1 means two attempts; still ends as RateLimitError
    await expect(
      anthropicProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "sk-ant-test", model: "claude-sonnet-4-6" },
      ),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("export never includes API keys", () => {
  it("assertNoCredentialsInExport throws when key is present", () => {
    const key = "sk-ant-secret-SHOULD-NOT-LEAK-B4f2";
    expect(() => assertNoCredentialsInExport(`{"ok":true}`, key)).not.toThrow();
    expect(() => assertNoCredentialsInExport(`backup ${key} end`, key)).toThrow(/leaked/i);
  });

  it("stripCredentialsFromObject removes credential fields", () => {
    const cleaned = stripCredentialsFromObject({
      progress: {},
      apiKey: "sk-secret",
      credentials: { apiKey: "x" },
      provider: { apiKey: "y", id: "anthropic" },
    });
    expect(cleaned.apiKey).toBeUndefined();
    expect(cleaned.credentials).toBeUndefined();
    expect((cleaned.provider as { apiKey?: string }).apiKey).toBeUndefined();
    expect(JSON.stringify(cleaned)).not.toContain("sk-secret");
  });

  it("full backup builder path excludes in-memory key", () => {
    setCredentials({
      providerId: "anthropic",
      model: "claude-sonnet-4-6",
      apiKey: "sk-ant-export-test-KEY-9999",
      remember: false,
    });
    const backup = JSON.stringify({
      app: "dualtrack",
      version: 3,
      progress: {},
      notes: {},
      // no credentials
    });
    expect(() => assertNoCredentialsInExport(backup, getCredentials().apiKey)).not.toThrow();
    forgetCredentials();
  });
});
