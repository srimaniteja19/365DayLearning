import { describe, expect, it } from "vitest";
import { newTelemetry } from "@/lib/generationTelemetry";

describe("newTelemetry", () => {
  it("starts with zero repair calls and no model outcomes", () => {
    const t = newTelemetry();
    expect(t.repairCalls).toBe(0);
    expect(t.modelOutcomes).toEqual({});
  });
});
