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
  myAuthors: [],
  timezone: "+08:00",
  includeRevision: true,
  showEmptyRepos: true,
  logMode: "personal",
  onlyMine: false,
  sections: [
    { id: "done", title: "今日完成工作", role: "generated" },
    { id: "undo", title: "未完成工作", role: "manual" },
    { id: "coord", title: "需协调工作", role: "manual" },
    { id: "tomorrow", title: "明日计划", role: "manual" },
  ],
  dingtalk: DEFAULT_DINGTALK,
};

export function mergeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const dingtalk = { ...DEFAULT_DINGTALK, ...raw?.dingtalk };
  const sections =
    raw?.sections && raw.sections.length > 0 ? raw.sections : DEFAULT_SETTINGS.sections;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    myAuthors: Array.isArray(raw?.myAuthors) ? raw.myAuthors : [],
    sections,
    dingtalk,
  };
}

export const TIMEZONES = [
  { value: "+08:00", label: "中国（UTC+8）" },
  { value: "+09:00", label: "日本 / 韩国（UTC+9）" },
  { value: "+07:00", label: "泰国 / 越南（UTC+7）" },
  { value: "+05:30", label: "印度（UTC+5:30）" },
  { value: "+00:00", label: "UTC" },
  { value: "-08:00", label: "美国太平洋（UTC-8）" },
] as const;
