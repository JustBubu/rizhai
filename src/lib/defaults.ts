import { DEFAULT_SECTION_TITLES, type Locale, type MessageKey } from "@/lib/i18n";
import type { DingTalkSettings, Settings } from "@/lib/types";

export const DEFAULT_DINGTALK: DingTalkSettings = {
  appKey: "",
  appSecret: "",
  userId: "",
  templateName: "日报",
  templateId: "",
  fields: [],
  bindings: {},
  toChat: false,
  webhook: "",
  webhookSecret: "",
  webhookKeyword: "",
};

export const DEFAULT_SETTINGS: Settings = {
  locale: "zh",
  myAuthors: [],
  timezone: "+08:00",
  includeRevision: true,
  showEmptyRepos: true,
  logMode: "personal",
  onlyMine: false,
  sections: DEFAULT_SECTION_TITLES.zh,
  dingtalk: DEFAULT_DINGTALK,
};

export function mergeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const dingtalk = { ...DEFAULT_DINGTALK, ...raw?.dingtalk };
  const locale: Locale = raw?.locale === "en" ? "en" : "zh";
  const sections =
    raw?.sections && raw.sections.length > 0 ? raw.sections : DEFAULT_SECTION_TITLES[locale];
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    locale,
    myAuthors: Array.isArray(raw?.myAuthors) ? raw.myAuthors : [],
    sections,
    dingtalk,
  };
}

export function timezoneOptions(_locale: Locale): { value: string; key: MessageKey }[] {
  return [
    { value: "+08:00", key: "tzChina" },
    { value: "+09:00", key: "tzJapan" },
    { value: "+07:00", key: "tzSea" },
    { value: "+05:30", key: "tzIndia" },
    { value: "+00:00", key: "tzUtc" },
    { value: "-08:00", key: "tzUs" },
  ];
}

/** @deprecated use timezoneOptions(locale) */
export const TIMEZONES = [
  { value: "+08:00", label: "中国（UTC+8）" },
  { value: "+09:00", label: "日本 / 韩国（UTC+9）" },
  { value: "+07:00", label: "泰国 / 越南（UTC+7）" },
  { value: "+05:30", label: "印度（UTC+5:30）" },
  { value: "+00:00", label: "UTC" },
  { value: "-08:00", label: "美国太平洋（UTC-8）" },
] as const;
