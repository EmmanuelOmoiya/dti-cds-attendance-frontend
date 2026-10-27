import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleDetailPage } from "@/features/schedules/schedule-detail-page";

export const metadata: Metadata = { title: "Schedules" };

export default async function Page(props: PageProps<"/schedules/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <ScheduleDetailPage id={id} />
    </Suspense>
  );
}
