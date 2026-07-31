import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_ORDER,
  themeVars,
  resolveThemeKey,
  DEFAULT_THEME_KEY,
  LANDING_THEME,
} from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_ORDER,
  FONT_PACKS,
  fontVars,
  resolveFontKey,
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
  it("ships eleven themes in THEME_ORDER", () => {
    expect(THEME_ORDER).toHaveLength(11);
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

  it("maps retired theme keys to the new set", () => {
    expect(resolveThemeKey("bloom")).toBe("signal");
    expect(resolveThemeKey("ledger")).toBe("folio");
    expect(resolveThemeKey("matte")).toBe("afterburn");
    expect(resolveThemeKey("unknown")).toBe(DEFAULT_THEME_KEY);
    expect(resolveThemeKey("ion")).toBe("ion");
  });

  it("Folio is light with effects off", () => {
    const t = THEMES.folio;
    expect(t.mode).toBe("light");
    expect(t.effects).toBe(false);
    const vars = themeVars(t) as Record<string, string>;
    expect(vars["--overlay"]).toMatch(/rgba\(30/);
    expect(vars["--glow"]).toBe("transparent");
    expect(vars["--accent"]).toBe(t.accents.main);
  });

  it("Oxide is dark muted with effects off", () => {
    const t = THEMES.oxide;
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

describe("LANDING_THEME (marketing neo)", () => {
  it("uses neobrutalism yellow / violet / surface / ink", () => {
    expect(LANDING_THEME.mode).toBe("light");
    expect(LANDING_THEME.c.bg).toBe("#FBFBF9");
    expect(LANDING_THEME.c.panel).toBe("#FBFBF9");
    expect(LANDING_THEME.c.text).toBe("#1C293C");
    expect(LANDING_THEME.accents.main).toBe("#FDC800");
    expect(LANDING_THEME.accents.sprint).toBe("#432DD7");
    expect(LANDING_THEME.c.onAccent).toBe("#1C293C");
    expect(LANDING_THEME.c.ok).toBe("#16A34A");
    expect(LANDING_THEME.c.warn).toBe("#D97706");
    expect(LANDING_THEME.c.err).toBe("#DC2626");
    expect(LANDING_THEME.radius.card).toBe("0px");
    expect(LANDING_THEME.radius.ctl).toBe("0px");
  });

  it("is the default dashboard theme (key doodle → Neo skin)", () => {
    expect(DEFAULT_THEME_KEY).toBe("doodle");
    expect(THEMES.doodle).toBe(LANDING_THEME);
    expect(THEMES.doodle.name).toBe("Neo");
    expect(THEMES.doodle.mode).toBe("light");
    expect(THEMES.doodle.accents.main).toBe("#FDC800");
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

  it("maps retired font keys to the new set", () => {
    expect(resolveFontKey("bricolage")).toBe("host");
    expect(resolveFontKey("syne")).toBe("space");
    expect(resolveFontKey("fragment")).toBe("jetbrains");
    expect(resolveFontKey("unknown")).toBe(DEFAULT_FONT_KEY);
    expect(resolveFontKey("sora")).toBe("sora");
  });

  it("avoids Inter / Roboto / system-ui stacks", () => {
    const joined = FONT_ORDER.map((k) => JSON.stringify(FONT_PACKS[k])).join(" ");
    expect(joined).not.toMatch(/Inter|Roboto|Open Sans|Montserrat|Poppins|system-ui|Arial/i);
  });
});
