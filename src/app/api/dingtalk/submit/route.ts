import { beginRequest, errorResponse } from "@/lib/http";
import { contentForField, createReport, getAccessToken, overLimit } from "@/lib/dingtalk";
import { loadSettings } from "@/lib/store";

type SectionBody = { id: string; body: string };

export async function POST(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as { sections?: SectionBody[] };
    const sections = Array.isArray(body.sections) ? body.sections : [];
    const settings = await loadSettings();
    const ding = settings.dingtalk;
    if (!ding.appKey || !ding.appSecret || !ding.userId) {
      throw new Error("还没有配置钉钉应用。到设置里填 AppKey、AppSecret 和 userId。");
    }
    if (!ding.templateId || ding.fields.length === 0) {
      throw new Error("还没有读取日志模板。到设置里填模板名称（比如「日报」）并读取。");
    }
    const textFields = ding.fields.filter((field) => field.type === 1);
    if (textFields.length === 0) throw new Error("这个模板里没有文本字段，接口无法写入。");
    const contents = textFields.map((field) => {
      const content = contentForField(ding.bindings[field.fieldName], sections);
      return { key: field.fieldName, sort: field.sort, type: field.type, content };
    });
    const tooLong = contents.find((item) => overLimit(item.content));
    if (tooLong) {
      throw new Error(`「${tooLong.key}」超过 1000 字，钉钉接口会截断。请精简，或改用复制后到钉钉里粘贴。`);
    }
    const token = await getAccessToken(ding.appKey, ding.appSecret);
    const message = await createReport({
      token,
      userId: ding.userId,
      templateId: ding.templateId,
      fields: ding.fields,
      contents,
      toChat: ding.toChat,
    });
    return Response.json({ message });
  } catch (error) {
    return errorResponse(error);
  }
}
