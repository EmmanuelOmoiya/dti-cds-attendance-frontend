"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/data-table/data-table";
import { FilterBar, GroupFilter, SelectFilter } from "@/components/data-table/filters";
import { schedulesApi } from "@/lib/api/endpoints";
import { useCan } from "@/lib/auth/auth-context";
import { useGroups } from "@/lib/group-context";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import { SchedulesTable } from "./schedules-table";

export function SchedulesPage() {
  const router = useRouter();
  const canWrite = useCan(Permission.SCHEDULES_WRITE);
  const { activeGroupId } = useGroups();
  const [f, setF] = useUrlState({ groupId: "", status: "ACTIVE", page: "1", pageSize: "20", sort: "" });
  const [creating, setCreating] = useState(false);
  const groupId = f.groupId || activeGroupId || undefined;
  const params = { groupId, status: f.status || undefined, page: toInt(f.page, 1), pageSize: toInt(f.pageSize, 20), sort: f.sort || undefined };

  const query = useQuery({
    queryKey: ["schedules", "list", params],
    queryFn: ({ signal }) => schedulesApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Schedules"
        description="Weekly meeting rules. Schedules are versioned: to change the day or time, end the current schedule and create a new one, so past sessions keep the rule that produced them."
        actions={
          canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New schedule
            </Button>
          )
        }
      />
      <Panel>
        <FilterBar onReset={() => setF({ groupId: "", status: "ACTIVE" })} canReset={!!f.groupId || f.status !== "ACTIVE"}>
          <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(groupId) => setF({ groupId })} />
          <SelectFilter
            label="Status"
            value={f.status as "" | "ACTIVE" | "INACTIVE"}
            onChange={(status) => setF({ status })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </FilterBar>
        <SchedulesTable
          rows={query.data?.data}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={f.sort}
          onSortChange={(sort) => setF({ sort })}
          empty={
            <EmptyState
              icon={CalendarClock}
              title="No schedules found"
              description={canWrite ? "Create a weekly schedule such as Fridays 10:00–13:00 WAT." : "No schedules match these filters."}
              action={canWrite ? <Button onClick={() => setCreating(true)}><Plus /> New schedule</Button> : undefined}
            />
          }
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <ScheduleFormDialog open={creating} onOpenChange={setCreating} defaults={{ groupId }} onCreated={(s) => router.push(`/schedules/${s.id}`)} />
    </>
  );
}
