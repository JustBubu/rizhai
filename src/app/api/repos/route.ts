import { randomUUID } from "node:crypto";
import { beginRequest, errorResponse } from "@/lib/http";
import { toPublicRepo } from "@/lib/public";
import { repoFromInput, type RepoInput } from "@/lib/repo-input";
import { listRepos, updateRepos } from "@/lib/store";

export async function GET() {
  try {
    await beginRequest();
    const repos = await listRepos();
    return Response.json({ repos: repos.map(toPublicRepo) });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    await beginRequest();
    const body = (await request.json()) as RepoInput;
    let created = null as ReturnType<typeof repoFromInput> | null;
    await updateRepos((repos) => {
      if (repos.length >= 30) throw new Error("最多添加 30 个仓库。");
      created = repoFromInput(body, randomUUID());
      return [...repos, created];
    });
    return Response.json({ repo: toPublicRepo(created!) });
  } catch (error) {
    return errorResponse(error);
  }
}
