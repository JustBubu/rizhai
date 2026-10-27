import { Suspense } from "react";
import { connection } from "next/server";
import { DigestApp } from "@/components/digest-app";
import { calendarDate } from "@/lib/dates";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-sm text-muted-foreground">正在打开今天的记录…</p>}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  await connection();
  return <DigestApp initialToday={calendarDate("+08:00")} />;
}
