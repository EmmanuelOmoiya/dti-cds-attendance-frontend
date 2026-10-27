import { DateTime } from "luxon";

/**
 * Date/time handling. Rules:
 *  - Instants from the API are UTC ISO strings. They are always displayed in an explicit IANA zone
 *    (the session's own `timezone`, or the configured display zone), never the browser's zone.
 *  - Calendar dates (`YYYY-MM-DD`, e.g. occurrenceDate) are displayed as-is, never converted.
 *  - Inputs for instants are wall-clock values in an explicit zone and converted with Luxon.
 */

export const DISPLAY_TIMEZONE = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE || "Africa/Lagos";

const ZONE_ABBREVIATIONS: Record<string, string> = {
  "Africa/Lagos": "WAT",
  UTC: "UTC",
  "Etc/UTC": "UTC",
};

export function zoneAbbreviation(zone: string, at?: string): string {
  if (ZONE_ABBREVIATIONS[zone]) return ZONE_ABBREVIATIONS[zone];
  const dt = (at ? DateTime.fromISO(at) : DateTime.now()).setZone(zone);
  return dt.isValid ? dt.toFormat("ZZZZ") : zone;
}

function toZoned(iso: string, zone: string): DateTime | null {
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
  return dt.isValid ? dt : null;
}

/** "10 Nov 2026, 10:00 WAT" */
export function formatDateTime(iso: string | null | undefined, zone: string = DISPLAY_TIMEZONE): string {
  if (!iso) return "—";
  const dt = toZoned(iso, zone);
  if (!dt) return "—";
  return `${dt.toFormat("d LLL yyyy, HH:mm")} ${zoneAbbreviation(zone, iso)}`;
}

/** "10:00 WAT" */
export function formatTime(iso: string | null | undefined, zone: string = DISPLAY_TIMEZONE): string {
  if (!iso) return "—";
  const dt = toZoned(iso, zone);
  return dt ? `${dt.toFormat("HH:mm")} ${zoneAbbreviation(zone, iso)}` : "—";
}

/** "Fri 13 Nov 2026" for a calendar date string, with no timezone shifting. */
export function formatDate(isoDate: string | null | undefined, opts: { weekday?: boolean } = {}): string {
  if (!isoDate) return "—";
  const dt = DateTime.fromISO(isoDate.slice(0, 10), { zone: "utc" });
  if (!dt.isValid) return "—";
  return dt.toFormat(opts.weekday === false ? "d LLL yyyy" : "ccc d LLL yyyy");
}

/** "Fri 13 Nov 2026 · 10:00–13:00 WAT" */
export function formatSessionWindow(s: { occurrenceDate: string; plannedStart: string; plannedEnd: string; timezone: string }): string {
  const start = toZoned(s.plannedStart, s.timezone);
  const end = toZoned(s.plannedEnd, s.timezone);
  if (!start || !end) return formatDate(s.occurrenceDate);
  return `${formatDate(s.occurrenceDate)} · ${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")} ${zoneAbbreviation(s.timezone, s.plannedStart)}`;
}

/** Relative description such as "3 hours ago" / "in 2 days". */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Never";
  const dt = DateTime.fromISO(iso);
  if (!dt.isValid) return "—";
  return dt.toRelative({ base: DateTime.fromJSDate(now) }) ?? "—";
}

export function todayInZone(zone: string = DISPLAY_TIMEZONE, now: Date = new Date()): string {
  return DateTime.fromJSDate(now).setZone(zone).toISODate()!;
}

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: "utc" }).plus({ days }).toISODate()!;
}

/**
 * Converts a `<input type="datetime-local">` value ("2026-11-13T10:00") interpreted in `zone`
 * to a UTC ISO instant with offset, as the API expects. Returns null for empty/invalid input.
 */
export function localInputToIso(value: string, zone: string): string | null {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone });
  return dt.isValid ? dt.toUTC().toISO({ suppressMilliseconds: true }) : null;
}

/** The inverse: a UTC instant rendered as a datetime-local value in `zone`. */
export function isoToLocalInput(iso: string | null | undefined, zone: string): string {
  if (!iso) return "";
  const dt = toZoned(iso, zone);
  return dt ? dt.toFormat("yyyy-LL-dd'T'HH:mm") : "";
}

/** Current wall-clock time in `zone` as a datetime-local value. */
export function nowLocalInput(zone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now).setZone(zone).toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Start/end instants of a local calendar day range, for APIs that filter on instants (audit). */
export function dayRangeToInstants(from: string | undefined, to: string | undefined, zone: string = DISPLAY_TIMEZONE) {
  return {
    from: from ? DateTime.fromISO(from, { zone }).startOf("day").toUTC().toISO()! : undefined,
    to: to ? DateTime.fromISO(to, { zone }).endOf("day").toUTC().toISO()! : undefined,
  };
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** ISO weekday (1 = Monday … 7 = Sunday) to a name. */
export function weekdayName(isoWeekday: number): string {
  return WEEKDAYS[isoWeekday - 1] ?? "—";
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${ms} ms`;
  if (abs < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (abs < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

/** Common IANA zones offered in pickers (the backend accepts any valid IANA zone). */
export const COMMON_TIMEZONES = ["Africa/Lagos", "UTC", "Africa/Accra", "Africa/Abidjan", "Europe/London"];

/** The local calendar date of an instant, e.g. "13 Nov 2026" (for joined/left timestamps). */
export function formatInstantDate(iso: string | null | undefined, zone: string = DISPLAY_TIMEZONE): string {
  if (!iso) return "—";
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
  return dt.isValid ? dt.toFormat("d LLL yyyy") : "—";
}
