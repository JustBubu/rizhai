"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import {
  htmlLang,
  isLocale,
  LOCALE_STORAGE_KEY,
  remapDefaultSectionTitles,
  t as translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import type { SettingsPublic } from "@/lib/types";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function LocaleProvider({
  children,
  initialLocale = "zh",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? initialLocale);

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    void api<{ settings: SettingsPublic }>("/api/settings")
      .then((data) => {
        if (cancelled || !isLocale(data.settings.locale)) return;
        setLocaleState(data.settings.locale);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.lang = htmlLang(next);
    try {
      const current = await api<{ settings: SettingsPublic }>("/api/settings");
      const sections = remapDefaultSectionTitles(current.settings.sections, next);
      const templateName =
        current.settings.dingtalk.templateName === "日报" && next === "en"
          ? "Daily report"
          : current.settings.dingtalk.templateName === "Daily report" && next === "zh"
            ? "日报"
            : current.settings.dingtalk.templateName;
      const data = await api<{ settings: SettingsPublic }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...current.settings,
          locale: next,
          sections,
          dingtalk: { ...current.settings.dingtalk, templateName },
        }),
      });
      window.dispatchEvent(new CustomEvent("rizhai:settings", { detail: data.settings }));
    } catch {
      // UI language still switches even if persist fails
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
