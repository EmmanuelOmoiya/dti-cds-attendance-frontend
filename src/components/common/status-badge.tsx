import { cn } from "@/lib/utils";
import type {
  CardStatus,
  DeviceStatus,
  EventAckStatus,
  EventResolution,
  MembershipStatus,
  Participation,
  SessionStatus,
  SyncResult,
} from "@/lib/api/types";
import {
  ACK_STATUS_LABELS,
  DEVICE_STATUS_HELP,
  DEVICE_STATUS_LABELS,
  PARTICIPATION_LABELS,
  RESOLUTION_LABELS,
  SESSION_STATUS_HELP,
  SESSION_STATUS_LABELS,
  SYNC_RESULT_LABELS,
} from "@/lib/labels";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground ring-border",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-[oklch(0.45_0.11_60)] ring-warning/25",
  danger: "bg-danger-soft text-destructive ring-destructive/20",
  info: "bg-info-soft text-[oklch(0.42_0.1_245)] ring-[oklch(0.55_0.11_235)]/20",
  brand: "bg-primary text-primary-foreground ring-primary",
  muted: "bg-muted text-muted-foreground ring-border",
};

export function Pill({
  tone = "neutral",
  children,
  className,
  title,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  title?: string;
  dot?: boolean;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

const SESSION_TONES: Record<SessionStatus, Tone> = {
  SCHEDULED: "info",
  OPEN: "success",
  CLOSED: "neutral",
  UNRESOLVED: "warning",
  CANCELLED: "muted",
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Pill tone={SESSION_TONES[status]} title={SESSION_STATUS_HELP[status]} dot>
      {SESSION_STATUS_LABELS[status]}
    </Pill>
  );
}

const DEVICE_TONES: Record<DeviceStatus, Tone> = {
  PENDING: "info",
  ACTIVE: "success",
  SUSPENDED: "warning",
  REVOKED: "danger",
  DECOMMISSIONED: "muted",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Pill tone={DEVICE_TONES[status]} title={DEVICE_STATUS_HELP[status]} dot>
      {DEVICE_STATUS_LABELS[status]}
    </Pill>
  );
}

const PARTICIPATION_TONES: Record<Participation, Tone> = {
  PRESENT: "success",
  ABSENT: "danger",
  NOT_RECORDED: "muted",
  CANCELLED: "muted",
  PENDING_RESOLUTION: "warning",
  UPCOMING: "info",
};

export function ParticipationBadge({ value }: { value: Participation }) {
  return <Pill tone={PARTICIPATION_TONES[value]}>{PARTICIPATION_LABELS[value]}</Pill>;
}

export function AckBadge({ status }: { status: EventAckStatus }) {
  const tone: Tone = status === "ACCEPTED" ? "success" : status === "ALREADY_RECORDED" ? "neutral" : "danger";
  return <Pill tone={tone}>{ACK_STATUS_LABELS[status]}</Pill>;
}

export function ResolutionBadge({ value }: { value: EventResolution }) {
  const tone: Tone = value === "NONE" ? "warning" : value === "RECORD_CREATED" ? "success" : "muted";
  return <Pill tone={tone}>{RESOLUTION_LABELS[value]}</Pill>;
}

export function SyncResultBadge({ result }: { result: SyncResult }) {
  const tone: Tone = result === "SUCCESS" ? "success" : result === "PARTIAL" ? "warning" : "danger";
  return <Pill tone={tone} dot>{SYNC_RESULT_LABELS[result]}</Pill>;
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const tone: Tone = status === "ACTIVE" ? "success" : status === "UPCOMING" ? "info" : "muted";
  const text = status === "ACTIVE" ? "Current" : status === "UPCOMING" ? "Upcoming" : "Ended";
  return <Pill tone={tone}>{text}</Pill>;
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  const tone: Tone = status === "ASSIGNED" ? "success" : status === "UNASSIGNED" ? "neutral" : "danger";
  const text = status === "ASSIGNED" ? "Assigned" : status === "UNASSIGNED" ? "In stock" : "Revoked";
  return <Pill tone={tone}>{text}</Pill>;
}

export function ActiveBadge({ active, activeText = "Active", inactiveText = "Inactive" }: { active: boolean; activeText?: string; inactiveText?: string }) {
  return <Pill tone={active ? "success" : "muted"} dot>{active ? activeText : inactiveText}</Pill>;
}
