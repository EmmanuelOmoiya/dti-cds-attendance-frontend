"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatPercent } from "@/lib/datetime";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{title}</p>
      {lines.map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

export interface TrendPoint {
  date: string;
  title: string;
  rate: number;
  present: number;
  eligible: number;
}

/** Attendance rate of each held session over time (single series, so no legend). */
export function AttendanceTrendChart({ data, summary }: { data: TrendPoint[]; summary: string }) {
  return (
    <figure className="p-4">
      <div className="h-64 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={(d: string) => formatDate(d, { weekday: false }).replace(/ \d{4}$/, "")} minTickGap={24} />
            <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={44} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as TrendPoint | undefined;
                return p ? <TooltipBox title={`${formatDate(p.date)} · ${p.title}`} lines={[`${formatPercent(p.rate)} attendance`, `${p.present} of ${p.eligible} eligible present`]} /> : null;
              }}
            />
            <Line type="monotone" dataKey="rate" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{summary}</figcaption>
    </figure>
  );
}

export interface GroupBar {
  name: string;
  rate: number;
  held: number;
}

/** Pooled attendance rate per group for the same period (single series). */
export function GroupComparisonChart({ data, summary }: { data: GroupBar[]; summary: string }) {
  return (
    <figure className="p-4">
      <div style={{ height: Math.max(160, data.length * 36 + 40) }} className="w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }} barCategoryGap={8}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={140} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as GroupBar | undefined;
                return p ? <TooltipBox title={p.name} lines={[`${formatPercent(p.rate)} pooled attendance`, `${p.held} held session${p.held === 1 ? "" : "s"}`]} /> : null;
              }}
            />
            <Bar dataKey="rate" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{summary}</figcaption>
    </figure>
  );
}
