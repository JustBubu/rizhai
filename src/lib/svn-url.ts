function allowFileUrl(): boolean {
  return process.env.RIZHAI_ALLOW_SVN_FILE_URL === "1" || process.env.NODE_ENV === "development";
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
  const fileOk = parsed.protocol === "file:" && allowFileUrl();
  const allowed =
    parsed.protocol === "http:" ||
    parsed.protocol === "https:" ||
    parsed.protocol === "svn:" ||
    parsed.protocol === "svn+ssh:" ||
    fileOk;
  if (!allowed) {
    if (parsed.protocol === "file:") {
      throw new Error("默认不允许 file: 地址。若本机仓库确需使用，启动前设置环境变量 RIZHAI_ALLOW_SVN_FILE_URL=1。");
    }
    throw new Error("只支持 http、https、svn、svn+ssh 地址。");
  }
  if (parsed.username || parsed.password) {
    throw new Error("不要把账号密码写进地址，填到用户名和密码栏即可。");
  }
}
