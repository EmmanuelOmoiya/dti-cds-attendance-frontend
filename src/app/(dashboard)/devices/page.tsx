import type { Metadata } from "next";
import { Suspense } from "react";
import { DevicesPage } from "@/features/devices/devices-page";

export const metadata: Metadata = { title: "Devices" };

export default function Page() {
  return (
    <Suspense>
      <DevicesPage />
    </Suspense>
  );
}
