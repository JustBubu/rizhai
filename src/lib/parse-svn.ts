import { XMLParser } from "fast-xml-parser";
import type { Commit, CommitPath } from "@/lib/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName) => tagName === "logentry" || tagName === "path",
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const record = node as Record<string, unknown>;
  const text = record["#text"] ?? record.__text;
  return text == null ? "" : String(text);
}

function pathOf(node: unknown): CommitPath | null {
  if (typeof node === "string") return { action: "", path: node };
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const path = textOf(record) || String(record.path ?? "");
  if (!path.trim()) return null;
  return { action: String(record.action ?? ""), path: path.trim() };
}

export function parseSvnXml(xml: string): Commit[] {
  const trimmed = xml.trim();
  if (!trimmed) return [];
  let doc: unknown;
  try {
    doc = parser.parse(trimmed);
  } catch {
    throw new Error("SVN 返回的日志不是合法的 XML。");
  }
  const log = (doc as { log?: { logentry?: unknown } } | null)?.log;
  const entries = asArray(log?.logentry as Record<string, unknown> | Record<string, unknown>[]);
  return entries
    .map((entry) => {
      const pathsNode = (entry.paths as { path?: unknown } | undefined)?.path;
      const paths = asArray(pathsNode)
        .map(pathOf)
        .filter((item): item is CommitPath => item != null);
      const message = textOf(entry.msg ?? "").replace(/\r\n/g, "\n");
      return {
        revision: String(entry.revision ?? "").replace(/^r/i, ""),
        author: textOf(entry.author).trim() || "未知作者",
        date: textOf(entry.date).trim(),
        message,
        paths,
      };
    })
    .filter((commit) => commit.revision);
}

const SEPARATOR = /^-{10,}\s*$/;
const HEADER =
  /^r(\d+)\s+\|\s*(.*?)\s+\|\s*(.*?)\s+\|\s*(\d+)\s+(?:lines?|行)\s*$/i;

function parseHeaderDate(raw: string): string {
  const match = raw.match(
    /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/,
  );
  if (!match) return raw;
  const [, date, time, zone] = match;
  const isoZone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const ms = Date.parse(`${date}T${time}${isoZone}`);
  if (Number.isNaN(ms)) return raw;
  return new Date(ms).toISOString();
}

/** 解析 `svn log` 纯文本。带 Changed paths 的 -v 输出也可以。 */
export function parseSvnLogText(text: string): Commit[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const commits: Commit[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!SEPARATOR.test(lines[index] ?? "")) continue;
    const header = lines[index + 1] ?? "";
    const match = HEADER.exec(header);
    if (!match) continue;

    let cursor = index + 2;
    const paths: CommitPath[] = [];
    const pathLabel = (lines[cursor] ?? "").trim().toLowerCase();
    if (pathLabel === "changed paths:" || pathLabel === "改变的路径:") {
      cursor += 1;
      while (cursor < lines.length && (lines[cursor] ?? "").trim() !== "") {
        const pathMatch = /^\s+([ADMR])\s+(\S.*)$/.exec(lines[cursor] ?? "");
        if (pathMatch) paths.push({ action: pathMatch[1], path: pathMatch[2].trim() });
        cursor += 1;
      }
    }
    if ((lines[cursor] ?? "").trim() === "") cursor += 1;

    const lineCount = Number(match[4]);
    const message = lines.slice(cursor, cursor + lineCount).join("\n");
    commits.push({
      revision: match[1],
      author: match[2].trim() || "未知作者",
      date: parseHeaderDate(match[3].trim()),
      message,
      paths,
    });
    index = cursor + lineCount - 1;
  }

  return commits;
}

export function parseSvnLog(input: string): Commit[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.includes("<logentry") || trimmed.startsWith("<log")) {
    return parseSvnXml(trimmed);
  }
  return parseSvnLogText(trimmed);
}
