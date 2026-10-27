import { t, type Locale } from "./i18n.ts";
import type { Commit, LogSection, RepoLog } from "./types.ts";

export function commitKey(repoId: string, revision: string): string {
  return `${repoId}:${revision}`;
}

export function actionLabel(action: string, locale: Locale = "zh"): string {
  switch (action) {
    case "A":
      return t(locale, "actionA");
    case "D":
      return t(locale, "actionD");
    case "R":
      return t(locale, "actionR");
    case "M":
      return t(locale, "actionM");
    default:
      return action || t(locale, "actionOther");
  }
}

export type SummaryOptions = {
  mode: "personal" | "team";
  onlyMine: boolean;
  myAuthors: string[];
  includeRevision: boolean;
  showEmptyRepos: boolean;
  excluded: Set<string>;
  locale?: Locale;
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
  const locale = options.locale ?? "zh";
  const normalized = commit.message.replace(/\r\n/g, "\n").trim();
  const [first, ...rest] = (normalized || t(locale, "emptyCommitMsg")).split("\n");
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
  const locale = options.locale ?? "zh";
  const blocks: string[] = [];

  for (const repo of repos) {
    if (!repo.ok) {
      blocks.push(
        `【${repo.name}】${t(locale, "fetchFailed", { error: repo.error || t(locale, "unknownError") })}`,
      );
      continue;
    }
    const commits = visibleCommits(repo, options);
    if (commits.length === 0) {
      if (options.showEmptyRepos) blocks.push(`【${repo.name}】${t(locale, "noCommitsLine")}`);
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
  locale: Locale = "zh",
): string {
  const empty = t(locale, "none");
  return sections
    .map((section) => {
      const body = bodies[section.id]?.trim() || empty;
      return `${section.title}\n${body}`;
    })
    .join("\n\n");
}

export function countChars(value: string): number {
  return Array.from(value).length;
}

export function repoHost(url: string, locale: Locale = "zh"): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return t(locale, "localRepo");
    return parsed.host || url;
  } catch {
    return url;
  }
}
