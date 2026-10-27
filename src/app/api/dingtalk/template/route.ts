import { beginRequest, errorResponse } from "@/lib/http";
import { getAccessToken, getTemplateByName, guessBinding } from "@/lib/dingtalk";
import { toPublicSettings } from "@/lib/public";
import { loadSettings, saveSettings } from "@/lib/store";

export async function POST(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as {
      appKey?: string;
      appSecret?: string;
      userId?: string;
      templateName?: string;
    };
    const current = await loadSettings();
    const appKey = (body.appKey ?? current.dingtalk.appKey).trim();
    const appSecret = body.appSecret?.trim() || current.dingtalk.appSecret;
    const userId = (body.userId ?? current.dingtalk.userId).trim();
    const templateName = (body.templateName ?? current.dingtalk.templateName).trim();
    if (!appKey || !appSecret || !userId || !templateName) {
      throw new Error("先填 AppKey、AppSecret、你的 userId，以及日志模板名称。");
    }
    const token = await getAccessToken(appKey, appSecret);
    const template = await getTemplateByName(token, userId, templateName);
    if (!template.id) throw new Error("钉钉没有返回模板编号。");
    const bindings = { ...current.dingtalk.bindings };
    for (const field of template.fields) {
      if (!bindings[field.fieldName]) bindings[field.fieldName] = guessBinding(field.fieldName, current.sections);
    }
    const next = {
      ...current,
      dingtalk: {
        ...current.dingtalk,
        appKey,
        appSecret,
        userId,
        templateName: template.name || templateName,
        templateId: template.id,
        fields: template.fields,
        bindings,
      },
    };
    await saveSettings(next);
    return Response.json({ settings: toPublicSettings(next) });
  } catch (error) {
    return errorResponse(error);
  }
}
