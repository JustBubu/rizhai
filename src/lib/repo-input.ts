import { assertRepoUrl } from "@/lib/svn";
import type { Repo } from "@/lib/types";

export type RepoInput = {
  name?: unknown;
  url?: unknown;
  username?: unknown;
  password?: unknown;
  useSavedAuth?: unknown;
  enabled?: unknown;
};

function clean(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\r\n\0]/g, "").trim().slice(0, max);
}

export function repoFromInput(input: RepoInput, id: string, previous?: Repo): Repo {
  const name = clean(input.name, 40);
  const url = clean(input.url, 500);
  const username = clean(input.username, 80);
  const useSavedAuth = Boolean(input.useSavedAuth);
  if (!name) throw new Error("给仓库起个名字，比如「订单中心」。");
  assertRepoUrl(url);
  if (!useSavedAuth && !username) {
    throw new Error("填写 SVN 用户名，或勾选使用本机已保存的凭据。");
  }
  let password = previous?.password ?? "";
  if (typeof input.password === "string") password = input.password;
  if (!useSavedAuth && !password) {
    throw new Error("填写密码。密码只存在这台电脑的 data 目录里。");
  }
  return {
    id,
    name,
    url,
    username,
    password: useSavedAuth ? "" : password,
    useSavedAuth,
    enabled: input.enabled === undefined ? (previous?.enabled ?? true) : Boolean(input.enabled),
  };
}
