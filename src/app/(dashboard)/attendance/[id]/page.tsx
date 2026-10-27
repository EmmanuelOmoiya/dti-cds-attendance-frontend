import type { Metadata } from "next";
import { Suspense } from "react";
import { AttendanceDetailPage } from "@/features/attendance/attendance-detail-page";

export const metadata: Metadata = { title: "Attendance" };

export default async function Page(props: PageProps<"/attendance/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <AttendanceDetailPage id={id} />
    </Suspense>
  );
}
