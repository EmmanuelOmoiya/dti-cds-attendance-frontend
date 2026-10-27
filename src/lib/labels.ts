import type {
  AssignmentEndReason,
  AttendanceSource,
  CancellationReason,
  CardRevokeReason,
  DeviceStatus,
  EventAckStatus,
  EventResolution,
  MembershipEndReason,
  Participation,
  RejectReason,
  SessionStatus,
  SyncEventType,
  SyncResult,
} from "./api/types";

/** Human labels for backend enums. Codes stay visible in tooltips/details where useful. */

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  SCHEDULED: "Scheduled",
  OPEN: "Open",
  CLOSED: "Held (closed)",
  UNRESOLVED: "Unresolved",
  CANCELLED: "Cancelled",
};

export const SESSION_STATUS_HELP: Record<SessionStatus, string> = {
  SCHEDULED: "Expected from the schedule. Nobody has confirmed whether it happened yet.",
  OPEN: "Confirmed happening now. Attendance is being taken live.",
  CLOSED: "Confirmed held. Counts toward attendance statistics.",
  UNRESOLVED: "The planned time has passed and nobody confirmed or cancelled it. An administrator must resolve it.",
  CANCELLED: "An authorized person confirmed the meeting did not take place. No attendance is expected.",
};

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  PUBLIC_HOLIDAY: "Public holiday",
  OFFICIAL_NYSC_ACTIVITY: "Official NYSC activity",
  VENUE_UNAVAILABLE: "Venue unavailable",
  SECURITY: "Security",
  WEATHER: "Weather",
  NOT_HELD: "Not held",
  SCHEDULE_CHANGED: "Schedule changed",
  OTHER: "Other",
};

export const USER_CANCELLATION_REASONS = [
  "PUBLIC_HOLIDAY",
  "OFFICIAL_NYSC_ACTIVITY",
  "VENUE_UNAVAILABLE",
  "SECURITY",
  "WEATHER",
  "NOT_HELD",
  "OTHER",
] as const;

export const PARTICIPATION_LABELS: Record<Participation, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  NOT_RECORDED: "Not confirmed held",
  CANCELLED: "Cancelled",
  PENDING_RESOLUTION: "Pending resolution",
  UPCOMING: "Upcoming",
};

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  INVALID_TIMESTAMP: "Implausible capture time (device clock)",
  UNKNOWN_CARD: "Card not registered",
  CARD_NOT_ASSIGNED: "Card not assigned at that time",
  CARD_REVOKED: "Card revoked or assignment ended",
  MEMBER_INACTIVE: "Member deactivated",
  NO_MATCHING_SESSION: "No session at that time",
  SESSION_CANCELLED: "Session cancelled",
  SESSION_NOT_OPEN: "Outside the admission window",
  DEVICE_NOT_AUTHORIZED: "Device not authorized for that group",
  MEMBER_NOT_IN_GROUP: "Not a member of the group",
  NOT_ELIGIBLE_FOR_SESSION: "Not a member at the session time",
  DUPLICATE_EVENT: "Duplicate event ID with different data",
  OTHER: "Other",
};

export const ACK_STATUS_LABELS: Record<EventAckStatus, string> = {
  ACCEPTED: "Accepted",
  ALREADY_RECORDED: "Already recorded",
  REJECTED: "Rejected",
};

export const RESOLUTION_LABELS: Record<EventResolution, string> = {
  NONE: "Needs review",
  RECORD_CREATED: "Recovered (record created)",
  DISMISSED: "Dismissed",
};

export const SOURCE_LABELS: Record<AttendanceSource, string> = {
  DEVICE: "Device tap",
  MANUAL: "Manual entry",
  REPROCESSED: "Recovered tap",
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING: "Pending activation",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
  DECOMMISSIONED: "Decommissioned",
};

export const DEVICE_STATUS_HELP: Record<DeviceStatus, string> = {
  PENDING: "Registered but not yet allowed to synchronize.",
  ACTIVE: "Allowed to synchronize attendance.",
  SUSPENDED: "Temporarily blocked. Can be re-activated.",
  REVOKED: "Permanently blocked (lost, stolen or compromised). Its past attendance is kept.",
  DECOMMISSIONED: "Retired from service permanently.",
};

export const SYNC_TYPE_LABELS: Record<SyncEventType, string> = {
  TOKEN: "Authentication",
  SNAPSHOT: "Roster download",
  UPLOAD: "Attendance upload",
  HEARTBEAT: "Heartbeat",
};

export const SYNC_RESULT_LABELS: Record<SyncResult, string> = {
  SUCCESS: "Success",
  PARTIAL: "Partial",
  FAILED: "Failed",
};

export const MEMBERSHIP_END_REASON_LABELS: Record<MembershipEndReason, string> = {
  TRANSFERRED: "Transferred",
  SERVICE_COMPLETED: "Service completed",
  REMOVED: "Removed",
  MEMBER_DEACTIVATED: "Member deactivated",
  DATA_CORRECTION: "Data correction",
  OTHER: "Other",
};

export const CARD_REVOKE_REASON_LABELS: Record<CardRevokeReason, string> = {
  LOST: "Lost",
  DAMAGED: "Damaged",
  STOLEN: "Stolen",
  RETIRED: "Retired",
  OTHER: "Other",
};

export const ASSIGNMENT_END_REASON_LABELS: Record<AssignmentEndReason, string> = {
  REPLACED: "Replaced",
  RETURNED: "Returned",
  LOST: "Lost",
  DAMAGED: "Damaged",
  STOLEN: "Stolen",
  MEMBER_LEFT: "Member left",
  REVOKED: "Revoked",
  OTHER: "Other",
};

export function label<T extends string>(map: Record<T, string>, value: T | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  return map[value] ?? value;
}
