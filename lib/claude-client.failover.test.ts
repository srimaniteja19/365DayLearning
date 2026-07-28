import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AuthError, RateLimitError } from "@/lib/providers/errors";
import { chat, clearSessionPreferredModel } from "@/lib/claude-client";
import { setCredentials, forgetCredentials } from "@/lib/providers/credentials";

describe("chat model failover", () => {
  beforeEach(() => {
    clearSessionPreferredModel();
    forgetCredentials();
    setCredentials({
      apiKey: "sk-or-test",
      model: "openrouter/free",
      remember: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSessionPreferredModel();
    forgetCredentials();
  });

  it("falls through free daily cap to a paid model", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}")) as { model?: string };
        const model = body.model || "";
        calls.push(model);
        if (model.endsWith(":free") || model === "openrouter/free") {
          return {
            ok: false,
            status: 429,
            headers: { get: () => null },
            text: async () =>
              JSON.stringify({
                error: {
                  message: "Rate limit exceeded: free-models-per-day. Add 10 credits",
                  code: 429,
                },
              }),
            clone() {
              return this;
            },
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () =>
            JSON.stringify({
              choices: [{ message: { content: "ok-from-paid" } }],
            }),
          clone() {
            return this;
          },
        };
      }),
    );

    const text = await chat({ prompt: "hi", maxTokens: 5 });
    expect(text).toBe("ok-from-paid");
    expect(calls[0]).toBe("openrouter/free");
    // After free-models-per-day, remaining free models are skipped.
    expect(calls.filter((m) => m.endsWith(":free") || m === "openrouter/free")).toHaveLength(1);
    expect(calls.some((m) => m === "deepseek/deepseek-v4-flash")).toBe(true);
  });

  it("does not failover on auth errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () => "unauthorized",
        clone() {
          return this;
        },
      })),
    );

    await expect(chat({ prompt: "hi", maxTokens: 5 })).rejects.toBeInstanceOf(AuthError);
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });
});
