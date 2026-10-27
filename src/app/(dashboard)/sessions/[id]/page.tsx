import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionDetailPage } from "@/features/sessions/session-detail-page";

export const metadata: Metadata = { title: "Sessions" };

export default async function Page(props: PageProps<"/sessions/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <SessionDetailPage id={id} />
    </Suspense>
  );
}
