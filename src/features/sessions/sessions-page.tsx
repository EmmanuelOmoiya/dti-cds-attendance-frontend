"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/data-table/data-table";
import { DateRangeFilter, FilterBar, GroupFilter, SelectFilter } from "@/components/data-table/filters";
import { sessionsApi } from "@/lib/api/endpoints";
import type { SessionStatus } from "@/lib/api/types";
import { useCan } from "@/lib/auth/auth-context";
import { todayInZone } from "@/lib/datetime";
import { useGroups } from "@/lib/group-context";
import { SESSION_STATUS_LABELS } from "@/lib/labels";
import { Permission } from "@/lib/permissions";
import { toInt, useUrlState } from "@/lib/use-url-state";
import { SessionFormDialog } from "./session-form-dialog";
import { SessionsTable } from "./sessions-table";

type View = "upcoming" | "past" | "resolution" | "all";

export function SessionsPage() {
  const router = useRouter();
  const canWrite = useCan(Permission.SESSIONS_WRITE);
  const { activeGroupId } = useGroups();
  const [f, setF] = useUrlState({ view: "upcoming", groupId: "", status: "", origin: "", from: "", to: "", page: "1", pageSize: "20", sort: "" });
  const [creating, setCreating] = useState(false);
  const today = todayInZone();
  const view = f.view as View;

  const params = {
    groupId: f.groupId || activeGroupId || undefined,
    status: view === "resolution" ? "UNRESOLVED" : f.status || undefined,
    origin: f.origin || undefined,
    from: f.from || (view === "upcoming" ? today : undefined),
    to: f.to || (view === "past" ? today : undefined),
    sort: f.sort || (view === "upcoming" ? "plannedStart:asc" : "plannedStart:desc"),
    page: toInt(f.page, 1),
    pageSize: toInt(f.pageSize, 20),
  };

  const query = useQuery({
    queryKey: ["sessions", "list", params],
    queryFn: ({ signal }) => sessionsApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const filtered = !!(f.groupId || f.status || f.origin || f.from || f.to);

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Expected and ad-hoc CDS meetings. A session counts in statistics only after an administrator opens it live or confirms it was held."
        actions={
          canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Ad-hoc session
            </Button>
          )
        }
      />
      <Tabs value={view} onValueChange={(v) => setF({ view: v, status: "", sort: "", from: "", to: "" })} className="mb-3">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">History</TabsTrigger>
          <TabsTrigger value="resolution">Needs resolution</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <Panel>
        <FilterBar onReset={() => setF({ groupId: "", status: "", origin: "", from: "", to: "" })} canReset={filtered}>
          <GroupFilter value={f.groupId || activeGroupId || ""} onChange={(groupId) => setF({ groupId })} />
          {view !== "resolution" && (
            <SelectFilter
              label="Status"
              value={f.status as SessionStatus | ""}
              onChange={(status) => setF({ status })}
              options={(Object.keys(SESSION_STATUS_LABELS) as SessionStatus[]).map((s) => ({ value: s, label: SESSION_STATUS_LABELS[s] }))}
            />
          )}
          <SelectFilter
            label="Origin"
            value={f.origin as "" | "SCHEDULE" | "AD_HOC"}
            onChange={(origin) => setF({ origin })}
            options={[
              { value: "SCHEDULE", label: "From schedule" },
              { value: "AD_HOC", label: "Ad-hoc" },
            ]}
          />
          <DateRangeFilter from={f.from} to={f.to} onChange={(r) => setF(r)} label="Session date" />
        </FilterBar>
        {view === "resolution" && (
          <p className="border-b bg-warning-soft/60 px-4 py-2 text-xs text-[oklch(0.42_0.1_60)]">
            These sessions passed their planned time without being confirmed held or cancelled. They are excluded from statistics, never treated as absences, and are not cancelled automatically. Open each one to resolve it.
          </p>
        )}
        <SessionsTable
          rows={query.data?.data}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          sort={params.sort}
          onSortChange={(sort) => setF({ sort })}
          empty={
            <EmptyState
              icon={CalendarDays}
              title={view === "resolution" ? "Nothing awaiting resolution" : view === "upcoming" ? "No upcoming sessions" : "No sessions found"}
              description={
                view === "resolution"
                  ? "Every past session has been confirmed held or cancelled."
                  : view === "upcoming"
                    ? "Create a recurring schedule to generate expected sessions, or add an ad-hoc session."
                    : "Try widening the date range or clearing filters."
              }
            />
          }
        />
        <Pagination meta={query.data?.meta} onPageChange={(page) => setF({ page }, { resetPage: false })} onPageSizeChange={(pageSize) => setF({ pageSize })} />
      </Panel>
      <SessionFormDialog open={creating} onOpenChange={setCreating} onSaved={(s) => router.push(`/sessions/${s.id}`)} />
    </>
  );
}
