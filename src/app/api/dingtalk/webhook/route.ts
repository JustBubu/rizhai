import { beginRequest, errorResponse } from "@/lib/http";
import { sendWebhook } from "@/lib/dingtalk";
import { formatLongDate } from "@/lib/dates";
import { loadSettings } from "@/lib/store";

export async function POST(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as { text?: string; date?: string };
    const text = String(body.text ?? "").trim();
    if (!text) throw new Error("日志还是空的。");
    const settings = await loadSettings();
    const webhook = settings.dingtalk.webhook.trim();
    if (!webhook) throw new Error("还没有填写群机器人地址。到设置里贴上 Webhook。");
    const title = body.date ? `${formatLongDate(body.date)}工作日志` : "工作日志";
    await sendWebhook({
      webhook,
      secret: settings.dingtalk.webhookSecret,
      keyword: settings.dingtalk.webhookKeyword,
      title,
      text,
    });
    return Response.json({ message: "已发到钉钉群。" });
  } catch (error) {
    return errorResponse(error);
  }
}
