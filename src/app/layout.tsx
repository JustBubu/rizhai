import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { isLocale } from "@/lib/i18n";
import { loadSettings } from "@/lib/store";
import "./globals.css";

const plex = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rizhai — SVN notes to DingTalk daily log",
  description: "Pull commit notes from multiple SVN repos into a DingTalk-ready daily report.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let initialLocale: "zh" | "en" = "zh";
  try {
    const settings = await loadSettings();
    if (isLocale(settings.locale)) initialLocale = settings.locale;
  } catch {
    // use default
  }

  return (
    <html lang={initialLocale === "zh" ? "zh-CN" : "en"} className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <LocaleProvider initialLocale={initialLocale}>
          <Suspense fallback={<div className="h-14 border-b border-border bg-card" />}>
            <SiteHeader />
          </Suspense>
          {children}
          <Toaster position="top-center" />
        </LocaleProvider>
      </body>
    </html>
  );
}
