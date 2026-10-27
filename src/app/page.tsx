import { Suspense } from "react";
import { connection } from "next/server";
import { DigestApp } from "@/components/digest-app";
import { calendarDate } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { loadSettings } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<OpeningFallback />}>
      <Today />
    </Suspense>
  );
}

async function OpeningFallback() {
  await connection();
  const settings = await loadSettings();
  return <p className="px-5 py-8 text-sm text-muted-foreground">{t(settings.locale, "openingToday")}</p>;
}

async function Today() {
  await connection();
  const settings = await loadSettings();
  return <DigestApp initialToday={calendarDate(settings.timezone)} />;
}
