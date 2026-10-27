import { beginRequest, errorResponse } from "@/lib/http";
import { isDateKey } from "@/lib/dates";
import { listRepos, loadSettings } from "@/lib/store";
import { ensureSvnInstalled, fetchRepoLog, mapPool } from "@/lib/svn";

export async function POST(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as { date?: string };
    const date = body.date ?? "";
    if (!isDateKey(date)) throw new Error("选择一个有效日期。");
    const [settings, repos] = await Promise.all([loadSettings(), listRepos()]);
    const enabled = repos.filter((repo) => repo.enabled);
    if (enabled.length === 0) throw new Error("还没有可拉取的仓库。先添加一个，并确认它是启用的。");
    await ensureSvnInstalled();
    const logs = await mapPool(enabled, 4, (repo) => fetchRepoLog(repo, date, settings.timezone));
    return Response.json({
      date,
      fetchedAt: new Date().toISOString(),
      repos: logs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
