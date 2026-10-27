export type Repo = {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  useSavedAuth: boolean;
  enabled: boolean;
};

export type RepoPublic = {
  id: string;
  name: string;
  url: string;
  username: string;
  useSavedAuth: boolean;
  enabled: boolean;
  hasPassword: boolean;
};

export type LogSection = {
  id: string;
  title: string;
  /** generated 栏由提交备注填入；manual 栏留给自己写 */
  role: "generated" | "manual";
};

export type DingField = {
  fieldName: string;
  sort: number;
  type: number;
};

export type FieldBinding =
  | { mode: "section"; sectionId: string }
  | { mode: "none" }
  | { mode: "custom"; text: string };

export type DingTalkSettings = {
  appKey: string;
  appSecret: string;
  userId: string;
  templateName: string;
  templateId: string;
  fields: DingField[];
  bindings: Record<string, FieldBinding>;
  toChat: boolean;
  webhook: string;
  webhookSecret: string;
  webhookKeyword: string;
};

export type Settings = {
  locale: "zh" | "en";
  myAuthors: string[];
  timezone: string;
  includeRevision: boolean;
  showEmptyRepos: boolean;
  logMode: "personal" | "team";
  onlyMine: boolean;
  sections: LogSection[];
  dingtalk: DingTalkSettings;
};

export type SettingsPublic = Omit<Settings, "dingtalk"> & {
  dingtalk: Omit<DingTalkSettings, "appSecret" | "webhookSecret"> & {
    hasAppSecret: boolean;
    hasWebhookSecret: boolean;
  };
};

export type CommitPath = {
  action: string;
  path: string;
};

export type Commit = {
  revision: string;
  author: string;
  date: string;
  message: string;
  paths: CommitPath[];
};

export type RepoLog = {
  repoId: string;
  name: string;
  url: string;
  ok: boolean;
  error?: string;
  commits: Commit[];
  elapsedMs: number;
  source: "svn" | "paste";
};

export type Draft = {
  date: string;
  bodies: Record<string, string>;
  excluded: string[];
  /** 最近一次自动填入「今日完成」的原文，用来判断有没有被手改过 */
  lastGenerated: string;
  updatedAt: string;
};

export type LogFetchResult = {
  date: string;
  fetchedAt: string;
  repos: RepoLog[];
};
