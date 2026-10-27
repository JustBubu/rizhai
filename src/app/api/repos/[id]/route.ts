import { beginRequest, errorResponse } from "@/lib/http";
import { toPublicRepo } from "@/lib/public";
import { repoFromInput, type RepoInput } from "@/lib/repo-input";
import { listRepos, saveRepos } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

function assertId(id: string) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("仓库编号不正确。");
}

export async function PATCH(request: Request, context: Context) {
  try {
    await beginRequest();
    const { id } = await context.params;
    assertId(id);
    const body = (await request.json()) as RepoInput;
    const repos = await listRepos();
    const index = repos.findIndex((repo) => repo.id === id);
    if (index < 0) return errorResponse(new Error("找不到这个仓库。"), 404);
    const current = repos[index];
    const next = repoFromInput(
      {
        name: body.name ?? current.name,
        url: body.url ?? current.url,
        username: body.username ?? current.username,
        password: body.password,
        useSavedAuth: body.useSavedAuth ?? current.useSavedAuth,
        enabled: body.enabled ?? current.enabled,
      },
      id,
      current,
    );
    repos[index] = next;
    await saveRepos(repos);
    return Response.json({ repo: toPublicRepo(next) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await beginRequest();
    const { id } = await context.params;
    assertId(id);
    const repos = await listRepos();
    const next = repos.filter((repo) => repo.id !== id);
    if (next.length === repos.length) return errorResponse(new Error("找不到这个仓库。"), 404);
    await saveRepos(next);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
