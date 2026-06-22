"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { loadInfrastructurePostureData, postureLabel, postureTone, resolveInfrastructurePosture, type InfrastructurePostureData, type InfrastructurePostureRow } from "@/services/infrastructurePostureService";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";

export default function UnifiedInfrastructurePosture() {
  const [data, setData] = useState<InfrastructurePostureData | null>(null);
  const [rows, setRows] = useState<InfrastructurePostureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadInfrastructurePostureData().then((next) => {
      if (!mounted) return;
      setData(next);
      setRows(resolveInfrastructurePosture(next));
    }).catch(() => {
      if (!mounted) return;
      setData(null);
      setRows([]);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Infrastructure Posture</h2><p className="mt-1 text-xs text-zinc-500">Current state across estate infrastructure sources.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-200" /> : null}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{rows.map((row) => <button key={row.source} type="button" onClick={() => openInfrastructureDrawer(row.source)} className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-sky-400/25 hover:bg-white/[0.045]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-zinc-100">{row.label}</span><ChevronRight className="h-4 w-4 text-zinc-600" /></div><span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase ${postureTone(row.state)}`}>{postureLabel(row.state)}</span><p className="mt-2 text-xs leading-5 text-zinc-400">{row.affected ? `${row.affected} affected · ` : ""}{row.reason}</p></button>)}{!loading && !rows.length ? <p className="text-xs text-zinc-500">Infrastructure posture is unavailable for this facility context.</p> : null}</div></section>;
}
