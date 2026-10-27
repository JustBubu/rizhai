import { randomUUID } from "node:crypto";
import { beginRequest, errorResponse } from "@/lib/http";
import { toPublicRepo } from "@/lib/public";
import { repoFromInput, type RepoInput } from "@/lib/repo-input";
import { listRepos, saveRepos } from "@/lib/store";

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
    const repos = await listRepos();
    if (repos.length >= 30) throw new Error("最多添加 30 个仓库。");
    const repo = repoFromInput(body, randomUUID());
    repos.push(repo);
    await saveRepos(repos);
    return Response.json({ repo: toPublicRepo(repo) });
  } catch (error) {
    return errorResponse(error);
  }
}
