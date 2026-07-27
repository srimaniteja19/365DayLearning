import type { Metadata, Viewport } from "next";
import {
  Inter,
  JetBrains_Mono,
  Source_Serif_4,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import "./dualtrack.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jetbrains",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DualTrack Console | 365-Day Learning",
  description:
    "Dual-track learning console: 365-day full-stack & systems campaign plus a 45-day AI/LLM engineering sprint, with spaced repetition, notes, and progress tracking.",
  applicationName: "DualTrack Console",
  keywords: [
    "learning",
    "engineering",
    "AI",
    "systems",
    "spaced repetition",
    "365 day challenge",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0C1116",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
