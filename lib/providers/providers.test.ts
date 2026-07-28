import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mapHttpError, AuthError, RateLimitError, QuotaError } from "@/lib/providers/errors";
import { openrouterProvider } from "@/lib/providers/openrouter";
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

  it("maps OpenRouter free-models-per-day into actionable copy", () => {
    const body = JSON.stringify({
      error: {
        message:
          "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
        code: 429,
        metadata: {
          headers: {
            "X-RateLimit-Limit": "50",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1785283200",
          },
        },
      },
    });
    const err = mapHttpError(429, body);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.message).toMatch(/free-model daily limit/i);
    expect(err.message).toMatch(/Paid model/i);
    expect((err as RateLimitError).retryAfterMs).toBeGreaterThan(0);
  });

  it("maps 402 to QuotaError", () => {
    expect(mapHttpError(402, "no credits")).toBeInstanceOf(QuotaError);
  });
});

describe("OpenRouter provider", () => {
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

  it("maps 401 to AuthError", async () => {
    await expect(
      openrouterProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "sk-or-test", model: "anthropic/claude-sonnet-5" },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 429 to RateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: { get: (h: string) => (h === "Retry-After" ? "0" : null) },
        text: async () => "rate limit",
        clone: function clone() {
          return this;
        },
      })),
    );
    await expect(
      openrouterProvider.chat(
        { prompt: "hi", maxTokens: 5 },
        { apiKey: "sk-or-test", model: "anthropic/claude-sonnet-5" },
      ),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("export never includes API keys", () => {
  it("assertNoCredentialsInExport throws when key is present", () => {
    const key = "sk-or-secret-SHOULD-NOT-LEAK-B4f2";
    expect(() => assertNoCredentialsInExport(`{"ok":true}`, key)).not.toThrow();
    expect(() => assertNoCredentialsInExport(`backup ${key} end`, key)).toThrow(/leaked/i);
  });

  it("stripCredentialsFromObject removes credential fields", () => {
    const cleaned = stripCredentialsFromObject({
      progress: {},
      apiKey: "sk-secret",
      credentials: { apiKey: "x" },
      provider: { apiKey: "y", id: "openrouter" },
    });
    expect(cleaned.apiKey).toBeUndefined();
    expect(cleaned.credentials).toBeUndefined();
    expect((cleaned.provider as { apiKey?: string }).apiKey).toBeUndefined();
    expect(JSON.stringify(cleaned)).not.toContain("sk-secret");
  });

  it("full backup builder path excludes in-memory key", () => {
    setCredentials({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-5",
      apiKey: "sk-or-export-test-KEY-9999",
      remember: false,
    });
    const backup = JSON.stringify({
      app: "dualtrack",
      version: 3,
      progress: {},
      notes: {},
    });
    expect(() => assertNoCredentialsInExport(backup, getCredentials().apiKey)).not.toThrow();
    forgetCredentials();
  });
});
