import type { Metadata } from "next";
import { Suspense } from "react";
import { CardsPage } from "@/features/cards/cards-page";

export const metadata: Metadata = { title: "NFC cards" };

export default function Page() {
  return (
    <Suspense>
      <CardsPage />
    </Suspense>
  );
}
