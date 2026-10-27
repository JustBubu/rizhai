import assert from "node:assert/strict";
import test from "node:test";
import {
  clearAccessTokenCache,
  contentForField,
  guessBinding,
  overLimit,
  signWebhook,
} from "../src/lib/dingtalk.ts";
import type { LogSection } from "../src/lib/types.ts";

const sections: LogSection[] = [
  { id: "done", title: "今日完成工作", role: "generated" },
  { id: "todo", title: "未完成工作", role: "manual" },
  { id: "help", title: "需要协调", role: "manual" },
  { id: "plan", title: "明日计划", role: "manual" },
];

test("guessBinding maps common field titles", () => {
  assert.deepEqual(guessBinding("今日完成工作", sections), { mode: "section", sectionId: "done" });
  assert.deepEqual(guessBinding("未完成事项", sections), { mode: "section", sectionId: "todo" });
  assert.deepEqual(guessBinding("需要协调的问题", sections), { mode: "section", sectionId: "help" });
  assert.deepEqual(guessBinding("明日计划", sections), { mode: "section", sectionId: "plan" });
  assert.deepEqual(guessBinding("其它", sections), { mode: "none" });
});

test("contentForField respects binding modes", () => {
  const bodies = [
    { id: "done", body: "修好导出" },
    { id: "todo", body: "  " },
  ];
  assert.equal(contentForField({ mode: "section", sectionId: "done" }, bodies), "修好导出");
  assert.equal(contentForField({ mode: "section", sectionId: "todo" }, bodies), "无");
  assert.equal(contentForField({ mode: "custom", text: "手写" }, bodies), "手写");
  assert.equal(contentForField({ mode: "none" }, bodies), "无");
  assert.equal(contentForField(undefined, bodies), "无");
});

test("signWebhook adds timestamp and sign when secret is set", () => {
  const base = "https://oapi.dingtalk.com/robot/send?access_token=abc";
  assert.equal(signWebhook(base, ""), base);
  const signed = new URL(signWebhook(base, "secret"));
  assert.ok(signed.searchParams.get("timestamp"));
  assert.ok(signed.searchParams.get("sign"));
  assert.equal(signed.searchParams.get("access_token"), "abc");
});

test("overLimit counts unicode code points", () => {
  assert.equal(overLimit("a".repeat(1000)), false);
  assert.equal(overLimit("a".repeat(1001)), true);
  assert.equal(overLimit("好".repeat(1000)), false);
  assert.equal(overLimit("好".repeat(1001)), true);
  clearAccessTokenCache();
});
