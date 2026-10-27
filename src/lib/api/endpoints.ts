/**
 * One typed function per backend route (see backend/docs/API.md). Every route listed here was
 * verified against the NestJS controllers in backend/src/**.
 */
import { apiDownload, apiList, apiListAll, apiRequest, type Query } from "./client";
import type {
  AttendanceEvent,
  AttendanceRecord,
  AttendanceRecordDetail,
  AuditLog,
  Card,
  CardAssignment,
  CardDetail,
  CardWithCurrent,
  CreateScheduleInput,
  CreateSessionInput,
  CreateUserInput,
  CurrentUser,
  Device,
  DeviceDetail,
  DeviceWithCredentials,
  GenerationResult,
  Group,
  GroupDetail,
  GroupMembersReport,
  GroupReport,
  ListParams,
  Member,
  MemberAttendanceRow,
  MemberReport,
  Membership,
  Occurrence,
  ReprocessResult,
  Schedule,
  ScheduleDetail,
  ScheduleEndResult,
  Session,
  SessionDetail,
  SessionReport,
  SyncEvent,
  User,
} from "./types";

type P<T> = T & ListParams;
const q = (params?: object) => params as Query | undefined;
const opt = (signal?: AbortSignal) => ({ signal });

// ───────────── Auth ─────────────

export const authApi = {
  me: (signal?: AbortSignal) => apiRequest<CurrentUser>("/auth/me", opt(signal)),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiRequest<void>("/auth/change-password", { method: "POST", body }),
};

// ───────────── Users (users:manage) ─────────────

export interface UserQuery { q?: string; role?: string; status?: string }

export const usersApi = {
  list: (params: P<UserQuery>, signal?: AbortSignal) => apiList<User>("/users", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<User>(`/users/${id}`, opt(signal)),
  create: (body: CreateUserInput) => apiRequest<User>("/users", { method: "POST", body }),
  update: (id: string, body: { fullName?: string; role?: string }) => apiRequest<User>(`/users/${id}`, { method: "PATCH", body }),
  disable: (id: string) => apiRequest<User>(`/users/${id}/disable`, { method: "POST" }),
  enable: (id: string) => apiRequest<User>(`/users/${id}/enable`, { method: "POST" }),
  setGroupScopes: (id: string, groupIds: string[]) => apiRequest<User>(`/users/${id}/group-scopes`, { method: "PUT", body: { groupIds } }),
  resetPassword: (id: string, newPassword: string) => apiRequest<void>(`/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
};

// ───────────── Groups ─────────────

export interface GroupQuery { q?: string; status?: string }

export const groupsApi = {
  list: (params: P<GroupQuery>, signal?: AbortSignal) => apiList<Group>("/groups", { query: q(params), signal }),
  all: (signal?: AbortSignal) => apiListAll<Group>("/groups", { sort: "name:asc" }, signal),
  get: (id: string, signal?: AbortSignal) => apiRequest<GroupDetail>(`/groups/${id}`, opt(signal)),
  create: (body: { name: string; description?: string }) => apiRequest<Group>("/groups", { method: "POST", body }),
  update: (id: string, body: { name?: string; description?: string }) => apiRequest<Group>(`/groups/${id}`, { method: "PATCH", body }),
  deactivate: (id: string) => apiRequest<Group>(`/groups/${id}/deactivate`, { method: "POST" }),
  activate: (id: string) => apiRequest<Group>(`/groups/${id}/activate`, { method: "POST" }),
};

// ───────────── Schedules ─────────────

export interface ScheduleQuery { groupId?: string; status?: string }

export const schedulesApi = {
  list: (params: P<ScheduleQuery>, signal?: AbortSignal) => apiList<Schedule>("/schedules", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<ScheduleDetail>(`/schedules/${id}`, opt(signal)),
  preview: (id: string, from: string, to: string, signal?: AbortSignal) =>
    apiRequest<Occurrence[]>(`/schedules/${id}/occurrences/preview`, { query: { from, to }, signal }),
  create: (body: CreateScheduleInput) => apiRequest<Schedule & { generation: GenerationResult }>("/schedules", { method: "POST", body }),
  rename: (id: string, title: string) => apiRequest<Schedule>(`/schedules/${id}`, { method: "PATCH", body: { title } }),
  end: (id: string, effectiveUntil: string) => apiRequest<ScheduleEndResult>(`/schedules/${id}/end`, { method: "POST", body: { effectiveUntil } }),
  deactivate: (id: string) => apiRequest<ScheduleEndResult>(`/schedules/${id}/deactivate`, { method: "POST" }),
  generate: (id: string, backfillPast: boolean) =>
    apiRequest<GenerationResult>(`/schedules/${id}/generate`, { method: "POST", query: { backfillPast } }),
};

// ───────────── Sessions ─────────────

export interface SessionQuery {
  groupId?: string;
  status?: string;
  origin?: string;
  scheduleId?: string;
  from?: string;
  to?: string;
  needsResolution?: boolean;
}

export const sessionsApi = {
  list: (params: P<SessionQuery>, signal?: AbortSignal) => apiList<Session>("/sessions", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<SessionDetail>(`/sessions/${id}`, opt(signal)),
  create: (body: CreateSessionInput) => apiRequest<Session>("/sessions", { method: "POST", body }),
  update: (id: string, body: { title?: string; plannedStart?: string; plannedEnd?: string }) =>
    apiRequest<Session>(`/sessions/${id}`, { method: "PATCH", body }),
  open: (id: string) => apiRequest<Session>(`/sessions/${id}/open`, { method: "POST" }),
  close: (id: string) => apiRequest<Session>(`/sessions/${id}/close`, { method: "POST" }),
  confirmHeld: (id: string, body: { openedAt?: string; closedAt?: string; note?: string }) =>
    apiRequest<Session>(`/sessions/${id}/confirm-held`, { method: "POST", body }),
  cancel: (id: string, body: { reason: string; note?: string; voidExistingAttendance?: boolean }) =>
    apiRequest<Session & { voidedRecords: number }>(`/sessions/${id}/cancel`, { method: "POST", body }),
  reinstate: (id: string, body: { note: string; reprocessRejectedEvents?: boolean }) =>
    apiRequest<Session & { restoredRecords: number; reprocessing?: ReprocessResult }>(`/sessions/${id}/reinstate`, { method: "POST", body }),
  attendance: (id: string, state: "present" | "absent" | "all", signal?: AbortSignal) =>
    apiRequest<SessionReport>(`/sessions/${id}/attendance`, { query: { state }, signal }),
};

// ───────────── Members & memberships ─────────────

export interface MemberQuery {
  q?: string;
  status?: string;
  groupId?: string;
  membership?: "current" | "any";
  activeAt?: string;
}

export const membersApi = {
  list: (params: P<MemberQuery>, signal?: AbortSignal) => apiList<Member>("/members", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<Member>(`/members/${id}`, opt(signal)),
  create: (body: { fullName: string; stateCode: string; groupId: string; joinedAt?: string }) =>
    apiRequest<Member>("/members", { method: "POST", body }),
  update: (id: string, body: { fullName?: string; stateCode?: string }) => apiRequest<Member>(`/members/${id}`, { method: "PATCH", body }),
  deactivate: (id: string, body: { effectiveAt?: string; note?: string }) =>
    apiRequest<Member>(`/members/${id}/deactivate`, { method: "POST", body }),
  reactivate: (id: string) => apiRequest<Member>(`/members/${id}/reactivate`, { method: "POST" }),
  transfer: (id: string, body: { toGroupId: string; effectiveAt?: string; note?: string }) =>
    apiRequest<Member>(`/members/${id}/transfer`, { method: "POST", body }),
  attendance: (id: string, params: { from?: string; to?: string }, signal?: AbortSignal) =>
    apiRequest<MemberAttendanceRow[]>(`/members/${id}/attendance`, { query: q(params), signal }),
  cardAssignments: (id: string, params: ListParams, signal?: AbortSignal) =>
    apiList<CardAssignment>(`/members/${id}/card-assignments`, { query: q(params), signal }),
  replaceCard: (id: string, body: { newCardId?: string; newCardUid?: string; reason: string; note?: string }) =>
    apiRequest<{ previousAssignmentId: string; assignment: CardAssignment }>(`/members/${id}/card-replacement`, { method: "POST", body }),
};

export const membershipsApi = {
  list: (params: P<{ memberId?: string; groupId?: string; activeAt?: string }>, signal?: AbortSignal) =>
    apiList<Membership>("/memberships", { query: q(params), signal }),
  create: (body: { memberId: string; groupId: string; joinedAt: string }) => apiRequest<Membership>("/memberships", { method: "POST", body }),
  end: (id: string, body: { leftAt?: string; reason: string; note?: string }) =>
    apiRequest<Membership>(`/memberships/${id}/end`, { method: "POST", body }),
  correct: (id: string, body: { joinedAt?: string; leftAt?: string | null; note: string }) =>
    apiRequest<Membership>(`/memberships/${id}`, { method: "PATCH", body }),
};

// ───────────── Cards ─────────────

export interface CardQuery { status?: string; cardUid?: string; memberId?: string }

export const cardsApi = {
  list: (params: P<CardQuery>, signal?: AbortSignal) => apiList<CardWithCurrent>("/cards", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<CardDetail>(`/cards/${id}`, opt(signal)),
  register: (body: { cardUid: string; label?: string }) => apiRequest<Card>("/cards", { method: "POST", body }),
  revoke: (id: string, body: { reason: string; note?: string }) => apiRequest<Card>(`/cards/${id}/revoke`, { method: "POST", body }),
  reinstate: (id: string) => apiRequest<Card>(`/cards/${id}/reinstate`, { method: "POST" }),
  assign: (body: { cardId?: string; cardUid?: string; memberId: string; assignedAt?: string }) =>
    apiRequest<CardAssignment>("/card-assignments", { method: "POST", body }),
  endAssignment: (id: string, body: { reason: string; endedAt?: string; note?: string }) =>
    apiRequest<CardAssignment>(`/card-assignments/${id}/end`, { method: "POST", body }),
};

// ───────────── Attendance ─────────────

export interface AttendanceQuery {
  sessionId?: string;
  memberId?: string;
  groupId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
  source?: string;
  status?: string;
}

export interface EventQuery {
  ackStatus?: string;
  reason?: string;
  resolution?: string;
  deviceId?: string;
  sessionId?: string;
  memberId?: string;
  groupId?: string;
}

export const attendanceApi = {
  list: (params: P<AttendanceQuery>, signal?: AbortSignal) => apiList<AttendanceRecord>("/attendance", { query: q(params), signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<AttendanceRecordDetail>(`/attendance/${id}`, opt(signal)),
  createManual: (body: { sessionId: string; memberId: string; note: string }) =>
    apiRequest<AttendanceRecord>("/attendance", { method: "POST", body }),
  void: (id: string, note: string) => apiRequest<AttendanceRecord>(`/attendance/${id}/void`, { method: "POST", body: { note } }),
  restore: (id: string, note: string) => apiRequest<AttendanceRecord>(`/attendance/${id}/restore`, { method: "POST", body: { note } }),
  events: (params: P<EventQuery>, signal?: AbortSignal) => apiList<AttendanceEvent>("/attendance/events", { query: q(params), signal }),
  reprocess: (body: { eventIds?: string[]; sessionId?: string; memberId?: string; deviceId?: string; reason?: string }) =>
    apiRequest<ReprocessResult>("/attendance/events/reprocess", { method: "POST", body }),
  dismiss: (id: string, note: string) => apiRequest<AttendanceEvent>(`/attendance/events/${id}/dismiss`, { method: "POST", body: { note } }),
};

// ───────────── Devices ─────────────

export interface DeviceQuery { groupId?: string; status?: string; q?: string }

export const devicesApi = {
  list: (params: P<DeviceQuery>, signal?: AbortSignal) => apiList<Device>("/devices", { query: q(params), signal }),
  all: (signal?: AbortSignal) => apiListAll<Device>("/devices", { sort: "deviceIdentifier:asc" }, signal),
  get: (id: string, signal?: AbortSignal) => apiRequest<DeviceDetail>(`/devices/${id}`, opt(signal)),
  register: (body: { deviceIdentifier: string; name: string; assignedGroupId: string }) =>
    apiRequest<DeviceWithCredentials>("/devices", { method: "POST", body }),
  update: (id: string, body: { name?: string; assignedGroupId?: string }) => apiRequest<Device>(`/devices/${id}`, { method: "PATCH", body }),
  transition: (id: string, action: "activate" | "suspend" | "revoke" | "decommission", reason?: string) =>
    apiRequest<Device>(`/devices/${id}/${action}`, { method: "POST", body: reason ? { reason } : {} }),
  rotateCredentials: (id: string) => apiRequest<DeviceWithCredentials>(`/devices/${id}/credentials/rotate`, { method: "POST" }),
  syncEvents: (id: string, params: P<{ type?: string }>, signal?: AbortSignal) =>
    apiList<SyncEvent>(`/devices/${id}/sync-events`, { query: q(params), signal }),
};

// ───────────── Reports ─────────────

export interface RangeQuery { from?: string; to?: string }

export const reportsApi = {
  session: (id: string, signal?: AbortSignal) => apiRequest<SessionReport>(`/reports/sessions/${id}`, opt(signal)),
  group: (id: string, range: RangeQuery, signal?: AbortSignal) => apiRequest<GroupReport>(`/reports/groups/${id}`, { query: q(range), signal }),
  groupMembers: (id: string, range: RangeQuery, signal?: AbortSignal) =>
    apiRequest<GroupMembersReport>(`/reports/groups/${id}/members`, { query: q(range), signal }),
  member: (id: string, range: RangeQuery, signal?: AbortSignal) => apiRequest<MemberReport>(`/reports/members/${id}`, { query: q(range), signal }),
  /** CSV exports are generated by the backend (RFC 4180, formula-injection guard) for the same filters. */
  download: (kind: "session" | "group" | "groupMembers" | "member", id: string, range: RangeQuery = {}) => {
    const path =
      kind === "session" ? `/reports/sessions/${id}` : kind === "group" ? `/reports/groups/${id}` : kind === "groupMembers" ? `/reports/groups/${id}/members` : `/reports/members/${id}`;
    return apiDownload(path, { ...range, format: "csv" }, `${kind}-report.csv`);
  },
};

// ───────────── Audit ─────────────

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  groupId?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (params: P<AuditQuery>, signal?: AbortSignal) => apiList<AuditLog>("/audit-logs", { query: q(params), signal }),
};
