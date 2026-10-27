import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupsPage } from "@/features/groups/groups-page";

export const metadata: Metadata = { title: "CDS groups" };

export default function Page() {
  return (
    <Suspense>
      <GroupsPage />
    </Suspense>
  );
}
