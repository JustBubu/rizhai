"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const links = [
    { href: "/", label: t("navToday") },
    { href: "/settings", label: t("navSettings") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-primary font-serif text-[15px] text-primary-foreground">
            {t("brandMark")}
          </span>
          <span className="font-serif text-lg leading-none tracking-wide">{t("brand")}</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">{t("tagline")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label={t("language")}>
            {LOCALES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 text-xs sm:text-sm",
                  locale === item.value ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => {
                  if (item.value !== locale) void setLocale(item.value as Locale);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5",
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
