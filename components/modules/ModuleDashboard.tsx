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
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export type ModuleMetric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export type ModuleTab = {
  label: string;
  href: string;
};

export type ModuleWidget = {
  title: string;
  body: string;
  href?: string;
  icon?: LucideIcon;
};

export type ModuleAction = {
  label: string;
  href: string;
};

function toneClass(tone: ModuleMetric["tone"] = "neutral") {
  if (tone === "good") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  if (tone === "warn") return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  if (tone === "bad") return "border-red-500/20 bg-red-500/10 text-red-100";
  return "border-white/10 bg-white/[0.045] text-zinc-100";
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
  return (
    <div className="space-y-6">
      <Topbar title={title} subtitle={subtitle} />

      <nav className="flex gap-5 overflow-x-auto border-b border-white/10 text-sm text-zinc-400">
        {tabs.map((tab, index) => (
          <Link
            key={`${tab.label}-${tab.href}`}
            href={tab.href}
            className={`shrink-0 border-b-2 px-1 pb-3 transition hover:text-white ${
              index === 0 ? "border-violet-400 text-white" : "border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,77,255,0.18),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 lg:p-8">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-violet-200/80">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:text-5xl">{title}</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-300 lg:text-base">{subtitle}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className={`rounded-2xl border p-5 ${toneClass(metric.tone)}`}>
            <div className="text-xs opacity-75">{metric.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{metric.value}</div>
            {metric.hint ? <div className="mt-2 text-xs opacity-65">{metric.hint}</div> : null}
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          {widgets.map((widget, index) => {
            const Icon = widget.icon || [Layers3, Activity, ShieldCheck, BarChart3][index % 4];
            const content = (
              <article className="h-full rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:border-violet-400/25 hover:bg-white/[0.065]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{widget.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{widget.body}</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-violet-200">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
            return widget.href ? <Link key={widget.title} href={widget.href}>{content}</Link> : <div key={widget.title}>{content}</div>;
          })}
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
              <Sparkles className="h-4 w-4 text-violet-200" />
            </div>
            <div className="mt-4 grid gap-2">
              {actions.map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 transition hover:border-violet-400/30 hover:bg-white/10">
                  {action.label}
                  <ArrowRight className="h-4 w-4 text-zinc-500" />
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <h3 className="text-sm font-semibold text-white">Realtime Activity</h3>
            <div className="mt-4 space-y-3">
              {activity.map((item, index) => (
                <div key={item} className="flex gap-3 text-sm text-zinc-300">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
                  <span>{item}</span>
                  {index === 0 ? <Clock3 className="ml-auto h-4 w-4 text-zinc-500" /> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <h3 className="text-sm font-semibold text-white">AI / Ops Insights</h3>
            <div className="mt-4 space-y-3">
              {insights.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                  <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
