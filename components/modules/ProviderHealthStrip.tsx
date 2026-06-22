"use client";

import { postureLabel, postureTone, type InfrastructurePostureState } from "@/services/infrastructurePostureService";

function providerState(provider: any): InfrastructurePostureState {
  const value = String(provider?.status || "").toLowerCase();
  if (/provider_error|disconnected|failed/.test(value) || Number(provider?.sync_errors || 0) > 0) return "degraded";
  if (/pending_configuration|warning/.test(value)) return "attention";
  if (/connected|healthy|online/.test(value)) return "stable";
  return "unavailable";
}

export default function ProviderHealthStrip({ providers, available }: { providers: any[]; available: boolean }) {
  if (!available) return <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">Provider health is unavailable for this facility context.</p>;
  const configured = providers.filter((provider) => !/pending_configuration/i.test(String(provider?.status || "")));
  if (!configured.length) return <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">No configured provider integration is available.</p>;
  return <div className="space-y-2">{configured.slice(0, 5).map((provider) => {
    const state = providerState(provider);
    return <div key={provider.key || provider.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs"><div className="min-w-0"><b className="block truncate text-zinc-100">{provider.name || provider.key || "Provider"}</b><span className="mt-1 block text-zinc-500">{provider.last_sync_at ? `Last sync ${new Date(provider.last_sync_at).toLocaleString()}` : "Sync time unavailable"}</span></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase ${postureTone(state)}`}>{postureLabel(state)}</span></div>;
  })}</div>;
}
