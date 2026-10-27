import { createHmac } from "node:crypto";
import type { DingField, FieldBinding, LogSection } from "@/lib/types";

type TokenResponse = {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
};

type DingResponse = {
  errcode?: number;
  errmsg?: string;
  result?: unknown;
};

const DING_CHAR_LIMIT = 1000;
const DING_FETCH_MS = 15_000;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function dingCharLimit(): number {
  return DING_CHAR_LIMIT;
}

/** 测试或密钥轮换时清空缓存。 */
export function clearAccessTokenCache(): void {
  tokenCache.clear();
}

async function dingFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(DING_FETCH_MS) });
}

async function dingPost(path: string, token: string, body: unknown): Promise<DingResponse> {
  const response = await dingFetch(
    `https://oapi.dingtalk.com${path}?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = (await response.json()) as DingResponse;
  if (!response.ok || (data.errcode && data.errcode !== 0)) {
    throw new Error(data.errmsg || `钉钉接口返回 ${response.status}`);
  }
  return data;
}

export async function getAccessToken(appKey: string, appSecret: string): Promise<string> {
  const cacheKey = `${appKey}\0${appSecret}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const url = new URL("https://oapi.dingtalk.com/gettoken");
  url.searchParams.set("appkey", appKey);
  url.searchParams.set("appsecret", appSecret);
  const response = await dingFetch(url.toString());
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || data.errcode || !data.access_token) {
    throw new Error(data.errmsg || "拿不到钉钉 access_token，请核对 AppKey 和 AppSecret。");
  }
  const ttlMs = Math.max(60, Number(data.expires_in ?? 7200)) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs });
  return data.access_token;
}

export async function getTemplateByName(token: string, userId: string, templateName: string) {
  const data = await dingPost("/topapi/report/template/getbyname", token, {
    userid: userId,
    template_name: templateName,
  });
  const result = data.result as {
    id?: string;
    name?: string;
    fields?: { field_name?: string; sort?: number; type?: number }[];
  };
  const fields: DingField[] = (result.fields ?? [])
    .filter((field) => field.field_name)
    .map((field) => ({
      fieldName: String(field.field_name),
      sort: Number(field.sort ?? 0),
      type: Number(field.type ?? 1),
    }));
  return {
    id: String(result.id ?? ""),
    name: String(result.name ?? templateName),
    fields,
  };
}

export function guessBinding(fieldName: string, sections: LogSection[]): FieldBinding {
  const exact = sections.find((section) => section.title === fieldName);
  if (exact) return { mode: "section", sectionId: exact.id };
  const rules: [RegExp, RegExp][] = [
    [/未完成|待办/, /未完成|待办/],
    [/协调|协助|问题/, /协调|协助|问题/],
    [/明日|计划/, /明日|计划/],
  ];
  for (const [fieldRule, sectionRule] of rules) {
    if (!fieldRule.test(fieldName)) continue;
    const section = sections.find((item) => sectionRule.test(item.title));
    if (section) return { mode: "section", sectionId: section.id };
  }
  // 「未完成」含「完成」，须在上面的规则之后再匹配今日完成类字段。
  if (/今日|工作内容/.test(fieldName) || (/完成/.test(fieldName) && !/未完成/.test(fieldName))) {
    const generated = sections.find((section) => section.role === "generated");
    if (generated) return { mode: "section", sectionId: generated.id };
  }
  return { mode: "none" };
}

export function contentForField(
  binding: FieldBinding | undefined,
  sections: { id: string; body: string }[],
): string {
  if (!binding || binding.mode === "none") return "无";
  if (binding.mode === "custom") return binding.text.trim() || "无";
  const section = sections.find((item) => item.id === binding.sectionId);
  return section?.body.trim() || "无";
}

export async function createReport(input: {
  token: string;
  userId: string;
  templateId: string;
  fields: DingField[];
  contents: { key: string; sort: number; type: number; content: string }[];
  toChat: boolean;
}): Promise<string> {
  const unsupported = input.fields.filter((field) => field.type !== 1);
  const data = await dingPost("/topapi/report/create", input.token, {
    create_report_param: {
      userid: input.userId,
      template_id: input.templateId,
      to_chat: input.toChat,
      dd_from: "rizhai",
      contents: input.contents.map((item) => ({
        sort: item.sort,
        type: item.type,
        content_type: "markdown",
        content: item.content,
        key: item.key,
      })),
    },
  });
  const skipped = unsupported.map((field) => field.fieldName);
  const id = typeof data.result === "string" ? data.result : "";
  return skipped.length > 0
    ? `已提交。这些字段不是文本，接口写不了，已跳过：${skipped.join("、")}。日志编号 ${id}`
    : `已提交到钉钉日志${id ? `（${id}）` : ""}。`;
}

export function signWebhook(webhook: string, secret: string): string {
  const url = new URL(webhook);
  if (!secret) return url.toString();
  const timestamp = Date.now();
  const sign = encodeURIComponent(
    createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64"),
  );
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  return url.toString();
}

export async function sendWebhook(input: {
  webhook: string;
  secret: string;
  keyword: string;
  title: string;
  text: string;
}): Promise<void> {
  const url = signWebhook(input.webhook, input.secret);
  const keyword = input.keyword.trim();
  const text = keyword && !input.text.includes(keyword) ? `${keyword}\n\n${input.text}` : input.text;
  const response = await dingFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { title: input.title, text },
    }),
  });
  const data = (await response.json()) as { errcode?: number; errmsg?: string };
  if (!response.ok || (data.errcode && data.errcode !== 0)) {
    throw new Error(data.errmsg || "群机器人没有收下这条消息。");
  }
}

export function overLimit(content: string): boolean {
  return Array.from(content).length > DING_CHAR_LIMIT;
}
