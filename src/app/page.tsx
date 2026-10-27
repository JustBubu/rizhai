import { Suspense } from "react";
import { connection } from "next/server";
import { DigestApp } from "@/components/digest-app";
import { calendarDate } from "@/lib/dates";
import { loadSettings } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-sm text-muted-foreground">正在打开今天的记录…</p>}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  await connection();
  const settings = await loadSettings();
  return <DigestApp initialToday={calendarDate(settings.timezone)} />;
}
