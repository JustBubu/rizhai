"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/client";
import { calendarDate, dateInTimezone, formatLongDate } from "@/lib/dates";
import { parseSvnLog } from "@/lib/parse-svn";
import { sampleLogs } from "@/lib/sample";
import {
  buildTodayWork,
  commitKey,
  composeFullLog,
  matchesAuthor,
  type SummaryOptions,
} from "@/lib/summarize";
import type { Commit, Draft, LogFetchResult, RepoLog, RepoPublic, SettingsPublic } from "@/lib/types";

export type Panel = "repos" | "commits" | "log";
export type DialogMode = { kind: "create" } | { kind: "edit"; repo: RepoPublic };

export function useDigestApp(initialToday: string) {
  const [settings, setSettings] = useState<SettingsPublic | null>(null);
  const [repos, setRepos] = useState<RepoPublic[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [logs, setLogs] = useState<RepoLog[] | null>(null);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copying, setCopying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingGroup, setSendingGroup] = useState(false);
  const [panel, setPanel] = useState<Panel>("commits");
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [pasteRepo, setPasteRepo] = useState<RepoPublic | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RepoPublic | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [authorDraft, setAuthorDraft] = useState("");
  const ready = useRef(false);
  const date = pickedDate ?? (settings ? calendarDate(settings.timezone) : initialToday);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [repoData, settingsData] = await Promise.all([
          api<{ repos: RepoPublic[] }>("/api/repos"),
          api<{ settings: SettingsPublic }>("/api/settings"),
        ]);
        if (cancelled) return;
        setRepos(repoData.repos);
        setSettings(settingsData.settings);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "配置没有读出来");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    void (async () => {
      try {
        const data = await api<{ draft: Draft }>(`/api/drafts?date=${date}`);
        if (cancelled) return;
        setDraft(data.draft);
        ready.current = true;
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "这一天的草稿没有读出来");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    if (!draft || !ready.current) return;
    const handle = window.setTimeout(() => {
      void api("/api/drafts", { method: "PUT", body: JSON.stringify(draft) }).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "草稿没有保存");
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [draft]);

  const activeLogs = sample ? sampleLogs() : logDate === date ? (logs ?? []) : [];
  const hasMaterial = sample || (logDate === date && logs != null);

  function optionsFrom(current: SettingsPublic, excluded: string[]): SummaryOptions {
    return {
      mode: current.logMode,
      onlyMine: current.onlyMine,
      myAuthors: current.myAuthors,
      includeRevision: current.includeRevision,
      showEmptyRepos: current.showEmptyRepos,
      excluded: new Set(excluded),
    };
  }

  function writeGenerated(
    textFor: (excluded: string[]) => string,
    force: boolean,
    base?: Draft | null,
  ): boolean {
    const section = settings?.sections.find((item) => item.role === "generated");
    if (!section) {
      toast.error("设置里没有「由提交生成」的栏目。");
      return false;
    }
    let skipped = false;
    setDraft((current) => {
      const source = base ?? current;
      if (!source) return current;
      const body = source.bodies[section.id] ?? "";
      const untouched = body.trim() === "" || body === source.lastGenerated;
      if (!untouched && !force) {
        skipped = true;
        return source === current ? current : source;
      }
      const text = textFor(source.excluded);
      return {
        ...source,
        bodies: { ...source.bodies, [section.id]: text },
        lastGenerated: text,
      };
    });
    if (skipped) setConfirmGenerate(true);
    return !skipped;
  }

  function regenerateFrom(logsSource: RepoLog[], force: boolean, draftOverride?: Draft) {
    if (!settings) return;
    writeGenerated(
      (excluded) => buildTodayWork(logsSource, optionsFrom(settings, excluded)),
      force,
      draftOverride,
    );
  }

  async function pull() {
    if (!settings) return;
    setFetching(true);
    try {
      const result = await api<LogFetchResult>("/api/logs", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setSample(false);
      setLogs(result.repos);
      setLogDate(date);
      regenerateFrom(result.repos, false);
      const failed = result.repos.filter((repo) => !repo.ok).length;
      if (failed > 0) toast.warning(`${failed} 个仓库没拉下来，其余的已经收好了。`);
      setPanel("commits");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "拉取失败");
    } finally {
      setFetching(false);
    }
  }

  function showSample() {
    if (!settings) return;
    setSample(true);
    setPanel("log");
    regenerateFrom(sampleLogs(), false);
  }

  function requestGenerate(force: boolean) {
    if (!settings || !hasMaterial) {
      toast.error("先拉取提交，或看一遍示例。");
      return;
    }
    regenerateFrom(activeLogs, force);
  }

  async function persist(next: SettingsPublic, regen = false) {
    setSettings(next);
    try {
      const data = await api<{ settings: SettingsPublic }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setSettings(data.settings);
      if (regen && hasMaterial) {
        regenerateFrom(activeLogs, false);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "设置没有保存");
    }
  }

  async function copyText(text: string, message: string) {
    try {
      await writeClipboard(text);
      setCopying(true);
      toast.success(message);
      window.setTimeout(() => setCopying(false), 1600);
    } catch {
      toast.error("浏览器没有允许复制，可以选中文本手动复制。");
    }
  }

  async function submitLog() {
    if (!settings || !draft) return;
    setSubmitting(true);
    try {
      const data = await api<{ message: string }>("/api/dingtalk/submit", {
        method: "POST",
        body: JSON.stringify({
          sections: settings.sections.map((section) => ({
            id: section.id,
            body: draft.bodies[section.id] ?? "",
          })),
        }),
      });
      toast.success(data.message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "没有提交成功");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendGroup() {
    if (!settings || !draft) return;
    setSendingGroup(true);
    try {
      const data = await api<{ message: string }>("/api/dingtalk/webhook", {
        method: "POST",
        body: JSON.stringify({
          date,
          text: composeFullLog(settings.sections, draft.bodies),
        }),
      });
      toast.success(data.message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "没有发到群里");
    } finally {
      setSendingGroup(false);
    }
  }

  function changeDate(next: string) {
    setPickedDate(next);
    setSample(false);
    setLogs(null);
    setLogDate(null);
  }

  function shownCommits(repo: RepoLog): Commit[] {
    if (!settings || !settings.onlyMine || settings.myAuthors.length === 0) return repo.commits;
    return repo.commits.filter((commit) => matchesAuthor(commit.author, settings.myAuthors));
  }

  function toggleExcluded(repoId: string, revision: string, included: boolean) {
    if (!settings || !draft) return;
    const key = commitKey(repoId, revision);
    const excluded = included
      ? draft.excluded.filter((item) => item !== key)
      : Array.from(new Set([...draft.excluded, key]));
    const nextDraft: Draft = { ...draft, excluded };
    if (!hasMaterial) {
      setDraft(nextDraft);
      return;
    }
    const section = settings.sections.find((item) => item.role === "generated");
    if (!section) {
      setDraft(nextDraft);
      return;
    }
    const body = nextDraft.bodies[section.id] ?? "";
    const untouched = body.trim() === "" || body === nextDraft.lastGenerated;
    if (!untouched) {
      setDraft(nextDraft);
      return;
    }
    const text = buildTodayWork(activeLogs, optionsFrom(settings, excluded));
    setDraft({
      ...nextDraft,
      bodies: { ...nextDraft.bodies, [section.id]: text },
      lastGenerated: text,
    });
  }

  async function toggleEnabled(repo: RepoPublic, enabled: boolean) {
    setRepos((list) => list?.map((item) => (item.id === repo.id ? { ...item, enabled } : item)) ?? list);
    try {
      const data = await api<{ repo: RepoPublic }>(`/api/repos/${repo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setRepos((list) => list?.map((item) => (item.id === data.repo.id ? data.repo : item)) ?? list);
    } catch (error) {
      setRepos((list) => list?.map((item) => (item.id === repo.id ? repo : item)) ?? list);
      toast.error(error instanceof ApiError ? error.message : "没有改成");
    }
  }

  async function removeRepo(repo: RepoPublic) {
    try {
      await api(`/api/repos/${repo.id}`, { method: "DELETE" });
      setRepos((list) => list?.filter((item) => item.id !== repo.id) ?? []);
      setLogs((list) => list?.filter((item) => item.repoId !== repo.id) ?? list);
      toast.success(`已删除「${repo.name}」`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "没有删除");
    } finally {
      setPendingDelete(null);
    }
  }

  function applyPaste(repo: RepoPublic, text: string) {
    if (!settings) return;
    const parsed = parseSvnLog(text);
    if (parsed.length === 0) {
      toast.error("没有识别到提交。请粘贴 svn log 的原文，从一行横线开始。");
      return;
    }
    const commits = parsed
      .filter((commit) => {
        const day = dateInTimezone(commit.date, settings.timezone);
        return day === "" || day === date;
      })
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    if (commits.length === 0) {
      toast.error(`这 ${parsed.length} 条都不在 ${formatLongDate(date)}。换一下日期再粘贴。`);
      return;
    }
    const entry: RepoLog = {
      repoId: repo.id,
      name: repo.name,
      url: repo.url,
      ok: true,
      commits,
      elapsedMs: 0,
      source: "paste",
    };
    const order = new Map((repos ?? []).map((item, index) => [item.id, index]));
    const nextLogs = [...(logs ?? []).filter((item) => item.repoId !== repo.id), entry].sort(
      (a, b) => (order.get(a.repoId) ?? 99) - (order.get(b.repoId) ?? 99),
    );
    setSample(false);
    setLogs(nextLogs);
    setLogDate(date);
    setPasteRepo(null);
    setPanel("commits");
    regenerateFrom(nextLogs, false);
    toast.success(`「${repo.name}」读入 ${commits.length} 条备注`);
  }

  const generatedPreview =
    settings && draft && hasMaterial
      ? buildTodayWork(activeLogs, optionsFrom(settings, draft.excluded))
      : "";
  const generatedSection = settings?.sections.find((section) => section.role === "generated");
  const generatedBody = generatedSection ? (draft?.bodies[generatedSection.id] ?? "") : "";
  const previewDiffers = hasMaterial && generatedBody !== generatedPreview;

  const authors = Array.from(
    new Set(activeLogs.flatMap((repo) => repo.commits.map((commit) => commit.author))),
  );
  const includedCount = activeLogs.reduce((sum, repo) => {
    if (!repo.ok || !settings || !draft) return sum;
    return (
      sum +
      shownCommits(repo).filter((commit) => !draft.excluded.includes(commitKey(repo.repoId, commit.revision)))
        .length
    );
  }, 0);
  const failedCount = activeLogs.filter((repo) => !repo.ok).length;
  const dingReady = Boolean(settings?.dingtalk.templateId && settings.dingtalk.hasAppSecret);
  const webhookReady = Boolean(settings?.dingtalk.webhook);

  return {
    settings,
    setSettings,
    repos,
    setRepos,
    loadError,
    date,
    draft,
    setDraft,
    sample,
    fetching,
    copying,
    submitting,
    sendingGroup,
    panel,
    setPanel,
    dialogMode,
    setDialogMode,
    pasteRepo,
    setPasteRepo,
    pendingDelete,
    setPendingDelete,
    confirmGenerate,
    setConfirmGenerate,
    authorDraft,
    setAuthorDraft,
    activeLogs,
    hasMaterial,
    generatedPreview,
    generatedSection,
    previewDiffers,
    authors,
    includedCount,
    failedCount,
    dingReady,
    webhookReady,
    pull,
    showSample,
    requestGenerate,
    persist,
    copyText,
    submitLog,
    sendGroup,
    changeDate,
    shownCommits,
    toggleExcluded,
    toggleEnabled,
    removeRepo,
    applyPaste,
  };
}

async function writeClipboard(text: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("copy failed");
}
