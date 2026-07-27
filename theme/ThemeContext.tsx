"use client";

import { createContext, useContext } from "react";
import { DOMAIN_PALETTES, THEMES, type ThemeDef } from "@/theme/themes";

export type ThemeContextValue = {
  theme: ThemeDef;
  domainColors: Record<string, string>;
};

export const ThemeCtx = createContext<ThemeContextValue>({
  theme: THEMES.terminal,
  domainColors: DOMAIN_PALETTES.dark,
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function useDomainColor(domain: string): string {
  const { domainColors } = useContext(ThemeCtx);
  return domainColors[domain] || domainColors["systems-eng"] || "#94A3B8";
}
