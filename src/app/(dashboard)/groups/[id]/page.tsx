import type { Metadata } from "next";
import { GroupDetailPage } from "@/features/groups/group-detail-page";

export const metadata: Metadata = { title: "CDS group" };

export default async function Page(props: PageProps<"/groups/[id]">) {
  const { id } = await props.params;
  return <GroupDetailPage id={id} />;
}
