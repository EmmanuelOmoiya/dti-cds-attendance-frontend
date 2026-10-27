/**
 * TypeScript mirror of the NestJS API responses (backend/src/**). Instants are ISO-8601 strings
 * (UTC); calendar dates (`occurrenceDate`, schedule effectivity) are `YYYY-MM-DD` strings.
 * Keep in sync with the backend's Prisma schema and service `view()/present()` functions.
 */

export type ISODateTime = string;
export type ISODate = string;

// ───────────── Envelope ─────────────

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
}

// ───────────── Enums ─────────────

export type Role = "SUPER_ADMIN" | "CDS_ADMIN" | "LGI_VIEWER";
export type UserStatus = "ACTIVE" | "DISABLED";
export type GroupStatus = "ACTIVE" | "INACTIVE";
export type ScheduleStatus = "ACTIVE" | "INACTIVE";
export type SessionOrigin = "SCHEDULE" | "AD_HOC";
export type SessionStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "UNRESOLVED" | "CANCELLED";
export type HeldConfirmation = "OPENED_LIVE" | "CONFIRMED_RETROSPECTIVELY";
export type CancellationReason =
  | "PUBLIC_HOLIDAY"
  | "OFFICIAL_NYSC_ACTIVITY"
  | "VENUE_UNAVAILABLE"
  | "SECURITY"
  | "WEATHER"
  | "NOT_HELD"
  | "SCHEDULE_CHANGED"
  | "OTHER";
export type UserCancellationReason = Exclude<CancellationReason, "SCHEDULE_CHANGED">;
export type MemberStatus = "ACTIVE" | "INACTIVE";
export type MembershipStatus = "ACTIVE" | "UPCOMING" | "ENDED";
export type MembershipEndReason =
  | "TRANSFERRED"
  | "SERVICE_COMPLETED"
  | "REMOVED"
  | "MEMBER_DEACTIVATED"
  | "DATA_CORRECTION"
  | "OTHER";
export type UserMembershipEndReason = "SERVICE_COMPLETED" | "REMOVED" | "DATA_CORRECTION" | "OTHER";
export type CardStatus = "UNASSIGNED" | "ASSIGNED" | "REVOKED";
export type CardRevokeReason = "LOST" | "DAMAGED" | "STOLEN" | "RETIRED" | "OTHER";
export type CardAssignmentStatus = "ACTIVE" | "ENDED";
export type AssignmentEndReason =
  | "REPLACED"
  | "RETURNED"
  | "LOST"
  | "DAMAGED"
  | "STOLEN"
  | "MEMBER_LEFT"
  | "REVOKED"
  | "OTHER";
export type UserAssignmentEndReason = Exclude<AssignmentEndReason, "REPLACED">;
export type ReplacementReason = "LOST" | "DAMAGED" | "STOLEN" | "OTHER";
export type DeviceStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "DECOMMISSIONED";
export type SyncEventType = "TOKEN" | "SNAPSHOT" | "UPLOAD" | "HEARTBEAT";
export type SyncResult = "SUCCESS" | "PARTIAL" | "FAILED";
export type EventAckStatus = "ACCEPTED" | "ALREADY_RECORDED" | "REJECTED";
export type RejectReason =
  | "INVALID_TIMESTAMP"
  | "UNKNOWN_CARD"
  | "CARD_NOT_ASSIGNED"
  | "CARD_REVOKED"
  | "MEMBER_INACTIVE"
  | "NO_MATCHING_SESSION"
  | "SESSION_CANCELLED"
  | "SESSION_NOT_OPEN"
  | "DEVICE_NOT_AUTHORIZED"
  | "MEMBER_NOT_IN_GROUP"
  | "NOT_ELIGIBLE_FOR_SESSION"
  | "DUPLICATE_EVENT"
  | "OTHER";
export type EventResolution = "NONE" | "RECORD_CREATED" | "DISMISSED";
export type AttendanceSource = "DEVICE" | "MANUAL" | "REPROCESSED";
export type AttendanceRecordStatus = "PRESENT" | "VOIDED";
export type VoidReason = "SESSION_CANCELLED" | "ADMIN_CORRECTION";
export type ActorType = "USER" | "DEVICE" | "SYSTEM" | "ANONYMOUS";
export type Participation =
  | "PRESENT"
  | "ABSENT"
  | "NOT_RECORDED"
  | "CANCELLED"
  | "PENDING_RESOLUTION"
  | "UPCOMING";

// ───────────── Auth & users ─────────────

export interface GroupRef {
  id: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: ISODateTime | null;
  groups: (GroupRef & { status: GroupStatus })[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  groups: GroupRef[];
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: Role;
  password: string;
  groupIds?: string[];
}

// ───────────── Groups ─────────────

export interface Group {
  id: string;
  name: string;
  description: string | null;
  status: GroupStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface GroupDetail extends Group {
  stats: { activeMembers: number; devices: number; activeSchedules: number };
}

// ───────────── Schedules ─────────────

export interface Schedule {
  id: string;
  groupId: string;
  title: string;
  dayOfWeek: number;
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  effectiveFrom: ISODate;
  effectiveUntil: ISODate | null;
  status: ScheduleStatus;
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface GenerationResult {
  scheduleId: string;
  candidates: number;
  created: number;
}

export interface ScheduleDetail extends Schedule {
  upcomingSessions: Session[];
}

export interface ScheduleEndResult extends Schedule {
  cancelledSessionIds: string[];
  sessionsKeptWithAttendance: { id: string; occurrenceDate: ISODate }[];
}

export interface Occurrence {
  occurrenceDate: ISODate;
  plannedStart: ISODateTime;
  plannedEnd: ISODateTime;
}

export interface CreateScheduleInput {
  groupId: string;
  title: string;
  dayOfWeek: number;
  startLocalTime: string;
  endLocalTime: string;
  timezone?: string;
  effectiveFrom: ISODate;
  effectiveUntil?: ISODate;
  backfillPast?: boolean;
}

// ───────────── Sessions ─────────────

export interface Session {
  id: string;
  groupId: string;
  scheduleId: string | null;
  origin: SessionOrigin;
  title: string;
  occurrenceDate: ISODate;
  timezone: string;
  plannedStart: ISODateTime;
  plannedEnd: ISODateTime;
  rescheduled: boolean;
  status: SessionStatus;
  openedAt: ISODateTime | null;
  closedAt: ISODateTime | null;
  heldConfirmation: HeldConfirmation | null;
  heldConfirmedAt: ISODateTime | null;
  heldConfirmedById: string | null;
  cancellationReason: CancellationReason | null;
  cancellationNote: string | null;
  cancelledAt: ISODateTime | null;
  cancelledById: string | null;
  unresolvedAt: ISODateTime | null;
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  held: boolean;
  admissionWindow: { start: ISODateTime; end: ISODateTime };
}

export interface SessionDetail extends Session {
  attendanceSummary: {
    present: number;
    voided: number;
    deviceEvents: Partial<Record<EventAckStatus, number>>;
  };
}

export interface SessionReportMember {
  memberId: string;
  fullName: string;
  stateCode: string;
  membershipId: string;
  recordId: string | null;
  recordStatus: AttendanceRecordStatus | null;
  capturedAt: ISODateTime | null;
  source: AttendanceSource | null;
  lateSync: boolean | null;
  participation: Participation;
}

export interface SessionReport {
  session: {
    id: string;
    groupId: string;
    groupName: string;
    title: string;
    occurrenceDate: ISODate;
    plannedStart: ISODateTime;
    plannedEnd: ISODateTime;
    status: SessionStatus;
    cancellationReason: CancellationReason | null;
  };
  summary: {
    countsTowardStatistics: boolean;
    eligible: number;
    present: number;
    absent: number | null;
    attendanceRate: number | null;
  };
  members: SessionReportMember[];
}

export interface CreateSessionInput {
  groupId: string;
  title: string;
  plannedStart: ISODateTime;
  plannedEnd: ISODateTime;
  timezone?: string;
}

// ───────────── Members & memberships ─────────────

export interface Membership {
  id: string;
  memberId: string;
  groupId: string;
  joinedAt: ISODateTime;
  leftAt: ISODateTime | null;
  endReason: MembershipEndReason | null;
  endNote: string | null;
  transferredToMembershipId: string | null;
  createdById: string | null;
  endedById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  status: MembershipStatus;
  group?: GroupRef;
  member?: { id: string; fullName: string; stateCode: string; status: MemberStatus };
}

export interface ActiveCard {
  assignmentId: string;
  assignedAt: ISODateTime;
  id: string;
  cardUid: string;
  label: string | null;
}

export interface Member {
  id: string;
  fullName: string;
  stateCode: string;
  status: MemberStatus;
  deactivatedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  currentMembership: Membership | null;
  currentGroup: GroupRef | null;
  activeCard: ActiveCard | null;
  memberships: Membership[];
}

export interface MemberAttendanceRow {
  id: string;
  sessionId: string;
  status: AttendanceRecordStatus;
  source: AttendanceSource;
  capturedAt: ISODateTime;
  lateSync: boolean;
  session: { id: string; title: string; occurrenceDate: ISODate; status: SessionStatus; groupId: string };
}

// ───────────── Cards ─────────────

export interface Card {
  id: string;
  cardUid: string;
  label: string | null;
  status: CardStatus;
  revokedAt: ISODateTime | null;
  revokeReason: CardRevokeReason | null;
  revokeNote: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CardAssignment {
  id: string;
  cardId: string;
  memberId: string;
  assignedAt: ISODateTime;
  endedAt: ISODateTime | null;
  status: CardAssignmentStatus;
  endReason: AssignmentEndReason | null;
  endNote: string | null;
  replacedByAssignmentId: string | null;
  assignedById: string | null;
  endedById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  member: { id: string; fullName: string; stateCode: string };
  card: { id: string; cardUid: string; label: string | null; status: CardStatus };
}

export interface CardWithCurrent extends Card {
  currentAssignment: CardAssignment | null;
}

export interface CardDetail extends CardWithCurrent {
  assignments: CardAssignment[];
}

// ───────────── Attendance ─────────────

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  memberId: string;
  membershipId: string;
  cardAssignmentId: string | null;
  deviceId: string | null;
  sourceEventId: string | null;
  source: AttendanceSource;
  capturedAt: ISODateTime;
  receivedAt: ISODateTime;
  lateSync: boolean;
  status: AttendanceRecordStatus;
  note: string | null;
  voidReason: VoidReason | null;
  voidNote: string | null;
  voidedAt: ISODateTime | null;
  voidedById: string | null;
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  member: { id: string; fullName: string; stateCode: string };
  session: { id: string; groupId: string; title: string; occurrenceDate: ISODate; status: SessionStatus };
}

export interface AttendanceEvent {
  id: string;
  deviceId: string;
  clientEventId: string;
  cardUid: string;
  claimedSessionId: string | null;
  sessionId: string | null;
  cardId: string | null;
  cardAssignmentId: string | null;
  memberId: string | null;
  capturedAt: ISODateTime;
  receivedAt: ISODateTime;
  clockSkewMs: number | null;
  sessionReassigned: boolean;
  ackStatus: EventAckStatus;
  ackReason: RejectReason | null;
  attendanceRecordId: string | null;
  resolution: EventResolution;
  resolutionNote: string | null;
  resolvedAt: ISODateTime | null;
  resolvedById: string | null;
  syncEventId: string | null;
  device?: { id: string; deviceIdentifier: string; name: string };
  member?: { id: string; fullName: string; stateCode: string } | null;
}

export interface AttendanceRecordDetail extends AttendanceRecord {
  sourceEvent: Omit<AttendanceEvent, "device" | "member"> | null;
}

export interface ReprocessResult {
  evaluated: number;
  recordsCreated: number;
  results: {
    eventId: string;
    outcome: "RECORD_CREATED" | "ALREADY_RECORDED" | "STILL_REJECTED";
    reason?: string;
    attendanceRecordId?: string;
  }[];
}

// ───────────── Devices & sync ─────────────

export interface Device {
  id: string;
  deviceIdentifier: string;
  name: string;
  assignedGroupId: string;
  status: DeviceStatus;
  statusReason: string | null;
  credentialVersion: number;
  credentialRotatedAt: ISODateTime;
  activatedAt: ISODateTime | null;
  suspendedAt: ISODateTime | null;
  revokedAt: ISODateTime | null;
  decommissionedAt: ISODateTime | null;
  lastSeenAt: ISODateTime | null;
  lastSyncAt: ISODateTime | null;
  lastStatus: DeviceHeartbeat | null;
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  group?: GroupRef;
}

export interface DeviceHeartbeat {
  firmwareVersion?: string;
  batteryPct?: number;
  pendingEvents?: number;
  lastCaptureAt?: ISODateTime;
  bootId?: string;
  snapshotVersion?: string;
  deviceTime?: ISODateTime;
  [key: string]: unknown;
}

export interface SyncEvent {
  id: string;
  deviceId: string;
  type: SyncEventType;
  result: SyncResult;
  batchId: string | null;
  itemsReceived: number;
  itemsAccepted: number;
  itemsAlreadyRecorded: number;
  itemsRejected: number;
  itemsRetry: number;
  deviceTime: ISODateTime | null;
  clockSkewMs: number | null;
  durationMs: number | null;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: ISODateTime;
}

export interface DeviceDetail extends Device {
  lastUpload: SyncEvent | null;
  reportedPendingEvents: number | null;
}

/** Returned once by register and rotate; the secret is never retrievable again. */
export interface DeviceCredentials {
  deviceIdentifier: string;
  secret: string;
  notice: string;
}

export interface DeviceWithCredentials {
  device: Device;
  credentials: DeviceCredentials;
}

// ───────────── Reports ─────────────

export interface ReportRange {
  from: ISODate | null;
  to: ISODate | null;
}

export interface GroupReportSession {
  sessionId: string;
  occurrenceDate: ISODate;
  title: string;
  status: SessionStatus;
  cancellationReason: CancellationReason | null;
  countsTowardStatistics: boolean;
  eligible: number;
  present: number;
  absent: number | null;
  attendanceRate: number | null;
  recordsAttached: number;
}

export interface GroupReport {
  group: GroupRef;
  range: ReportRange;
  totals: {
    heldSessions: number;
    totalEligible: number;
    totalPresent: number;
    totalAbsent: number;
    attendanceRate: number | null;
    meanSessionAttendanceRate: number | null;
    activeMembersNow: number;
  };
  excluded: {
    cancelled: number;
    cancelledByReason: Record<string, number>;
    unresolved: number;
    open: number;
    scheduled: number;
  };
  warnings: string[];
  sessions: GroupReportSession[];
}

export interface GroupMembersReport {
  group: GroupRef;
  range: ReportRange;
  members: {
    memberId: string;
    fullName: string;
    stateCode: string;
    eligibleSessions: number;
    present: number;
    absent: number;
    attendanceRate: number | null;
  }[];
}

export interface MemberReportSession {
  sessionId: string;
  groupId: string;
  groupName: string;
  membershipId: string;
  occurrenceDate: ISODate;
  title: string;
  sessionStatus: SessionStatus;
  countsTowardStatistics: boolean;
  participation: Participation;
  recordedPresent: boolean;
  capturedAt: ISODateTime | null;
}

export interface MemberReport {
  member: { id: string; fullName: string; stateCode: string; status: MemberStatus };
  range: ReportRange;
  summary: {
    eligibleSessions: number;
    present: number;
    absent: number;
    attendanceRate: number | null;
    pendingResolution: number;
    cancelledSessions: number;
    upcoming: number;
  };
  byMembership: {
    membershipId: string;
    groupId: string;
    joinedAt: ISODateTime;
    leftAt: ISODateTime | null;
    eligibleSessions: number;
    present: number;
    absent: number;
    attendanceRate: number | null;
  }[];
  sessions: MemberReportSession[];
}

// ───────────── Audit ─────────────

export interface AuditLog {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  groupId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  ip: string | null;
  createdAt: ISODateTime;
}
