import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setStoreEnv() {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
}

describe("httpGuard rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.doUnmock("@upstash/redis");
    vi.doUnmock("@upstash/ratelimit");
  });

  describe("fallback (no store configured)", () => {
    it("allows requests under the max", async () => {
      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
    });

    it("blocks once max is reached within the window", async () => {
      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("k2", 2, 60_000);
      await isRateLimited("k2", 2, 60_000);
      expect(await isRateLimited("k2", 2, 60_000)).toBe(true);
    });

    it("allows again after the window elapses", async () => {
      vi.useFakeTimers();
      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("k3", 1, 1_000);
      expect(await isRateLimited("k3", 1, 1_000)).toBe(true);
      vi.advanceTimersByTime(1_001);
      expect(await isRateLimited("k3", 1, 1_000)).toBe(false);
      vi.useRealTimers();
    });
  });

  describe("Upstash-backed store", () => {
    it("delegates to a Ratelimit instance when the store is configured", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: true });
      const slidingWindowMock = vi.fn().mockReturnValue("sliding-window-config");
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(function () { return { limit: limitMock }; }),
          { slidingWindow: slidingWindowMock },
        ),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k4", 5, 60_000)).toBe(false);
      expect(slidingWindowMock).toHaveBeenCalledWith(5, "60000 ms");
      expect(limitMock).toHaveBeenCalledWith("k4");
    });

    it("reuses the same Ratelimit instance for repeated calls with the same max/window", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: true });
      const RatelimitCtor = vi.fn().mockImplementation(function () { return { limit: limitMock }; });
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(RatelimitCtor, { slidingWindow: vi.fn() }),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("a", 5, 60_000);
      await isRateLimited("b", 5, 60_000);
      expect(RatelimitCtor).toHaveBeenCalledTimes(1);
    });

    it("returns true (limited) when the store reports failure", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: false });
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(function () { return { limit: limitMock }; }),
          { slidingWindow: vi.fn() },
        ),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k5", 5, 60_000)).toBe(true);
    });

    it("fails open (not limited) if the store throws", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockRejectedValue(new Error("upstash down"));
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(function () { return { limit: limitMock }; }),
          { slidingWindow: vi.fn() },
        ),
      }));
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k6", 5, 60_000)).toBe(false);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe("hasRateLimitStore", () => {
    it("is false when env vars are absent", async () => {
      const { hasRateLimitStore } = await import("@/lib/httpGuard");
      expect(hasRateLimitStore()).toBe(false);
    });

    it("is true when both env vars are set", async () => {
      setStoreEnv();
      const { hasRateLimitStore } = await import("@/lib/httpGuard");
      expect(hasRateLimitStore()).toBe(true);
    });
  });
});
