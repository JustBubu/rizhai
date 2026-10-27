import { beginRequest, errorResponse } from "@/lib/http";
import { toPublicRepo } from "@/lib/public";
import { repoFromInput, type RepoInput } from "@/lib/repo-input";
import { updateRepos } from "@/lib/store";
import type { Repo } from "@/lib/types";

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
    let updated: Repo | null = null;
    await updateRepos((repos) => {
      const index = repos.findIndex((repo) => repo.id === id);
      if (index < 0) throw new Error("找不到这个仓库。");
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
      updated = next;
      const copy = repos.slice();
      copy[index] = next;
      return copy;
    });
    return Response.json({ repo: toPublicRepo(updated!) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return errorResponse(error, message === "找不到这个仓库。" ? 404 : 400);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await beginRequest();
    const { id } = await context.params;
    assertId(id);
    let found = false;
    await updateRepos((repos) => {
      const next = repos.filter((repo) => repo.id !== id);
      found = next.length !== repos.length;
      if (!found) throw new Error("找不到这个仓库。");
      return next;
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return errorResponse(error, message === "找不到这个仓库。" ? 404 : 400);
  }
}
