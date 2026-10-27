"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nfc, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { visibleNav } from "./nav";

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const sections = visibleNav(can);
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-2 py-4">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/50 uppercase">{section.label}</p>
          )}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/overview" className={cn("flex h-14 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
      <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Nfc className="size-4" aria-hidden />
      </span>
      {!collapsed && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-primary">DTI CDS</span>
          <span className="text-[11px] text-sidebar-foreground/70">Digital Attendance</span>
        </span>
      )}
    </Link>
  );
}

export function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <Brand collapsed={collapsed} />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 items-center gap-2 border-t border-sidebar-border px-4 text-xs text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="mx-auto size-4" /> : <PanelLeftClose className="size-4" />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
