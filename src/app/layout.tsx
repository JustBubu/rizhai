import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plex = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "日摘 — 把 SVN 备注收成钉钉日志",
  description: "一次拉取多个 SVN 仓库的提交备注，整理成可以复制或提交到钉钉的每日日志。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <Suspense fallback={<div className="h-14 border-b border-border bg-card" />}>
          <SiteHeader />
        </Suspense>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
