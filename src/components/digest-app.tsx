"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardPasteIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { RepoDialog } from "@/components/repo-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/client";
import { calendarDate, dateInTimezone, formatClock, formatLongDate, shiftDate } from "@/lib/dates";
import { parseSvnLog } from "@/lib/parse-svn";
import { sampleLogs } from "@/lib/sample";
import {
  actionLabel,
  buildTodayWork,
  commitKey,
  composeFullLog,
  countChars,
  matchesAuthor,
  repoHost,
  type SummaryOptions,
} from "@/lib/summarize";
import type { Commit, Draft, LogFetchResult, RepoLog, RepoPublic, SettingsPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

type Panel = "repos" | "commits" | "log";
type DialogMode = { kind: "create" } | { kind: "edit"; repo: RepoPublic };

export function DigestApp({ initialToday }: { initialToday: string }) {
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

  function writeGenerated(textFor: (excluded: string[]) => string, force: boolean) {
    const section = settings?.sections.find((item) => item.role === "generated");
    if (!section) {
      toast.error("设置里没有「由提交生成」的栏目。");
      return;
    }
    let skipped = false;
    setDraft((current) => {
      if (!current) return current;
      const body = current.bodies[section.id] ?? "";
      const untouched = body.trim() === "" || body === current.lastGenerated;
      if (!untouched && !force) {
        skipped = true;
        return current;
      }
      const text = textFor(current.excluded);
      return {
        ...current,
        bodies: { ...current.bodies, [section.id]: text },
        lastGenerated: text,
      };
    });
    if (skipped) setConfirmGenerate(true);
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
      writeGenerated(
        (excluded) => buildTodayWork(result.repos, optionsFrom(settings, excluded)),
        false,
      );
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
    writeGenerated((excluded) => buildTodayWork(sampleLogs(), optionsFrom(settings, excluded)), false);
  }

  function requestGenerate(force: boolean) {
    if (!settings || !hasMaterial) {
      toast.error("先拉取提交，或看一遍示例。");
      return;
    }
    const source = activeLogs;
    writeGenerated(
      (excluded) => buildTodayWork(source, optionsFrom(settings, excluded)),
      force,
    );
  }

  async function persist(next: SettingsPublic) {
    setSettings(next);
    try {
      const data = await api<{ settings: SettingsPublic }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setSettings(data.settings);
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
    const key = commitKey(repoId, revision);
    setDraft((current) => {
      if (!current) return current;
      const excluded = included
        ? current.excluded.filter((item) => item !== key)
        : Array.from(new Set([...current.excluded, key]));
      return { ...current, excluded };
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
    setSample(false);
    setLogs((current) => {
      const others = (current ?? []).filter((item) => item.repoId !== repo.id);
      const order = new Map((repos ?? []).map((item, index) => [item.id, index]));
      return [...others, entry].sort(
        (a, b) => (order.get(a.repoId) ?? 99) - (order.get(b.repoId) ?? 99),
      );
    });
    setLogDate(date);
    setPasteRepo(null);
    setPanel("commits");
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

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="前一天"
            onClick={() => changeDate(shiftDate(date, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="px-1 text-center">
            <div className="font-serif text-base whitespace-nowrap sm:text-xl">{formatLongDate(date)}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="后一天"
            onClick={() => changeDate(shiftDate(date, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Input
            type="date"
            aria-label="选择日期"
            value={date}
            onChange={(event) => changeDate(event.target.value)}
            className="ml-1 w-[9.5rem]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => changeDate(calendarDate(settings?.timezone ?? "+08:00"))}
          >
            今天
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={settings?.onlyMine ?? false}
              onCheckedChange={(checked) => {
                if (!settings) return;
                void persist({ ...settings, onlyMine: checked === true });
              }}
              aria-label="只看我的提交"
            />
            只看我的
          </label>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(
              [
                ["personal", "个人"],
                ["team", "团队"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm",
                  settings?.logMode === mode ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => {
                  if (!settings) return;
                  void persist({ ...settings, logMode: mode });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" size="lg" onClick={() => void pull()} disabled={fetching || !repos?.some((repo) => repo.enabled)}>
            <RefreshCwIcon className={fetching ? "animate-spin" : undefined} />
            {fetching ? "正在拉取…" : "拉取提交"}
          </Button>
        </div>
      </div>

      {settings?.onlyMine && settings.myAuthors.length === 0 ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const name = authorDraft.trim();
            if (!name || !settings) return;
            void persist({ ...settings, myAuthors: [name] });
            setAuthorDraft("");
          }}
        >
          <span>只看我的需要知道你的 SVN 用户名。</span>
          <Input
            value={authorDraft}
            onChange={(event) => setAuthorDraft(event.target.value)}
            placeholder="例如 zhangsan"
            className="h-8 w-40"
          />
          <Button type="submit" size="sm">
            就是我
          </Button>
        </form>
      ) : null}

      <Tabs value={panel} onValueChange={(value) => setPanel(value as Panel)} className="mt-3 lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="repos">仓库</TabsTrigger>
          <TabsTrigger value="commits">提交</TabsTrigger>
          <TabsTrigger value="log">日志</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 grid gap-3 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)_23.5rem]">
        <section className={columnClass(panel, "repos")}>
          <ColumnHeading
            title="仓库"
            extra={
              <Button type="button" size="sm" variant="outline" onClick={() => setDialogMode({ kind: "create" })}>
                <PlusIcon />
                添加
              </Button>
            }
          />
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
            {loadError ? <p className="px-1 text-sm text-destructive">{loadError}</p> : null}
            {repos === null && !loadError ? <p className="px-1 text-sm text-muted-foreground">正在读取本机的仓库…</p> : null}
            {repos?.length === 0 ? (
              <div className="px-1 py-6 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">先把要看的项目加进来</p>
                <p className="mt-1">每个仓库一条地址。之后每天打开日摘，选日期，点一次拉取。</p>
              </div>
            ) : null}
            {repos?.map((repo) => {
              const result = activeLogs.find((item) => item.repoId === repo.id);
              return (
                <div key={repo.id} className={cn("rounded-lg border border-border bg-card py-2", !repo.enabled && "opacity-50")}>
                  <button
                    type="button"
                    className="block w-full px-2 text-left"
                    onClick={() => {
                      setPanel("commits");
                      document.getElementById(`repo-${repo.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <StatusDot result={result} enabled={repo.enabled} />
                      <span className="truncate font-medium">{repo.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{repoHost(repo.url)}</span>
                  </button>
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <Switch
                      size="sm"
                      checked={repo.enabled}
                      onCheckedChange={(checked) => void toggleEnabled(repo, checked === true)}
                      aria-label={`${repo.enabled ? "停用" : "启用"}${repo.name}`}
                    />
                    <span className="text-xs text-muted-foreground">{repo.enabled ? "参与拉取" : "已停用"}</span>
                    <Button type="button" size="icon-xs" variant="ghost" className="ml-auto" aria-label="编辑仓库" onClick={() => setDialogMode({ kind: "edit", repo })}>
                      <PencilIcon />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="删除仓库" onClick={() => setPendingDelete(repo)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={columnClass(panel, "commits")}>
          <ColumnHeading
            title="提交备注"
            extra={
              hasMaterial ? (
                <span className="text-xs text-muted-foreground">
                  {includedCount} 条计入日志
                  {failedCount > 0 ? ` · ${failedCount} 个失败` : ""}
                  {sample ? " · 示例" : ""}
                </span>
              ) : null
            }
          />
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
            {authors.length > 0 && settings ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border py-2">
                <span className="text-xs text-muted-foreground">作者</span>
                {authors.map((author) => {
                  const mine = matchesAuthor(author, settings.myAuthors);
                  return (
                    <button
                      key={author}
                      type="button"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        mine ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground",
                      )}
                      onClick={() => {
                        const myAuthors = mine
                          ? settings.myAuthors.filter((item) => item.toLowerCase() !== author.toLowerCase())
                          : [...settings.myAuthors, author];
                        void persist({ ...settings, myAuthors });
                      }}
                    >
                      {author}
                      {mine ? " · 我" : " · 标为我"}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!hasMaterial && !fetching ? (
              <div className="py-10">
                <p className="font-serif text-2xl">今天的备注还在各个仓库里</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  点右上角「拉取提交」。勾掉不该写进日报的记录，右边就是可以交到钉钉的日志。连不上公司 SVN 时，也可以把
                  <span className="font-mono text-xs"> svn log </span>
                  的文本粘贴进来。
                </p>
                <Button type="button" variant="outline" className="mt-4" onClick={showSample}>
                  先用示例看日志长什么样
                </Button>
              </div>
            ) : null}

            {fetching && !hasMaterial ? <p className="py-8 text-sm text-muted-foreground">正在逐个仓库读取今天的备注…</p> : null}

            {sample ? (
              <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">
                这是一份示例，作者是 zhangsan 和 lisi。添加真实仓库后点「拉取提交」就会换成你的记录。
              </p>
            ) : null}

            {hasMaterial && activeLogs.every((repo) => repo.ok && shownCommits(repo).length === 0) ? (
              <p className="py-8 text-sm leading-6 text-muted-foreground">
                这一天没有要写进日志的提交。换一天看看，或确认地址指到了有人在提交的目录。
              </p>
            ) : null}

            <div className="space-y-5 pt-3">
              {activeLogs.map((repo) => {
                const commits = repo.ok ? shownCommits(repo) : [];
                return (
                  <article key={repo.repoId} id={`repo-${repo.repoId}`} className="scroll-mt-3">
                    <header className="flex items-baseline justify-between gap-3">
                      <h3 className="font-serif text-lg">{repo.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {repo.ok ? `${commits.length} 条` : "失败"}
                        {repo.source === "paste" ? " · 粘贴" : ""}
                      </span>
                    </header>
                    {!repo.ok ? (
                      <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                        <p>{repo.error}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            const found = repos?.find((item) => item.id === repo.repoId);
                            if (found) setPasteRepo(found);
                          }}
                        >
                          <ClipboardPasteIcon />
                          改为粘贴 svn log
                        </Button>
                      </div>
                    ) : null}
                    {repo.ok && commits.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">今天没有提交。</p>
                    ) : null}
                    <ul className="mt-1">
                      {commits.map((commit) => {
                        const included = !draft?.excluded.includes(commitKey(repo.repoId, commit.revision));
                        return (
                          <li key={commit.revision} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border/80 py-3", !included && "opacity-55")}>
                            <Checkbox
                              checked={included}
                              onCheckedChange={(checked) => toggleExcluded(repo.repoId, commit.revision, checked === true)}
                              aria-label={`把 r${commit.revision} 计入日志`}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                                <span className="font-mono text-foreground">{formatClock(commit.date, settings?.timezone ?? "+08:00")}</span>
                                <span className="font-mono">r{commit.revision}</span>
                                <span>{commit.author}</span>
                              </div>
                              <p className={cn("mt-1 whitespace-pre-wrap text-sm leading-6", !included && "line-through")}>
                                {commit.message.trim() || "（这条提交没有写备注）"}
                              </p>
                              {commit.paths.length > 0 ? (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs text-muted-foreground">{commit.paths.length} 个文件</summary>
                                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] leading-5 text-muted-foreground">
                                    {commit.paths.map((item) => (
                                      <li key={`${item.action}-${item.path}`} className="truncate">
                                        <span className="mr-2 text-foreground/70">{actionLabel(item.action)}</span>
                                        {item.path}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {repo.ok && !sample ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => {
                          const found = repos?.find((item) => item.id === repo.repoId);
                          if (found) setPasteRepo(found);
                        }}
                      >
                        用粘贴的 svn log 替换这里
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={columnClass(panel, "log")}>
          <ColumnHeading title="钉钉日志" />
          <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-2">
            {previewDiffers ? (
              <button type="button" className="text-left text-xs text-primary underline-offset-2 hover:underline" onClick={() => requestGenerate(false)}>
                勾选或筛选已经变了，按现在的提交重新生成「{generatedSection?.title ?? "今日完成"}」
              </button>
            ) : null}
            {settings?.sections.map((section) => {
              const body = draft?.bodies[section.id] ?? "";
              const count = countChars(body);
              return (
                <label key={section.id} className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{section.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {section.role === "generated" ? "由提交生成" : "自己写"}
                      <span className={count > 1000 ? "text-destructive" : undefined}>{count} 字</span>
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          void copyText(body.trim() || "无", `已复制「${section.title}」`);
                        }}
                      >
                        复制此栏
                      </button>
                    </span>
                  </span>
                  <Textarea
                    value={body}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((current) =>
                        current ? { ...current, bodies: { ...current.bodies, [section.id]: value } } : current,
                      );
                    }}
                    placeholder={
                      section.role === "generated"
                        ? "拉取之后这里会按项目列出备注，可以直接改。"
                        : "没有就留空，复制和提交时会写成「无」。"
                    }
                    className="mt-1 min-h-28 resize-y bg-card"
                  />
                </label>
              );
            })}
            <p className="text-xs leading-5 text-muted-foreground">
              复制后到钉钉日志里粘贴即可，不需要额外权限。单栏超过 1000 字时，开放接口会截断，粘贴不受这个限制。
            </p>
          </div>
          <div className="grid gap-2 border-t border-border p-3">
            <Button
              type="button"
              size="lg"
              disabled={!draft || !settings}
              onClick={() => {
                if (!settings || !draft) return;
                void copyText(composeFullLog(settings.sections, draft.bodies), copying ? "已复制" : "已复制全文，到钉钉日志里粘贴");
              }}
            >
              <CopyIcon />
              复制全文
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                title={dingReady ? "按日志模板直接提交" : "先在设置里读取钉钉日志模板"}
                disabled={!dingReady || submitting}
                onClick={() => void submitLog()}
              >
                <SendIcon />
                {submitting ? "提交中…" : "提交到钉钉"}
              </Button>
              <Button
                type="button"
                variant="outline"
                title={webhookReady ? "发到钉钉群，不是个人日志" : "先在设置里填写群机器人地址"}
                disabled={!webhookReady || sendingGroup}
                onClick={() => void sendGroup()}
              >
                {sendingGroup ? "发送中…" : "发到群里"}
              </Button>
            </div>
            {!dingReady ? (
              <p className="text-xs text-muted-foreground">
                直接提交需要在设置里配好企业内部应用和日志模板。大多数时候，复制全文就够了。
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {dialogMode ? (
        <RepoDialog
          key={dialogMode.kind === "edit" ? dialogMode.repo.id : "create"}
          mode={dialogMode}
          onOpenChange={(open) => {
            if (!open) setDialogMode(null);
          }}
          onSaved={(repo) => {
            setRepos((list) => {
              const current = list ?? [];
              const index = current.findIndex((item) => item.id === repo.id);
              if (index < 0) return [...current, repo];
              return current.map((item) => (item.id === repo.id ? repo : item));
            });
          }}
        />
      ) : null}

      {pasteRepo ? (
        <PasteDialog
          key={pasteRepo.id}
          repo={pasteRepo}
          date={date}
          onOpenChange={(open) => {
            if (!open) setPasteRepo(null);
          }}
          onPaste={(text) => applyPaste(pasteRepo, text)}
        />
      ) : null}

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{pendingDelete?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>只从日摘里去掉这个仓库，SVN 上的提交不会受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留下</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => pendingDelete && void removeRepo(pendingDelete)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖已经改过的内容？</AlertDialogTitle>
            <AlertDialogDescription>
              「{generatedSection?.title ?? "今日完成"}」里有你手改的句子。重新生成会用当前勾选的提交备注替换这一栏。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留着我的修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmGenerate(false);
                requestGenerate(true);
              }}
            >
              覆盖
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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

function columnClass(panel: Panel, name: Panel) {
  return cn(
    "min-h-[70dvh] flex-col overflow-hidden rounded-xl border border-border bg-card/40 lg:flex lg:min-h-0",
    panel === name ? "flex" : "hidden",
  );
}

function ColumnHeading({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <h2 className="font-serif text-base">{title}</h2>
      {extra}
    </div>
  );
}

function StatusDot({ result, enabled }: { result?: RepoLog; enabled: boolean }) {
  const color = !enabled
    ? "bg-muted-foreground/40"
    : !result
      ? "bg-border"
      : !result.ok
        ? "bg-destructive"
        : result.commits.length > 0
          ? "bg-emerald-700"
          : "bg-amber-600";
  return <span className={cn("size-1.5 shrink-0 rounded-full", color)} />;
}

function PasteDialog({
  repo,
  date,
  onOpenChange,
  onPaste,
}: {
  repo: RepoPublic;
  date: string;
  onOpenChange: (open: boolean) => void;
  onPaste: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const nextDay = shiftDate(date, 1);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>粘贴「{repo.name}」的 svn log</DialogTitle>
          <DialogDescription>
            在能连上仓库的电脑上执行下面的命令，把输出整段贴进来。日摘会只留下 {formatLongDate(date)} 的提交。
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
{`svn log -v -r {${date}}:{${nextDay}} ${repo.url}`}
        </pre>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"------------------------------------------------------------------------\nr12 | zhangsan | ..."}
          className="min-h-48 font-mono text-xs"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={() => onPaste(text)}>
            读入这一天
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
