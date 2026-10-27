import assert from "node:assert/strict";
import test from "node:test";
import { calendarDate, dateInTimezone, formatClock, shiftDate, svnRevisionRange } from "../src/lib/dates.ts";
import { parseSvnLogText, parseSvnXml } from "../src/lib/parse-svn.ts";
import { buildTodayWork, commitKey, composeFullLog } from "../src/lib/summarize.ts";
import type { RepoLog } from "../src/lib/types.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="12">
<author>zhangsan</author>
<date>2026-10-26T17:30:12.000000Z</date>
<paths>
<path action="M" kind="file">/trunk/src/Order.java</path>
<path action="A" kind="file">/trunk/src/OrderTest.java</path>
</paths>
<msg>修复导出时空金额
空值按 0 处理</msg>
</logentry>
<logentry revision="9">
<author>lisi</author>
<date>2026-10-25T10:00:00.000000Z</date>
<paths></paths>
<msg>昨天的提交</msg>
</logentry>
</log>`;

test("svn xml keeps message text and paths", () => {
  const commits = parseSvnXml(XML);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].revision, "12");
  assert.equal(commits[0].author, "zhangsan");
  assert.match(commits[0].message, /空值按 0/);
  assert.deepEqual(commits[0].paths.map((item) => item.action), ["M", "A"]);
  assert.equal(dateInTimezone(commits[0].date, "+08:00"), "2026-10-27");
  assert.equal(formatClock(commits[0].date, "+08:00"), "01:30");
  assert.equal(dateInTimezone(commits[1].date, "+08:00"), "2026-10-25");
});

test("plain svn log understands changed paths and line counts", () => {
  const text = [
    "------------------------------------------------------------------------",
    "r15 | wangwu | 2026-10-27 09:12:03 +0800 (Mon, 27 Oct 2026) | 2 lines",
    "Changed paths:",
    "   M /trunk/a.java",
    "   A /trunk/b.java",
    "",
    "补齐空值判断",
    "顺便改了提示文案",
    "------------------------------------------------------------------------",
    "r14 | wangwu | 2026-10-26 18:01:00 +0800 (Sun, 26 Oct 2026) | 1 line",
    "",
    "昨天",
    "------------------------------------------------------------------------",
  ].join("\n");
  const commits = parseSvnLogText(text);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].message, "补齐空值判断\n顺便改了提示文案");
  assert.equal(commits[0].paths.length, 2);
  assert.equal(dateInTimezone(commits[0].date, "+08:00"), "2026-10-27");
  assert.equal(dateInTimezone(commits[1].date, "+08:00"), "2026-10-26");

  const chinese = [
    "------------------------------------------------------------------------",
    "r8 | zhangsan | 2026-10-27 14:02:11 +0800 (周一, 27 10月 2026) | 1 行",
    "改变的路径:",
    "   M /trunk/src/Pay.java",
    "",
    "支付回调增加幂等判断",
    "------------------------------------------------------------------------",
  ].join("\n");
  const localized = parseSvnLogText(chinese);
  assert.equal(localized.length, 1);
  assert.equal(localized[0].message, "支付回调增加幂等判断");
  assert.equal(localized[0].paths[0]?.path, "/trunk/src/Pay.java");
});

test("summary groups projects and can hide other people", () => {
  const repos: RepoLog[] = [
    {
      repoId: "order",
      name: "订单中心",
      url: "https://svn.example.com/order",
      ok: true,
      elapsedMs: 1,
      source: "svn",
      commits: [
        {
          revision: "3",
          author: "zhangsan",
          date: "2026-10-27T01:00:00.000Z",
          message: "修复导出",
          paths: [],
        },
        {
          revision: "4",
          author: "lisi",
          date: "2026-10-27T02:00:00.000Z",
          message: "改文案",
          paths: [],
        },
      ],
    },
    {
      repoId: "pay",
      name: "结算系统",
      url: "https://svn.example.com/pay",
      ok: true,
      elapsedMs: 1,
      source: "svn",
      commits: [],
    },
  ];
  const personal = buildTodayWork(repos, {
    mode: "personal",
    onlyMine: true,
    myAuthors: ["ZhangSan"],
    includeRevision: true,
    showEmptyRepos: true,
    excluded: new Set([commitKey("order", "4")]),
  });
  assert.match(personal, /【订单中心】/);
  assert.match(personal, /- 修复导出（r3）/);
  assert.doesNotMatch(personal, /lisi|改文案/);
  assert.match(personal, /【结算系统】今日无提交/);

  const team = buildTodayWork(repos, {
    mode: "team",
    onlyMine: false,
    myAuthors: [],
    includeRevision: false,
    showEmptyRepos: false,
    excluded: new Set(),
  });
  assert.match(team, /- lisi：改文案/);
  assert.doesNotMatch(team, /结算系统/);
});

test("full log fills empty sections with 无", () => {
  const text = composeFullLog(
    [
      { id: "done", title: "今日完成工作", role: "generated" },
      { id: "undo", title: "未完成工作", role: "manual" },
    ],
    { done: "【订单中心】\n- 修复导出" },
  );
  assert.equal(text, "今日完成工作\n【订单中心】\n- 修复导出\n\n未完成工作\n无");
});

test("calendar helpers stay on the civil date", () => {
  const morning = Date.parse("2026-10-27T00:30:00+08:00");
  assert.equal(calendarDate("+08:00", morning), "2026-10-27");
  assert.equal(calendarDate("+00:00", morning), "2026-10-26");
  assert.equal(shiftDate("2026-10-31", 1), "2026-11-01");
  assert.equal(svnRevisionRange("2026-10-27", "+08:00"), "{2026-10-27T00:00:00+08:00}:{2026-10-27T23:59:59+08:00}");
});
