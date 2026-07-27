import { describe, expect, it } from "vitest";
import { THEMES, THEME_ORDER, themeVars } from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_ORDER,
  FONT_PACKS,
  fontVars,
} from "@/theme/fonts";
import type { ThemeKey } from "@/lib/types";

const REQUIRED_THEME_VARS = [
  "--bg",
  "--bg-panel",
  "--text",
  "--accent",
  "--accent-main",
  "--on-accent",
  "--overlay",
  "--border",
  "--err",
] as const;

describe("theme tokens", () => {
  it("ships all eight themes in THEME_ORDER", () => {
    expect(THEME_ORDER).toHaveLength(8);
    for (const key of THEME_ORDER) {
      expect(THEMES[key]).toBeTruthy();
    }
  });

  it("themeVars exposes accent + overlay for every theme", () => {
    for (const key of Object.keys(THEMES) as ThemeKey[]) {
      const vars = themeVars(THEMES[key]) as Record<string, string>;
      for (const name of REQUIRED_THEME_VARS) {
        expect(vars[name], `${key} missing ${name}`).toBeTruthy();
      }
    }
  });

  it("Ledger is light with effects off", () => {
    const t = THEMES.ledger;
    expect(t.mode).toBe("light");
    expect(t.effects).toBe(false);
    const vars = themeVars(t) as Record<string, string>;
    expect(vars["--overlay"]).toMatch(/rgba\(30/);
    expect(vars["--glow"]).toBe("transparent");
    expect(vars["--accent"]).toBe(t.accents.main);
  });

  it("Matte is dark muted with a single soft accent and no effects", () => {
    const t = THEMES.matte;
    expect(t.mode).toBe("dark");
    expect(t.palette).toBe("muted");
    expect(t.effects).toBe(false);
    const vars = themeVars(t) as Record<string, string>;
    expect(vars["--overlay"]).toMatch(/rgba\(0,\s*0,\s*0/);
    expect(vars["--glow"]).toBe("transparent");
    expect(vars["--accent"]).toBe(t.accents.main);
    expect(vars["--on-accent"]).toBe(t.c.onAccent);
  });
});

describe("font packs", () => {
  it("ships ten uncommon type voices that cover the whole UI", () => {
    expect(FONT_ORDER).toHaveLength(10);
    expect(FONT_PACKS[DEFAULT_FONT_KEY]).toBeTruthy();
    for (const key of FONT_ORDER) {
      const pack = FONT_PACKS[key];
      expect(pack.name).toBeTruthy();
      expect(pack.sans).toBe(pack.family);
      expect(pack.display).toBe(pack.family);
      expect(pack.mono).toBe(pack.family);
      expect(pack.family).toContain("var(--font-");
      const vars = fontVars(pack) as Record<string, string>;
      expect(vars["--sans"]).toBe(pack.family);
      expect(vars["--display"]).toBe(pack.family);
      expect(vars["--mono"]).toBe(pack.family);
    }
  });

  it("avoids Inter / Roboto / system-ui stacks", () => {
    const joined = FONT_ORDER.map((k) => JSON.stringify(FONT_PACKS[k])).join(" ");
    expect(joined).not.toMatch(/Inter|Roboto|Open Sans|Montserrat|Poppins|system-ui|Arial/i);
  });
});
