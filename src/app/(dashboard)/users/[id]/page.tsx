import type { Metadata } from "next";
import { Suspense } from "react";
import { UserDetailPage } from "@/features/users/user-detail-page";

export const metadata: Metadata = { title: "User management" };

export default async function Page(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <UserDetailPage id={id} />
    </Suspense>
  );
}
