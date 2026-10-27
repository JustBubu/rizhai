import { calendarDate } from "@/lib/dates";
import { t, type Locale } from "@/lib/i18n";
import type { RepoLog } from "@/lib/types";

function atHour(hour: number, minute: number): string {
  const date = calendarDate("+08:00");
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0)).toISOString();
}

export function sampleLogs(locale: Locale = "zh"): RepoLog[] {
  return [
    {
      repoId: "sample-order",
      name: t(locale, "sampleOrder"),
      url: "https://svn.example.com/order/trunk",
      ok: true,
      elapsedMs: 0,
      source: "paste",
      commits: [
        {
          revision: "1842",
          author: "zhangsan",
          date: atHour(9, 40),
          message:
            locale === "en"
              ? "Fix null pointer when export amount is empty\nTreat null as 0 and add a unit test"
              : "修复导出时金额为空导致的空指针\n空值统一按 0 处理，并补了一条单测",
          paths: [
            { action: "M", path: "/trunk/src/export/OrderExporter.java" },
            { action: "A", path: "/trunk/src/export/OrderExporterTest.java" },
          ],
        },
        {
          revision: "1844",
          author: "zhangsan",
          date: atHour(11, 15),
          message: locale === "en" ? "Default order list page size to 50" : "订单列表默认分页改为 50 条",
          paths: [{ action: "M", path: "/trunk/src/web/OrderListAction.java" }],
        },
        {
          revision: "1846",
          author: "lisi",
          date: atHour(15, 5),
          message: locale === "en" ? "Add operator to reconciliation diff notes" : "对账差异说明补上操作人",
          paths: [{ action: "M", path: "/trunk/src/reconcile/DiffNote.java" }],
        },
      ],
    },
    {
      repoId: "sample-pay",
      name: t(locale, "samplePay"),
      url: "https://svn.example.com/pay/trunk",
      ok: true,
      elapsedMs: 0,
      source: "paste",
      commits: [
        {
          revision: "902",
          author: "zhangsan",
          date: atHour(14, 22),
          message:
            locale === "en"
              ? "Make payment callback idempotent for duplicate notices"
              : "支付回调增加重复通知的幂等判断",
          paths: [{ action: "M", path: "/trunk/src/callback/PayNotifyHandler.java" }],
        },
      ],
    },
    {
      repoId: "sample-member",
      name: t(locale, "sampleMember"),
      url: "https://svn.example.com/member/trunk",
      ok: true,
      elapsedMs: 0,
      source: "paste",
      commits: [],
    },
  ];
}
