"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronDown, KeyRound, LogOut, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NativeSelect } from "@/components/common/form";
import { useAttention } from "@/features/dashboard/use-attention";
import { useAuth, useCurrentUser } from "@/lib/auth/auth-context";
import { useGroups } from "@/lib/group-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { Brand, SidebarNav } from "./sidebar";
import { titleForPath } from "./nav";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function GroupSwitcher() {
  const { groups, activeGroupId, setActiveGroupId, activeGroup } = useGroups();
  const user = useCurrentUser();
  if (groups.length === 0) return null;
  if (groups.length === 1) {
    return (
      <div className="hidden min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-sm sm:flex" title="Your CDS group">
        <span className="text-xs text-muted-foreground">Group</span>
        <span className="truncate font-medium">{groups[0].name}</span>
      </div>
    );
  }
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Working group</span>
      <NativeSelect
        value={activeGroupId ?? ""}
        onChange={(e) => setActiveGroupId(e.target.value || null)}
        className="h-8 max-w-[11rem] sm:max-w-[16rem]"
        title={activeGroup ? `Working in ${activeGroup.name}` : "Showing all groups you can access"}
      >
        <option value="">{user.role === "SUPER_ADMIN" ? "All CDS groups" : "All my groups"}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {g.status === "INACTIVE" ? " (inactive)" : ""}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function AttentionMenu() {
  const { activeGroupId } = useGroups();
  const { items, total } = useAttention(activeGroupId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Needs attention: ${total} item${total === 1 ? "" : "s"}`}>
          <Bell />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Needs attention</p>
          <p className="text-xs text-muted-foreground">Live counts from the attendance service</p>
        </div>
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-muted/50">
                <span className="min-w-0">
                  <span className="block text-sm">{i.label}</span>
                  <span className="block text-xs text-muted-foreground">{i.description}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{i.count ?? "…"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(user.fullName)}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium">{user.fullName}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound /> Account details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#password">
            <KeyRound /> Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={async (e) => {
            e.preventDefault();
            setSigningOut(true);
            await signOut();
          }}
        >
          <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{titleForPath(pathname)}</p>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        <GroupSwitcher />
        <AttentionMenu />
        <UserMenu />
      </div>
    </header>
  );
}
