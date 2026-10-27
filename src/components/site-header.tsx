"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "今天" },
  { href: "/settings", label: "设置" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-primary font-serif text-[15px] text-primary-foreground">
            摘
          </span>
          <span className="font-serif text-lg leading-none tracking-wide">日摘</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            把 SVN 备注收成钉钉日志
          </span>
        </Link>
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
    </header>
  );
}
