import type { Metadata, Viewport } from "next";
import {
  Syne,
  Fraunces,
  Bricolage_Grotesque,
  Instrument_Serif,
  Recursive,
  Fragment_Mono,
  Young_Serif,
  Besley,
  Oxanium,
  Bodoni_Moda,
} from "next/font/google";
import "./globals.css";
import "./dualtrack.css";
import { Providers } from "./providers";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

const recursive = Recursive({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-recursive",
  display: "swap",
});

const fragment = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fragment",
  display: "swap",
});

const young = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-young",
  display: "swap",
});

const besley = Besley({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-besley",
  display: "swap",
});

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oxanium",
  display: "swap",
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bodoni",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian | Daily Learning Campaigns",
  description:
    "Meridian — multi-plan learning campaigns with spaced repetition, notes, custom roadmaps, and bring-your-own-key AI.",
  applicationName: "Meridian",
  keywords: [
    "learning",
    "engineering",
    "AI",
    "systems",
    "spaced repetition",
    "365 day challenge",
    "roadmap",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0C1116",
  width: "device-width",
  initialScale: 1,
};

const fontVars = [
  syne.variable,
  fraunces.variable,
  bricolage.variable,
  instrument.variable,
  recursive.variable,
  fragment.variable,
  young.variable,
  besley.variable,
  oxanium.variable,
  bodoni.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
