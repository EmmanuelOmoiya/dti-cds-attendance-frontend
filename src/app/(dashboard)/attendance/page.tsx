import type { Metadata } from "next";
import { Suspense } from "react";
import { AttendancePage } from "@/features/attendance/attendance-page";

export const metadata: Metadata = { title: "Attendance" };

export default function Page() {
  return (
    <Suspense>
      <AttendancePage />
    </Suspense>
  );
}
