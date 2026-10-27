"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/client";
import { TIMEZONES } from "@/lib/defaults";
import type { FieldBinding, LogSection, SettingsPublic } from "@/lib/types";

export function SettingsApp() {
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
        if (!cancelled) setError(reason instanceof Error ? reason.message : "设置没有读出来");
      });
    return () => {
      cancelled = true;
    };
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
      toast.error(reason instanceof ApiError ? reason.message : "没有保存");
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
      toast.success(`已读到模板「${data.settings.dingtalk.templateName}」`);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : "没有读到模板");
    } finally {
      setReading(false);
    }
  }

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">{error}</p>;
  }
  if (!form) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">正在读取设置…</p>;
  }

  const generatedId = form.sections.find((section) => section.role === "generated")?.id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="font-serif text-3xl">设置</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          仓库密码和钉钉密钥只写在这台电脑的 data 目录，不会进代码仓库。每天交日志，复制全文就够用；下面的接口是给想一键提交的人准备的。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>我的提交</CardTitle>
          <CardDescription>只看我的时候，按这些 SVN 用户名过滤。大小写不敏感。</CardDescription>
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
            <Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="SVN 用户名" />
            <Button type="submit" variant="outline">
              添加
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {form.myAuthors.length === 0 ? <span className="text-sm text-muted-foreground">还没有。也可以在今天的页面里，点作者名字标成我。</span> : null}
            {form.myAuthors.map((name) => (
              <button
                key={name}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-sm"
                onClick={() => setForm({ ...form, myAuthors: form.myAuthors.filter((item) => item !== name) })}
              >
                {name}
                <XIcon className="size-3" />
                <span className="sr-only">移除</span>
              </button>
            ))}
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <span className="text-sm font-medium">时区</span>
            <Select value={form.timezone} onValueChange={(timezone) => setForm({ ...form, timezone })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Toggle
            checked={form.includeRevision}
            onCheckedChange={(includeRevision) => setForm({ ...form, includeRevision })}
            title="备注后面带上版本号"
            description="例如「修复导出空指针（r1842）」。"
          />
          <Toggle
            checked={form.showEmptyRepos}
            onCheckedChange={(showEmptyRepos) => setForm({ ...form, showEmptyRepos })}
            title="没有提交的仓库也写一行"
            description="日志里会出现「今日无提交」，方便确认每个项目都看过。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>日志栏目</CardTitle>
          <CardDescription>和钉钉模板里的字段用同样的名字，复制进去时不用再对一遍。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {form.sections.map((section, index) => (
            <div key={section.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_9rem_auto]">
              <Input
                aria-label="栏目名称"
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
                  <SelectItem value="generated">由提交生成</SelectItem>
                  <SelectItem value="manual">自己写</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label="上移" disabled={index === 0} onClick={() => moveSection(index, -1)}>
                  <ChevronUpIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="下移"
                  disabled={index === form.sections.length - 1}
                  onClick={() => moveSection(index, 1)}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="删除栏目"
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
                  { id: `s${crypto.randomUUID().slice(0, 8)}`, title: "新栏目", role: "manual" },
                ],
              })
            }
          >
            <PlusIcon />
            加一栏
          </Button>
          {generatedId ? null : <p className="text-sm text-destructive">至少把一栏设成「由提交生成」，否则拉取之后没有地方可填。</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>直接提交到钉钉日志</CardTitle>
          <CardDescription>
            在钉钉开放平台建一个企业内部应用，开通「查询企业员工日志」和「管理员工日志数据」，发布之后把 AppKey、AppSecret 填在这里。userId 在管理后台的通讯录里。模板名称要和日志模板一字不差，很多公司就叫「日报」。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="AppKey">
            <Input value={form.dingtalk.appKey} onChange={(event) => patchDing({ appKey: event.target.value })} spellCheck={false} />
          </Field>
          <Field label="AppSecret" hint={form.dingtalk.hasAppSecret ? "已保存。要更换再填写，留空不会清掉。" : "还没有保存。"}>
            <Input type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} autoComplete="new-password" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="我的 userId">
              <Input value={form.dingtalk.userId} onChange={(event) => patchDing({ userId: event.target.value })} spellCheck={false} />
            </Field>
            <Field label="模板名称">
              <Input value={form.dingtalk.templateName} onChange={(event) => patchDing({ templateName: event.target.value })} />
            </Field>
          </div>
          <Button type="button" variant="outline" className="w-fit" disabled={reading || saving} onClick={() => void readTemplate()}>
            {reading ? "正在读取…" : "保存并读取模板"}
          </Button>
          {form.dingtalk.fields.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">模板编号 {form.dingtalk.templateId}。每个字段对应日志里的哪一栏：</p>
              {form.dingtalk.fields.map((field) => {
                const binding = form.dingtalk.bindings[field.fieldName];
                const value = bindingValue(binding);
                return (
                  <div key={field.fieldName} className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                    <div className="text-sm">
                      <div className="font-medium">{field.fieldName}</div>
                      <div className="text-xs text-muted-foreground">{field.type === 1 ? "文本，可以写入" : "不是文本，接口写不了"}</div>
                    </div>
                    <Select value={value} onValueChange={(next) => setBinding(field.fieldName, next)} disabled={field.type !== 1}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">固定写「无」</SelectItem>
                        {form.sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">自定义一句</SelectItem>
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
            <p className="text-sm text-muted-foreground">还没有模板字段。读取成功之后，才能在今天的页面直接提交。</p>
          )}
          <Toggle
            checked={form.dingtalk.toChat}
            onCheckedChange={(toChat) => patchDing({ toChat })}
            title="提交时给接收人发单聊通知"
            description="关掉的话，日志仍然会写上，只是不额外弹一条聊天消息。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>发到钉钉群</CardTitle>
          <CardDescription>
            这是群机器人，不是个人工作日志。适合再往项目群丢一份相同的文字。如果机器人开了加签，把密钥填上；如果设了关键词，也写在这里。
          </CardDescription>
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
            <Field label="加签密钥" hint={form.dingtalk.hasWebhookSecret ? "已保存，留空则不改。" : ""}>
              <Input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="关键词">
              <Input value={form.dingtalk.webhookKeyword} onChange={(event) => patchDing({ webhookKeyword: event.target.value })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button type="button" size="lg" disabled={saving} onClick={() => void save().then((saved) => saved && toast.success("设置已保存"))}>
          {saving ? "保存中…" : "保存设置"}
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
