import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionsPage } from "@/features/sessions/sessions-page";

export const metadata: Metadata = { title: "Sessions" };

export default function Page() {
  return (
    <Suspense>
      <SessionsPage />
    </Suspense>
  );
}
