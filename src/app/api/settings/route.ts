import { beginRequest, errorResponse } from "@/lib/http";
import { toPublicSettings } from "@/lib/public";
import { isTimezone } from "@/lib/dates";
import { loadSettings, saveSettings } from "@/lib/store";
import type { FieldBinding, LogSection, Settings } from "@/lib/types";

type Incoming = Partial<Omit<Settings, "dingtalk">> & {
  dingtalk?: Partial<Settings["dingtalk"]> & { appSecret?: string; webhookSecret?: string };
};

function cleanAuthors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const authors: string[] = [];
  for (const item of value) {
    const name = String(item ?? "").replace(/[\r\n\0]/g, "").trim().slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    authors.push(name);
  }
  return authors.slice(0, 20);
}

function cleanSections(value: unknown, fallback: LogSection[]): LogSection[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const sections: LogSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; title?: unknown; role?: unknown };
    const id = String(record.id ?? "").replace(/[^\w-]/g, "").slice(0, 40);
    const title = String(record.title ?? "").replace(/[\r\n\0]/g, "").trim().slice(0, 30);
    if (!id || !title) continue;
    sections.push({ id, title, role: record.role === "generated" ? "generated" : "manual" });
  }
  if (sections.length === 0) return fallback;
  let seenGenerated = false;
  return sections.map((section) => {
    if (section.role !== "generated") return section;
    if (seenGenerated) return { ...section, role: "manual" };
    seenGenerated = true;
    return section;
  });
}

function cleanBinding(value: unknown): FieldBinding {
  if (!value || typeof value !== "object") return { mode: "none" };
  const record = value as { mode?: unknown; sectionId?: unknown; text?: unknown };
  if (record.mode === "section") {
    const sectionId = String(record.sectionId ?? "").replace(/[^\w-]/g, "").slice(0, 40);
    return sectionId ? { mode: "section", sectionId } : { mode: "none" };
  }
  if (record.mode === "custom") {
    return { mode: "custom", text: String(record.text ?? "").slice(0, 1000) };
  }
  return { mode: "none" };
}

export async function GET() {
  try {
    await beginRequest();
    const settings = await loadSettings();
    return Response.json({ settings: toPublicSettings(settings) });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as Incoming;
    const current = await loadSettings();
    const timezone = typeof body.timezone === "string" && isTimezone(body.timezone) ? body.timezone : current.timezone;
    const incomingDing = body.dingtalk ?? {};
    const appSecret =
      typeof incomingDing.appSecret === "string" && incomingDing.appSecret.length > 0
        ? incomingDing.appSecret
        : current.dingtalk.appSecret;
    const webhookSecret =
      typeof incomingDing.webhookSecret === "string" && incomingDing.webhookSecret.length > 0
        ? incomingDing.webhookSecret
        : current.dingtalk.webhookSecret;
    const fields = Array.isArray(incomingDing.fields) ? incomingDing.fields : current.dingtalk.fields;
    const bindings: Settings["dingtalk"]["bindings"] = {};
    const source = incomingDing.bindings ?? current.dingtalk.bindings;
    for (const [key, binding] of Object.entries(source)) {
      bindings[key.slice(0, 40)] = cleanBinding(binding);
    }
    const next: Settings = {
      myAuthors: body.myAuthors === undefined ? current.myAuthors : cleanAuthors(body.myAuthors),
      timezone,
      includeRevision: body.includeRevision ?? current.includeRevision,
      showEmptyRepos: body.showEmptyRepos ?? current.showEmptyRepos,
      logMode: body.logMode === "team" ? "team" : body.logMode === "personal" ? "personal" : current.logMode,
      onlyMine: body.onlyMine ?? current.onlyMine,
      sections: body.sections === undefined ? current.sections : cleanSections(body.sections, current.sections),
      dingtalk: {
        appKey: String(incomingDing.appKey ?? current.dingtalk.appKey).trim().slice(0, 120),
        appSecret,
        userId: String(incomingDing.userId ?? current.dingtalk.userId).trim().slice(0, 80),
        templateName: String(incomingDing.templateName ?? current.dingtalk.templateName).trim().slice(0, 40) || "日报",
        templateId: String(incomingDing.templateId ?? current.dingtalk.templateId).trim().slice(0, 80),
        fields: fields
          .filter((field) => field && field.fieldName)
          .slice(0, 20)
          .map((field) => ({
            fieldName: String(field.fieldName).slice(0, 40),
            sort: Number(field.sort ?? 0),
            type: Number(field.type ?? 1),
          })),
        bindings,
        toChat: incomingDing.toChat ?? current.dingtalk.toChat,
        webhook: String(incomingDing.webhook ?? current.dingtalk.webhook).trim().slice(0, 500),
        webhookSecret,
        webhookKeyword: String(incomingDing.webhookKeyword ?? current.dingtalk.webhookKeyword).trim().slice(0, 40),
      },
    };
    if (next.dingtalk.webhook && !next.dingtalk.webhook.startsWith("https://oapi.dingtalk.com/robot/send")) {
      throw new Error("群机器人地址应以 https://oapi.dingtalk.com/robot/send 开头。");
    }
    await saveSettings(next);
    return Response.json({ settings: toPublicSettings(next) });
  } catch (error) {
    return errorResponse(error);
  }
}
