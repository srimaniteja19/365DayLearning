import type { Metadata, Viewport } from "next";
import {
  Space_Grotesk,
  Literata,
  JetBrains_Mono,
  Archivo,
  Newsreader,
  Space_Mono,
  Sora,
  Kalnia,
  Host_Grotesk,
  Red_Hat_Mono,
  Delius_Swash_Caps,
} from "next/font/google";
import "./globals.css";
import "./dualtrack.css";
import { Providers } from "./providers";

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-literata",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-newsreader",
  display: "swap",
});

const spacemono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-spacemono",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const kalnia = Kalnia({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kalnia",
  display: "swap",
});

const host = Host_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-host",
  display: "swap",
});

const redmono = Red_Hat_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-redmono",
  display: "swap",
});

const delius = Delius_Swash_Caps({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-delius",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Refrainly | Daily learning campaigns for any subject",
  description:
    "Refrainly is a daily learning campaign runner for any subject — psychology, economics, history, languages, tech, and more. Day-by-day plans, spaced repetition, Field Kit, and bring-your-own-key AI. Create a free account to start.",
  applicationName: "Refrainly",
  keywords: [
    "learning campaigns",
    "spaced repetition",
    "self-directed learning",
    "study plan",
    "psychology",
    "economics",
    "history",
    "bring your own AI key",
    "Field Kit",
    "365 day challenge",
  ],
  appleWebApp: {
    capable: true,
    title: "Refrainly",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF2F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1116" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const fontVars = [
  space.variable,
  literata.variable,
  jetbrains.variable,
  archivo.variable,
  newsreader.variable,
  spacemono.variable,
  sora.variable,
  kalnia.variable,
  host.variable,
  redmono.variable,
  delius.variable,
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
