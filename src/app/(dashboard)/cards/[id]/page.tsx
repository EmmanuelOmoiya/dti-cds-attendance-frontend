import type { Metadata } from "next";
import { Suspense } from "react";
import { CardDetailPage } from "@/features/cards/card-detail-page";

export const metadata: Metadata = { title: "NFC cards" };

export default async function Page(props: PageProps<"/cards/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <CardDetailPage id={id} />
    </Suspense>
  );
}
