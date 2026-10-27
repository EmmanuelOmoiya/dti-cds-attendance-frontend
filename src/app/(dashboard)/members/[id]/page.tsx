import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberDetailPage } from "@/features/members/member-detail-page";

export const metadata: Metadata = { title: "Members" };

export default async function Page(props: PageProps<"/members/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <MemberDetailPage id={id} />
    </Suspense>
  );
}
