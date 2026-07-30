import { describe, expect, it } from "vitest";
import { safeHref } from "@/lib/safeHref";

describe("safeHref", () => {
  it("allows http(s) and mailto", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
  });

  it("allows relative paths and anchors", () => {
    expect(safeHref("/privacy")).toBe("/privacy");
    expect(safeHref("#section")).toBe("#section");
    expect(safeHref("./docs")).toBe("./docs");
  });

  it("blocks dangerous schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHref("data:text/html;base64,xxxx")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects empty / unknown schemes", () => {
    expect(safeHref("")).toBeNull();
    expect(safeHref("   ")).toBeNull();
    expect(safeHref("ftp://files.example.com")).toBeNull();
  });
});
