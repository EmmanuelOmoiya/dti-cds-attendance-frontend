import type { Metadata } from "next";
import { Suspense } from "react";
import { DeviceDetailPage } from "@/features/devices/device-detail-page";

export const metadata: Metadata = { title: "Devices" };

export default async function Page(props: PageProps<"/devices/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense>
      <DeviceDetailPage id={id} />
    </Suspense>
  );
}
