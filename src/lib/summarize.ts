import type { Commit, LogSection, RepoLog } from "@/lib/types";

export function commitKey(repoId: string, revision: string): string {
  return `${repoId}:${revision}`;
}

export function actionLabel(action: string): string {
  switch (action) {
    case "A":
      return "新增";
    case "D":
      return "删除";
    case "R":
      return "替换";
    case "M":
      return "修改";
    default:
      return action || "改动";
  }
}

export type SummaryOptions = {
  mode: "personal" | "team";
  onlyMine: boolean;
  myAuthors: string[];
  includeRevision: boolean;
  showEmptyRepos: boolean;
  excluded: Set<string>;
};

export function matchesAuthor(author: string, authors: string[]): boolean {
  const folded = author.trim().toLowerCase();
  return authors.some((item) => item.trim().toLowerCase() === folded);
}

export function visibleCommits(repo: RepoLog, options: SummaryOptions): Commit[] {
  return repo.commits.filter((commit) => {
    if (options.excluded.has(commitKey(repo.repoId, commit.revision))) return false;
    if (!options.onlyMine || options.myAuthors.length === 0) return true;
    return matchesAuthor(commit.author, options.myAuthors);
  });
}

function bullet(commit: Commit, options: SummaryOptions): string {
  const normalized = commit.message.replace(/\r\n/g, "\n").trim();
  const [first, ...rest] = (normalized || "（这条提交没有写备注）").split("\n");
  const revision = options.includeRevision ? `（r${commit.revision}）` : "";
  const who = options.mode === "team" ? `${commit.author}：` : "";
  const lines = [`- ${who}${first.trim()}${revision}`];
  for (const line of rest) {
    const trimmed = line.trim();
    if (trimmed) lines.push(`  ${trimmed}`);
  }
  return lines.join("\n");
}

export function buildTodayWork(repos: RepoLog[], options: SummaryOptions): string {
  const blocks: string[] = [];

  for (const repo of repos) {
    if (!repo.ok) {
      blocks.push(`【${repo.name}】拉取失败：${repo.error || "未知原因"}`);
      continue;
    }
    const commits = visibleCommits(repo, options);
    if (commits.length === 0) {
      if (options.showEmptyRepos) blocks.push(`【${repo.name}】今日无提交`);
      continue;
    }
    const lines = [`【${repo.name}】`, ...commits.map((commit) => bullet(commit, options))];
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n").trim();
}

export function composeFullLog(
  sections: LogSection[],
  bodies: Record<string, string>,
): string {
  return sections
    .map((section) => {
      const body = bodies[section.id]?.trim() || "无";
      return `${section.title}\n${body}`;
    })
    .join("\n\n");
}

export function countChars(value: string): number {
  return Array.from(value).length;
}

export function repoHost(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return "本机仓库";
    return parsed.host || url;
  } catch {
    return url;
  }
}
