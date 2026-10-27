import { promises as fs } from "node:fs";
import path from "node:path";
import { mergeSettings } from "@/lib/defaults";
import { isDateKey } from "@/lib/dates";
import { withLock } from "@/lib/file-lock";
import type { Draft, Repo, Settings } from "@/lib/types";

export function dataDir(): string {
  return process.env.RIZHAI_DATA_DIR
    ? path.resolve(process.env.RIZHAI_DATA_DIR)
    : path.join(process.cwd(), "data");
}

async function readJson<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(dataDir(), relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(relativePath: string, data: unknown): Promise<void> {
  const file = path.join(dataDir(), relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

export async function listRepos(): Promise<Repo[]> {
  return withLock("repos.json", async () => (await readJson<Repo[]>("repos.json")) ?? []);
}

export async function saveRepos(repos: Repo[]): Promise<void> {
  await withLock("repos.json", () => writeJson("repos.json", repos));
}

/** 在同一把锁里读改写，避免并发 PATCH/POST 互相覆盖。 */
export async function updateRepos(mutator: (repos: Repo[]) => Repo[] | Promise<Repo[]>): Promise<Repo[]> {
  return withLock("repos.json", async () => {
    const current = (await readJson<Repo[]>("repos.json")) ?? [];
    const next = await mutator(current);
    await writeJson("repos.json", next);
    return next;
  });
}

export async function loadSettings(): Promise<Settings> {
  return withLock("settings.json", async () => mergeSettings(await readJson<Partial<Settings>>("settings.json")));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await withLock("settings.json", () => writeJson("settings.json", settings));
}

export async function updateSettings(
  mutator: (settings: Settings) => Settings | Promise<Settings>,
): Promise<Settings> {
  return withLock("settings.json", async () => {
    const current = mergeSettings(await readJson<Partial<Settings>>("settings.json"));
    const next = await mutator(current);
    await writeJson("settings.json", next);
    return next;
  });
}

export function emptyDraft(date: string): Draft {
  return { date, bodies: {}, excluded: [], lastGenerated: "", updatedAt: "" };
}

export async function loadDraft(date: string): Promise<Draft> {
  if (!isDateKey(date)) throw new Error("日期格式应为 YYYY-MM-DD");
  return withLock(`drafts/${date}.json`, async () => (await readJson<Draft>(`drafts/${date}.json`)) ?? emptyDraft(date));
}

export async function saveDraft(draft: Draft): Promise<void> {
  if (!isDateKey(draft.date)) throw new Error("日期格式应为 YYYY-MM-DD");
  await withLock(`drafts/${draft.date}.json`, () => writeJson(`drafts/${draft.date}.json`, draft));
}
