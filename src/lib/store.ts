import { promises as fs } from "node:fs";
import path from "node:path";
import { mergeSettings } from "@/lib/defaults";
import { isDateKey } from "@/lib/dates";
import type { Draft, Repo, Settings } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(relativePath: string, data: unknown): Promise<void> {
  const file = path.join(DATA_DIR, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

export async function listRepos(): Promise<Repo[]> {
  return (await readJson<Repo[]>("repos.json")) ?? [];
}

export async function saveRepos(repos: Repo[]): Promise<void> {
  await writeJson("repos.json", repos);
}

export async function loadSettings(): Promise<Settings> {
  return mergeSettings(await readJson<Partial<Settings>>("settings.json"));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJson("settings.json", settings);
}

export function emptyDraft(date: string): Draft {
  return { date, bodies: {}, excluded: [], lastGenerated: "", updatedAt: "" };
}

export async function loadDraft(date: string): Promise<Draft> {
  if (!isDateKey(date)) throw new Error("日期格式应为 YYYY-MM-DD");
  return (await readJson<Draft>(`drafts/${date}.json`)) ?? emptyDraft(date);
}

export async function saveDraft(draft: Draft): Promise<void> {
  if (!isDateKey(draft.date)) throw new Error("日期格式应为 YYYY-MM-DD");
  await writeJson(`drafts/${draft.date}.json`, draft);
}
