import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewPage } from "@/features/dashboard/overview-page";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return (
    <Suspense>
      <OverviewPage />
    </Suspense>
  );
}
