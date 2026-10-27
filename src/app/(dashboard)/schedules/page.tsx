import type { Metadata } from "next";
import { Suspense } from "react";
import { SchedulesPage } from "@/features/schedules/schedules-page";

export const metadata: Metadata = { title: "Schedules" };

export default function Page() {
  return (
    <Suspense>
      <SchedulesPage />
    </Suspense>
  );
}
