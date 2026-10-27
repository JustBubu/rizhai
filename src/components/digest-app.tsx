"use client";

import { useState, type ReactNode } from "react";
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
import { useLocale } from "@/components/locale-provider";
import { useDigestApp, type Panel } from "@/hooks/use-digest-app";
import { calendarDate, formatClock, formatLongDate, shiftDate, svnRevisionRange } from "@/lib/dates";
import { actionLabel, commitKey, composeFullLog, countChars, matchesAuthor, repoHost } from "@/lib/summarize";
import type { RepoLog, RepoPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DigestApp({ initialToday }: { initialToday: string }) {
  const app = useDigestApp(initialToday);
  const {
    settings,
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
    locale,
    t,
  } = app;

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("prevDay")}
            onClick={() => changeDate(shiftDate(date, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="px-1 text-center">
            <div className="font-serif text-base whitespace-nowrap sm:text-xl">{formatLongDate(date, locale)}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("nextDay")}
            onClick={() => changeDate(shiftDate(date, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Input
            type="date"
            aria-label={t("pickDate")}
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
            {t("today")}
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={settings?.onlyMine ?? false}
              onCheckedChange={(checked) => {
                if (!settings) return;
                void persist({ ...settings, onlyMine: checked === true }, true);
              }}
              aria-label={t("onlyMine")}
            />
            {t("onlyMine")}
          </label>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(
              [
                ["personal", t("personal")],
                ["team", t("team")],
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
                  void persist({ ...settings, logMode: mode }, true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" size="lg" onClick={() => void pull()} disabled={fetching || !repos?.some((repo) => repo.enabled)}>
            <RefreshCwIcon className={fetching ? "animate-spin" : undefined} />
            {fetching ? t("pulling") : t("pull")}
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
            void persist({ ...settings, myAuthors: [name] }, true);
            setAuthorDraft("");
          }}
        >
          <span>{t("needAuthor")}</span>
          <Input
            value={authorDraft}
            onChange={(event) => setAuthorDraft(event.target.value)}
            placeholder={t("authorPlaceholder")}
            className="h-8 w-40"
          />
          <Button type="submit" size="sm">
            {t("thatsMe")}
          </Button>
        </form>
      ) : null}

      <Tabs value={panel} onValueChange={(value) => setPanel(value as Panel)} className="mt-3 lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="repos">{t("panelRepos")}</TabsTrigger>
          <TabsTrigger value="commits">{t("panelCommits")}</TabsTrigger>
          <TabsTrigger value="log">{t("panelLog")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 grid gap-3 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)_23.5rem]">
        <section className={columnClass(panel, "repos")}>
          <ColumnHeading
            title={t("panelRepos")}
            extra={
              <Button type="button" size="sm" variant="outline" onClick={() => setDialogMode({ kind: "create" })}>
                <PlusIcon />
                {t("add")}
              </Button>
            }
          />
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
            {loadError ? <p className="px-1 text-sm text-destructive">{loadError}</p> : null}
            {repos === null && !loadError ? <p className="px-1 text-sm text-muted-foreground">{t("loadingRepos")}</p> : null}
            {repos?.length === 0 ? (
              <div className="px-1 py-6 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">{t("emptyReposTitle")}</p>
                <p className="mt-1">{t("emptyReposBody")}</p>
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
                    <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{repoHost(repo.url, locale)}</span>
                  </button>
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <Switch
                      size="sm"
                      checked={repo.enabled}
                      onCheckedChange={(checked) => void toggleEnabled(repo, checked === true)}
                      aria-label={`${repo.enabled ? t("disableRepo") : t("enableRepo")} ${repo.name}`}
                    />
                    <span className="text-xs text-muted-foreground">{repo.enabled ? t("enabled") : t("disabled")}</span>
                    <Button type="button" size="icon-xs" variant="ghost" className="ml-auto" aria-label={t("editRepo")} onClick={() => setDialogMode({ kind: "edit", repo })}>
                      <PencilIcon />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label={t("deleteRepo")} onClick={() => setPendingDelete(repo)}>
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
            title={t("commitsHeading")}
            extra={
              hasMaterial ? (
                <span className="text-xs text-muted-foreground">
                  {t("commitsIncluded", { count: includedCount })}
                  {failedCount > 0 ? ` · ${t("commitsFailed", { count: failedCount })}` : ""}
                  {sample ? ` · ${t("sampleBadge")}` : ""}
                </span>
              ) : null
            }
          />
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
            {authors.length > 0 && settings ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border py-2">
                <span className="text-xs text-muted-foreground">{t("authors")}</span>
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
                        void persist({ ...settings, myAuthors }, true);
                      }}
                    >
                      {author}
                      {mine ? ` · ${t("me")}` : ` · ${t("markAsMe")}`}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!hasMaterial && !fetching ? (
              <div className="py-10">
                <p className="font-serif text-2xl">{t("emptyCommitsTitle")}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("emptyCommitsBody")}</p>
                <Button type="button" variant="outline" className="mt-4" onClick={showSample}>
                  {t("showSample")}
                </Button>
              </div>
            ) : null}

            {fetching && !hasMaterial ? <p className="py-8 text-sm text-muted-foreground">{t("fetchingRepos")}</p> : null}

            {sample ? (
              <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">
                {t("sampleHint")}
              </p>
            ) : null}

            {hasMaterial && activeLogs.every((repo) => repo.ok && shownCommits(repo).length === 0) ? (
              <p className="py-8 text-sm leading-6 text-muted-foreground">
                {t("noCommitsToday")}
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
                        {repo.ok ? `${commits.length}` : t("failed")}
                        {repo.source === "paste" ? ` · ${t("pasted")}` : ""}
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
                          {t("pasteInstead")}
                        </Button>
                      </div>
                    ) : null}
                    {repo.ok && commits.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t("noCommits")}</p>
                    ) : null}
                    <ul className="mt-1">
                      {commits.map((commit) => {
                        const included = !draft?.excluded.includes(commitKey(repo.repoId, commit.revision));
                        return (
                          <li key={commit.revision} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border/80 py-3", !included && "opacity-55")}>
                            <Checkbox
                              checked={included}
                              onCheckedChange={(checked) => toggleExcluded(repo.repoId, commit.revision, checked === true)}
                              aria-label={t("includeCommit", { revision: commit.revision })}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                                <span className="font-mono text-foreground">{formatClock(commit.date, settings?.timezone ?? "+08:00")}</span>
                                <span className="font-mono">r{commit.revision}</span>
                                <span>{commit.author}</span>
                              </div>
                              <p className={cn("mt-1 whitespace-pre-wrap text-sm leading-6", !included && "line-through")}>
                                {commit.message.trim() || t("emptyMessage")}
                              </p>
                              {commit.paths.length > 0 ? (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs text-muted-foreground">{t("filesCount", { count: commit.paths.length })}</summary>
                                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] leading-5 text-muted-foreground">
                                    {commit.paths.map((item) => (
                                      <li key={`${item.action}-${item.path}`} className="truncate">
                                        <span className="mr-2 text-foreground/70">{actionLabel(item.action, locale)}</span>
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
                        {t("replaceWithPaste")}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={columnClass(panel, "log")}>
          <ColumnHeading title={t("dingLog")} />
          <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-2">
            {previewDiffers ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <p className="text-foreground">{t("previewDiffersTitle")}</p>
                <button
                  type="button"
                  className="mt-1 font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => requestGenerate(false)}
                >
                  {t("regenerate", { title: generatedSection?.title ?? t("todayWork") })}
                </button>
              </div>
            ) : null}
            {settings?.sections.map((section) => {
              const body = draft?.bodies[section.id] ?? "";
              const count = countChars(body);
              return (
                <label key={section.id} className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{section.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {section.role === "generated" ? t("generatedRole") : t("manualRole")}
                      <span className={count > 1000 ? "text-destructive" : undefined}>{t("chars", { count })}</span>
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          void copyText(body.trim() || t("none"), t("toastCopiedSection", { title: section.title }));
                        }}
                      >
                        {t("copySection")}
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
                        ? t("generatedPlaceholder")
                        : t("manualPlaceholder")
                    }
                    className="mt-1 min-h-28 resize-y bg-card"
                  />
                </label>
              );
            })}
            <p className="text-xs leading-5 text-muted-foreground">
              {t("copyHint")}
            </p>
          </div>
          <div className="grid gap-2 border-t border-border p-3">
            <Button
              type="button"
              size="lg"
              disabled={!draft || !settings}
              onClick={() => {
                if (!settings || !draft) return;
                void copyText(composeFullLog(settings.sections, draft.bodies, locale), copying ? t("copied") : t("copiedFull"));
              }}
            >
              <CopyIcon />
              {t("copyFull")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                title={dingReady ? t("submitReady") : t("submitNeedSetup")}
                disabled={!dingReady || submitting}
                onClick={() => void submitLog()}
              >
                <SendIcon />
                {submitting ? t("submitting") : t("submitDing")}
              </Button>
              <Button
                type="button"
                variant="outline"
                title={webhookReady ? t("webhookReady") : t("webhookNeedSetup")}
                disabled={!webhookReady || sendingGroup}
                onClick={() => void sendGroup()}
              >
                {sendingGroup ? t("sending") : t("sendGroup")}
              </Button>
            </div>
            {!dingReady ? (
              <p className="text-xs text-muted-foreground">
                {t("submitHint")}
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
          timezone={settings?.timezone ?? "+08:00"}
          onOpenChange={(open) => {
            if (!open) setPasteRepo(null);
          }}
          onPaste={(text) => applyPaste(pasteRepo, text)}
        />
      ) : null}

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteRepoTitle", { name: pendingDelete?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteRepoBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => pendingDelete && void removeRepo(pendingDelete)}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("overwriteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("overwriteBody", { title: generatedSection?.title ?? t("todayWork") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepEdits")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmGenerate(false);
                requestGenerate(true);
              }}
            >
              {t("overwrite")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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
  timezone,
  onOpenChange,
  onPaste,
}: {
  repo: RepoPublic;
  date: string;
  timezone: string;
  onOpenChange: (open: boolean) => void;
  onPaste: (text: string) => void;
}) {
  const { locale, t } = useLocale();
  const [text, setText] = useState("");
  const range = svnRevisionRange(date, timezone);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("pasteTitle", { name: repo.name })}</DialogTitle>
          <DialogDescription>
            {t("pasteBody", { date: formatLongDate(date, locale) })}
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
{`svn log -v -r ${range} ${repo.url}`}
        </pre>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"------------------------------------------------------------------------\nr12 | zhangsan | ..."}
          className="min-h-48 font-mono text-xs"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => onPaste(text)}>
            {t("readPaste")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
