import type { Repo, RepoPublic, Settings, SettingsPublic } from "@/lib/types";

export function toPublicRepo(repo: Repo): RepoPublic {
  return {
    id: repo.id,
    name: repo.name,
    url: repo.url,
    username: repo.username,
    useSavedAuth: repo.useSavedAuth,
    enabled: repo.enabled,
    hasPassword: repo.password.length > 0,
  };
}

export function toPublicSettings(settings: Settings): SettingsPublic {
  const { appSecret, webhookSecret, ...rest } = settings.dingtalk;
  return {
    ...settings,
    dingtalk: {
      ...rest,
      hasAppSecret: appSecret.length > 0,
      hasWebhookSecret: webhookSecret.length > 0,
    },
  };
}
