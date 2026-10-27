import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { dateInTimezone, svnRevisionRange } from "@/lib/dates";
import { parseSvnXml } from "@/lib/parse-svn";
import { assertRepoUrl, humanizeSvnError } from "@/lib/svn-url";
import type { Commit, Repo, RepoLog } from "@/lib/types";

export { assertRepoUrl, humanizeSvnError } from "@/lib/svn-url";

const STDOUT_LIMIT = 8_000_000;
/** 默认只信任「未知 CA」（常见于公司内网）。可用环境变量 RIZHAI_SVN_TRUST_CERT 覆盖。 */
const DEFAULT_TRUST = "unknown-ca";

type SvnResult = { code: number; stdout: string; stderr: string };

function trustFailures(): string {
  const raw = process.env.RIZHAI_SVN_TRUST_CERT?.trim();
  if (raw === "" || raw === "none") return "";
  return raw || DEFAULT_TRUST;
}

function runSvn(args: string[], timeoutMs: number): Promise<SvnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("svn", args, {
      env: { ...process.env, LC_ALL: "C.UTF-8", LANG: "C.UTF-8" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() =>
        reject(new Error("SVN 超过 40 秒没有返回。多半是网络不通，或仓库还在等你输入密码。")),
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > STDOUT_LIMIT) {
        child.kill("SIGKILL");
        finish(() =>
          reject(new Error("返回的日志太大。把地址指到具体项目（例如 trunk），不要指到整个总库。")),
        );
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(() => {
        if (error.code === "ENOENT") {
          reject(
            new Error(
              "这台电脑没有 svn 命令。Windows 可安装 TortoiseSVN（勾选 command line tools）或 SlikSVN，并确保 svn 在 PATH 里；macOS 用 brew install subversion；Ubuntu 用 sudo apt install subversion。装好之前，可以先把 svn log 的文本粘贴进来。",
            ),
          );
          return;
        }
        reject(error);
      });
    });
    child.on("close", (code) => {
      finish(() => resolve({ code: code ?? 1, stdout, stderr }));
    });
  });
}

export async function ensureSvnInstalled(): Promise<void> {
  const result = await runSvn(["--version", "--quiet"], 8_000);
  if (result.code !== 0) throw new Error("svn 命令无法运行。");
}

/**
 * 用临时 --config-dir 承接认证，避免把密码写进本机默认 SVN 缓存。
 * SVN 本身仍要求命令行带 --password；更稳妥的做法是勾选「使用本机已保存凭据」。
 */
async function withConfigDir<T>(work: (configDir: string) => Promise<T>): Promise<T> {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "rizhai-svn-"));
  try {
    await fs.writeFile(
      path.join(configDir, "config"),
      "[auth]\npassword-stores =\nstore-passwords = no\nstore-auth-creds = no\n",
      { encoding: "utf8", mode: 0o600 },
    );
    return await work(configDir);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function buildLogArgs(repo: Repo, date: string, timezone: string, configDir?: string): string[] {
  const args = [
    "log",
    repo.url.trim(),
    "--xml",
    "-v",
    "-r",
    svnRevisionRange(date, timezone),
    "--non-interactive",
  ];
  const trust = trustFailures();
  if (trust) {
    args.push("--trust-server-cert-failures", trust);
  }
  if (configDir) {
    args.push("--config-dir", configDir);
  }
  if (!repo.useSavedAuth) {
    if (!repo.username.trim()) {
      throw new Error("填写用户名和密码，或改用本机已保存的 SVN 凭据。");
    }
    // 临时 config-dir + --no-auth-cache：密码仍会出现在进程参数里（SVN 限制）。
    // 共享机器请优先勾选「使用本机已保存凭据」。
    args.push("--username", repo.username, "--password", repo.password, "--no-auth-cache");
  }
  return args;
}

export async function fetchRepoLog(repo: Repo, date: string, timezone: string): Promise<RepoLog> {
  const started = Date.now();
  try {
    assertRepoUrl(repo.url);
    const run = async (configDir?: string) => {
      const result = await runSvn(buildLogArgs(repo, date, timezone, configDir), 40_000);
      if (result.code !== 0) throw new Error(humanizeSvnError(result.stderr));
      return parseSvnXml(result.stdout)
        .filter((commit) => dateInTimezone(commit.date, timezone) === date)
        .sort(compareCommits);
    };
    // 使用本机凭据时必须读默认 ~/.subversion，不能换临时 config-dir。
    const commits = repo.useSavedAuth ? await run() : await withConfigDir((dir) => run(dir));
    return {
      repoId: repo.id,
      name: repo.name,
      url: repo.url,
      ok: true,
      commits,
      elapsedMs: Date.now() - started,
      source: "svn",
    };
  } catch (error) {
    return {
      repoId: repo.id,
      name: repo.name,
      url: repo.url,
      ok: false,
      error: error instanceof Error ? error.message : "拉取失败",
      commits: [],
      elapsedMs: Date.now() - started,
      source: "svn",
    };
  }
}

function compareCommits(a: Commit, b: Commit): number {
  const time = Date.parse(a.date) - Date.parse(b.date);
  if (time !== 0 && !Number.isNaN(time)) return time;
  return Number(a.revision) - Number(b.revision);
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  const count = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: count }, () => run()));
  return results;
}
