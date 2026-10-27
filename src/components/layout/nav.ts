import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only when the user's role has this permission (the backend enforces it regardless). */
  permission?: Permission;
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard, permission: Permission.GROUPS_READ },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck, permission: Permission.ATTENDANCE_READ },
      { href: "/sessions", label: "Sessions", icon: CalendarDays, permission: Permission.SESSIONS_READ },
      { href: "/members", label: "Members", icon: Users, permission: Permission.MEMBERS_READ },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/groups", label: "CDS Groups", icon: UsersRound, permission: Permission.GROUPS_READ },
      { href: "/schedules", label: "Schedules", icon: CalendarClock, permission: Permission.SCHEDULES_READ },
      { href: "/cards", label: "NFC Cards", icon: CreditCard, permission: Permission.CARDS_READ },
      { href: "/devices", label: "Devices", icon: Smartphone, permission: Permission.DEVICES_READ },
    ],
  },
  {
    label: "Oversight",
    items: [
      { href: "/reports", label: "Reports", icon: FileBarChart, permission: Permission.REPORTS_READ },
      { href: "/audit", label: "Audit Logs", icon: ScrollText, permission: Permission.AUDIT_READ },
      { href: "/users", label: "User Management", icon: ShieldCheck, permission: Permission.USERS_MANAGE },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function visibleNav(can: (p: Permission) => boolean) {
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || can(i.permission)) })).filter(
    (s) => s.items.length > 0,
  );
}

export function titleForPath(pathname: string): string {
  for (const s of NAV_SECTIONS) {
    for (const i of s.items) {
      if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return i.label;
    }
  }
  return "Dashboard";
}
