import { spawn } from "node:child_process";
import { dateInTimezone, svnRevisionRange } from "@/lib/dates";
import { parseSvnXml } from "@/lib/parse-svn";
import type { Commit, Repo, RepoLog } from "@/lib/types";

const STDOUT_LIMIT = 8_000_000;

type SvnResult = { code: number; stdout: string; stderr: string };

function runSvn(args: string[], timeoutMs: number): Promise<SvnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("svn", args, {
      env: { ...process.env, LC_ALL: "C.UTF-8", LANG: "C.UTF-8" },
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
          reject(new Error("这台电脑没有 svn 命令。macOS 用 brew install subversion，Ubuntu 用 sudo apt install subversion。装好之前，可以先把 svn log 的文本粘贴进来。"));
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

export function humanizeSvnError(stderr: string): string {
  const text = stderr.trim();
  if (/E215004|E170001|Authentication failed|authorization failed|Username/i.test(text)) {
    return "SVN 拒绝了登录。核对用户名和密码，或改成使用本机已经保存的凭据。";
  }
  if (/E170013|timed out|Connection refused|Unable to connect|E170000/i.test(text)) {
    return "连不上这个仓库。确认地址是否正确，以及这台电脑有没有连上公司网络。";
  }
  if (/E160013|E200009|non-existent|not found/i.test(text)) {
    return "地址下面没有这个路径。试着指到 trunk，或你们实际在提交的分支。";
  }
  const line = text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  return (line ?? "拉取失败").replace(/^svn:\s*/i, "");
}

export function assertRepoUrl(url: string): void {
  const trimmed = url.trim();
  if (/[\r\n\0]/.test(trimmed)) throw new Error("地址里不能有换行。");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("仓库地址无法识别。示例：https://svn.company.com/repos/order/trunk");
  }
  const allowed = parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "svn:" || parsed.protocol === "svn+ssh:" || parsed.protocol === "file:";
  if (!allowed) throw new Error("只支持 http、https、svn、svn+ssh 和 file 地址。");
  if (parsed.username || parsed.password) {
    throw new Error("不要把账号密码写进地址，填到用户名和密码栏即可。");
  }
}

export async function ensureSvnInstalled(): Promise<void> {
  const result = await runSvn(["--version", "--quiet"], 8_000);
  if (result.code !== 0) throw new Error("svn 命令无法运行。");
}

export async function fetchRepoLog(repo: Repo, date: string, timezone: string): Promise<RepoLog> {
  const started = Date.now();
  try {
    assertRepoUrl(repo.url);
    const args = [
      "log",
      repo.url.trim(),
      "--xml",
      "-v",
      "-r",
      svnRevisionRange(date, timezone),
      "--non-interactive",
      "--trust-server-cert-failures",
      "unknown-ca,cn-mismatch,expired,not-yet-valid,other",
    ];
    if (!repo.useSavedAuth) {
      if (!repo.username.trim()) {
        throw new Error("填写用户名和密码，或改用本机已保存的 SVN 凭据。");
      }
      args.push("--username", repo.username, "--password", repo.password, "--no-auth-cache");
    }
    const result = await runSvn(args, 40_000);
    if (result.code !== 0) throw new Error(humanizeSvnError(result.stderr));
    const commits = parseSvnXml(result.stdout)
      .filter((commit) => dateInTimezone(commit.date, timezone) === date)
      .sort(compareCommits);
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
