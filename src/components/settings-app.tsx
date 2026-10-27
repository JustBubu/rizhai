"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/components/locale-provider";
import { ApiError, api } from "@/lib/client";
import { timezoneOptions } from "@/lib/defaults";
import { LOCALES, type Locale } from "@/lib/i18n";
import type { FieldBinding, LogSection, SettingsPublic } from "@/lib/types";

export function SettingsApp() {
  const { t, locale, setLocale } = useLocale();
  const [form, setForm] = useState<SettingsPublic | null>(null);
  const [appSecret, setAppSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ settings: SettingsPublic }>("/api/settings")
      .then((data) => {
        if (!cancelled) setForm(data.settings);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t("toastLoadSettings"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    function onSettings(event: Event) {
      const detail = (event as CustomEvent<SettingsPublic>).detail;
      if (detail) setForm(detail);
    }
    window.addEventListener("rizhai:settings", onSettings);
    return () => window.removeEventListener("rizhai:settings", onSettings);
  }, []);

  async function save(current = form) {
    if (!current) return null;
    setSaving(true);
    try {
      const data = await api<{ settings: SettingsPublic }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...current,
          dingtalk: {
            ...current.dingtalk,
            ...(appSecret ? { appSecret } : {}),
            ...(webhookSecret ? { webhookSecret } : {}),
          },
        }),
      });
      setForm(data.settings);
      if (appSecret) setAppSecret("");
      if (webhookSecret) setWebhookSecret("");
      return data.settings;
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : t("toastSaveFail"));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function readTemplate() {
    if (!form) return;
    setReading(true);
    try {
      const saved = await save(form);
      if (!saved) return;
      const data = await api<{ settings: SettingsPublic }>("/api/dingtalk/template", {
        method: "POST",
        body: JSON.stringify({
          appKey: saved.dingtalk.appKey,
          userId: saved.dingtalk.userId,
          templateName: saved.dingtalk.templateName,
        }),
      });
      setForm(data.settings);
      toast.success(t("toastTemplateOk", { name: data.settings.dingtalk.templateName }));
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : t("toastTemplateFail"));
    } finally {
      setReading(false);
    }
  }

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">{error}</p>;
  }
  if (!form) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">{t("loadingSettings")}</p>;
  }

  const generatedId = form.sections.find((section) => section.role === "generated")?.id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="font-serif text-3xl">{t("settingsTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("settingsIntro")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("languageCard")}</CardTitle>
          <CardDescription>{t("languageCardDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {LOCALES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm ${locale === item.value ? "bg-foreground text-background" : "text-muted-foreground"}`}
                onClick={() => {
                  if (item.value === locale) return;
                  void setLocale(item.value as Locale);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("myCommits")}</CardTitle>
          <CardDescription>{t("myCommitsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = author.trim();
              if (!name) return;
              if (form.myAuthors.some((item) => item.toLowerCase() === name.toLowerCase())) {
                setAuthor("");
                return;
              }
              setForm({ ...form, myAuthors: [...form.myAuthors, name] });
              setAuthor("");
            }}
          >
            <Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder={t("svnUsername")} />
            <Button type="submit" variant="outline">
              {t("add")}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {form.myAuthors.length === 0 ? <span className="text-sm text-muted-foreground">{t("noAuthors")}</span> : null}
            {form.myAuthors.map((name) => (
              <button
                key={name}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-sm"
                onClick={() => setForm({ ...form, myAuthors: form.myAuthors.filter((item) => item !== name) })}
              >
                {name}
                <XIcon className="size-3" />
                <span className="sr-only">{t("remove")}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <span className="text-sm font-medium">{t("timezone")}</span>
            <Select value={form.timezone} onValueChange={(timezone) => setForm({ ...form, timezone })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions(locale).map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Toggle
            checked={form.includeRevision}
            onCheckedChange={(includeRevision) => setForm({ ...form, includeRevision })}
            title={t("includeRevision")}
            description={t("includeRevisionDesc")}
          />
          <Toggle
            checked={form.showEmptyRepos}
            onCheckedChange={(showEmptyRepos) => setForm({ ...form, showEmptyRepos })}
            title={t("showEmptyRepos")}
            description={t("showEmptyReposDesc")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("logSections")}</CardTitle>
          <CardDescription>{t("logSectionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {form.sections.map((section, index) => (
            <div key={section.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_9rem_auto]">
              <Input
                aria-label={t("sectionName")}
                value={section.title}
                onChange={(event) => updateSection(section.id, { title: event.target.value })}
              />
              <Select
                value={section.role}
                onValueChange={(role) => updateSection(section.id, { role: role as LogSection["role"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generated">{t("generatedRole")}</SelectItem>
                  <SelectItem value="manual">{t("manualRole")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={t("moveUp")} disabled={index === 0} onClick={() => moveSection(index, -1)}>
                  <ChevronUpIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("moveDown")}
                  disabled={index === form.sections.length - 1}
                  onClick={() => moveSection(index, 1)}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("deleteSection")}
                  disabled={form.sections.length === 1}
                  onClick={() => setForm({ ...form, sections: form.sections.filter((item) => item.id !== section.id) })}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() =>
              setForm({
                ...form,
                sections: [
                  ...form.sections,
                  { id: `s${crypto.randomUUID().slice(0, 8)}`, title: t("newSection"), role: "manual" },
                ],
              })
            }
          >
            <PlusIcon />
            {t("addSection")}
          </Button>
          {generatedId ? null : <p className="text-sm text-destructive">{t("needGenerated")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dingSubmit")}</CardTitle>
          <CardDescription>{t("dingSubmitDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="AppKey">
            <Input value={form.dingtalk.appKey} onChange={(event) => patchDing({ appKey: event.target.value })} spellCheck={false} />
          </Field>
          <Field label="AppSecret" hint={form.dingtalk.hasAppSecret ? t("secretSaved") : t("secretMissing")}>
            <Input type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} autoComplete="new-password" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("myUserId")}>
              <Input value={form.dingtalk.userId} onChange={(event) => patchDing({ userId: event.target.value })} spellCheck={false} />
            </Field>
            <Field label={t("templateName")}>
              <Input value={form.dingtalk.templateName} onChange={(event) => patchDing({ templateName: event.target.value })} />
            </Field>
          </div>
          <Button type="button" variant="outline" className="w-fit" disabled={reading || saving} onClick={() => void readTemplate()}>
            {reading ? t("readingTemplate") : t("saveReadTemplate")}
          </Button>
          {form.dingtalk.fields.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">{t("templateFields", { id: form.dingtalk.templateId })}</p>
              {form.dingtalk.fields.map((field) => {
                const binding = form.dingtalk.bindings[field.fieldName];
                const value = bindingValue(binding);
                return (
                  <div key={field.fieldName} className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                    <div className="text-sm">
                      <div className="font-medium">{field.fieldName}</div>
                      <div className="text-xs text-muted-foreground">{field.type === 1 ? t("fieldText") : t("fieldNonText")}</div>
                    </div>
                    <Select value={value} onValueChange={(next) => setBinding(field.fieldName, next)} disabled={field.type !== 1}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("bindNone")}</SelectItem>
                        {form.sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">{t("bindCustom")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {binding?.mode === "custom" ? (
                      <Input
                        className="sm:col-span-2"
                        value={binding.text}
                        onChange={(event) =>
                          setBinding(field.fieldName, "custom", event.target.value)
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noTemplateFields")}</p>
          )}
          <Toggle
            checked={form.dingtalk.toChat}
            onCheckedChange={(toChat) => patchDing({ toChat })}
            title={t("toChat")}
            description={t("toChatDesc")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("groupRobot")}</CardTitle>
          <CardDescription>{t("groupRobotDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Webhook">
            <Input
              value={form.dingtalk.webhook}
              onChange={(event) => patchDing({ webhook: event.target.value })}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
              spellCheck={false}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("signSecret")} hint={form.dingtalk.hasWebhookSecret ? t("signSecretSaved") : ""}>
              <Input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={t("keyword")}>
              <Input value={form.dingtalk.webhookKeyword} onChange={(event) => patchDing({ webhookKeyword: event.target.value })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button type="button" size="lg" disabled={saving} onClick={() => void save().then((saved) => saved && toast.success(t("toastSettingsSaved")))}>
          {saving ? t("saving") : t("saveSettings")}
        </Button>
      </div>
    </div>
  );

  function patchDing(patch: Partial<SettingsPublic["dingtalk"]>) {
    setForm((current) => (current ? { ...current, dingtalk: { ...current.dingtalk, ...patch } } : current));
  }

  function updateSection(id: string, patch: Partial<LogSection>) {
    setForm((current) => {
      if (!current) return current;
      let sections = current.sections.map((section) => (section.id === id ? { ...section, ...patch } : section));
      if (patch.role === "generated") {
        sections = sections.map((section) => (section.id === id ? section : { ...section, role: "manual" }));
      }
      return { ...current, sections };
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    setForm((current) => {
      if (!current) return current;
      const next = [...current.sections];
      const target = index + direction;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...current, sections: next };
    });
  }

  function bindingValue(binding: FieldBinding | undefined) {
    if (!binding || binding.mode === "none") return "none";
    if (binding.mode === "custom") return "custom";
    return binding.sectionId;
  }

  function setBinding(fieldName: string, value: string, customText?: string) {
    setForm((current) => {
      if (!current) return current;
      const previous = current.dingtalk.bindings[fieldName];
      let binding: FieldBinding;
      if (value === "none") binding = { mode: "none" };
      else if (value === "custom") {
        binding = {
          mode: "custom",
          text: customText ?? (previous?.mode === "custom" ? previous.text : ""),
        };
      } else binding = { mode: "section", sectionId: value };
      return {
        ...current,
        dingtalk: {
          ...current.dingtalk,
          bindings: { ...current.dingtalk.bindings, [fieldName]: binding },
        },
      };
    });
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onCheckedChange,
  title,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
    </label>
  );
}
