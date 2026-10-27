import { beginRequest, errorResponse } from "@/lib/http";
import { isDateKey } from "@/lib/dates";
import { loadDraft, saveDraft } from "@/lib/store";
import type { Draft } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await beginRequest();
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!isDateKey(date)) throw new Error("选择一个有效日期。");
    const draft = await loadDraft(date);
    return Response.json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as Partial<Draft>;
    const date = String(body.date ?? "");
    if (!isDateKey(date)) throw new Error("选择一个有效日期。");
    const bodies: Record<string, string> = {};
    for (const [key, value] of Object.entries(body.bodies ?? {})) {
      const id = key.replace(/[^\w-]/g, "").slice(0, 40);
      if (!id) continue;
      bodies[id] = String(value ?? "").slice(0, 8000);
    }
    const excluded = Array.isArray(body.excluded)
      ? body.excluded.map((item) => String(item).slice(0, 80)).slice(0, 500)
      : [];
    const draft: Draft = {
      date,
      bodies,
      excluded,
      lastGenerated: String(body.lastGenerated ?? "").slice(0, 8000),
      updatedAt: new Date().toISOString(),
    };
    await saveDraft(draft);
    return Response.json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}
