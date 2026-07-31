import { describe, expect, it, vi, afterEach } from "vitest";
import { logError } from "@/lib/logError";

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a single structured JSON line with route, context, message, and timestamp", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", new Error("boom"));
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.route).toBe("api/test");
    expect(parsed.context).toBe("doing thing");
    expect(parsed.message).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("stringifies non-Error values and omits stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", "plain string error");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("plain string error");
    expect(parsed.stack).toBeUndefined();
  });

  it("merges extra fields into the logged object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", new Error("boom"), { userId: "u1" });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.userId).toBe("u1");
  });
});
