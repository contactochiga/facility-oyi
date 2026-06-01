import type { ReactNode } from "react";
import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Layers3,
  LucideIcon,
  PauseCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type ModuleMetric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "pending";
  status?: "live" | "pending" | "missing" | "ready";
};

export type ModuleTab = {
  label: string;
  href: string;
  disabled?: boolean;
};

export type ModuleWidget = {
  title: string;
  body: string;
  href?: string;
  icon?: LucideIcon;
  status?: "Live" | "Pending Integration" | "No Data Yet" | "Source Missing" | "Ready";
};

export type ModuleAction = {
  label: string;
  href?: string;
  disabled?: boolean;
  pendingLabel?: string;
};

function toneClass(tone: ModuleMetric["tone"] = "neutral") {
  if (tone === "good") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  if (tone === "warn") return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  if (tone === "bad") return "border-red-500/20 bg-red-500/10 text-red-100";
  if (tone === "pending") return "border-sky-500/20 bg-sky-500/10 text-sky-100";
  return "border-white/10 bg-white/[0.045] text-zinc-100";
}

function statusClass(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s.includes("live") || s.includes("ready")) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (s.includes("pending")) return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  if (s.includes("missing")) return "border-red-500/20 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-500">
      {children}
    </div>
  );
}

export default function ModuleDashboard({
  title,
  subtitle,
  eyebrow = "Facility Module",
  tabs,
  metrics,
  widgets,
  actions,
  activity,
  insights,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  tabs: ModuleTab[];
  metrics: ModuleMetric[];
  widgets: ModuleWidget[];
  actions: ModuleAction[];
  activity: string[];
  insights: string[];
}) {
  const safeTabs = tabs.filter(Boolean);
  const safeMetrics = metrics.filter(Boolean);
  const safeWidgets = widgets.filter(Boolean);
  const safeActions = actions.filter(Boolean);

  return (
    <div className="space-y-6">
      <Topbar title={title} subtitle={subtitle} />

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-1 text-sm text-zinc-400">
        {safeTabs.map((tab, index) => {
          const active = index === 0;
          const className = `shrink-0 rounded-xl px-3 py-2 transition ${
            active
              ? "bg-violet-500/20 text-white shadow-[0_0_22px_rgba(124,58,237,0.16)]"
              : tab.disabled
              ? "cursor-not-allowed text-zinc-600"
              : "hover:bg-white/5 hover:text-white"
          }`;
          return tab.disabled ? (
            <span key={`${tab.label}-${tab.href}`} className={className} aria-disabled="true">
              {tab.label}
            </span>
          ) : (
            <Link key={`${tab.label}-${tab.href}`} href={tab.href} className={className}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(124,77,255,0.16),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-6 lg:p-7">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-300 lg:text-base">{subtitle}</p>
          </div>
          <div className="grid min-w-[220px] gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-zinc-400">
            <div className="flex items-center justify-between gap-3">
              <span>Runtime Scope</span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">Estate</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Data Policy</span>
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-sky-200">Live or Pending</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {safeMetrics.length ? safeMetrics.map((metric) => (
          <article key={metric.label} className={`rounded-2xl border p-5 ${toneClass(metric.tone)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.14em] opacity-70">{metric.label}</div>
              {metric.status ? (
                <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClass(metric.status)}`}>
                  {metric.status}
                </span>
              ) : null}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight lg:text-3xl">{metric.value}</div>
            {metric.hint ? <div className="mt-2 text-xs leading-5 opacity-65">{metric.hint}</div> : null}
          </article>
        )) : <EmptyLine>No module metrics are available yet.</EmptyLine>}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          {safeWidgets.length ? safeWidgets.map((widget, index) => {
            const Icon = widget.icon || [Layers3, Activity, ShieldCheck, BarChart3][index % 4];
            const card = (
              <article className="h-full rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:border-violet-400/25 hover:bg-white/[0.065]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{widget.title}</h3>
                      {widget.status ? (
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(widget.status)}`}>
                          {widget.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{widget.body}</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-violet-200">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
            return widget.href ? (
              <Link key={widget.title} href={widget.href} className="block h-full">{card}</Link>
            ) : (
              <div key={widget.title} className="h-full">{card}</div>
            );
          }) : <EmptyLine>No module sections have been configured yet.</EmptyLine>}
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
              <Sparkles className="h-4 w-4 text-violet-200" />
            </div>
            <div className="mt-4 grid gap-2">
              {safeActions.length ? safeActions.map((action) => {
                const disabled = action.disabled || !action.href;
                const className = `flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                  disabled
                    ? "cursor-not-allowed border-white/5 bg-black/10 text-zinc-600"
                    : "border-white/10 bg-black/20 text-zinc-200 hover:border-violet-400/30 hover:bg-white/10"
                }`;
                return disabled ? (
                  <span key={action.label} className={className} aria-disabled="true">
                    <span>{action.label}</span>
                    <span className="flex items-center gap-1 text-[11px] text-amber-200/70">
                      <PauseCircle className="h-3.5 w-3.5" />
                      {action.pendingLabel || "Pending"}
                    </span>
                  </span>
                ) : (
                  <Link key={action.label} href={action.href!} className={className}>
                    {action.label}
                    <ArrowRight className="h-4 w-4 text-zinc-500" />
                  </Link>
                );
              }) : <EmptyLine>No actions are available for this permission scope.</EmptyLine>}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <h3 className="text-sm font-semibold text-white">Realtime Activity</h3>
            <div className="mt-4 space-y-3">
              {activity.length ? activity.map((item, index) => (
                <div key={item} className="flex gap-3 text-sm text-zinc-300">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
                  <span className="leading-5">{item}</span>
                  {index === 0 ? <Clock3 className="ml-auto h-4 w-4 shrink-0 text-zinc-500" /> : null}
                </div>
              )) : <EmptyLine>No realtime events have arrived for this module yet.</EmptyLine>}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <h3 className="text-sm font-semibold text-white">AI / Ops Insights</h3>
            <div className="mt-4 space-y-3">
              {insights.length ? insights.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-5 text-zinc-300">
                  <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              )) : <EmptyLine>Insights will appear when live estate activity is available.</EmptyLine>}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
