import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditPage } from "@/features/audit/audit-page";

export const metadata: Metadata = { title: "Audit logs" };

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
