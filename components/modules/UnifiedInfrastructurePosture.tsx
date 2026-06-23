"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { loadInfrastructurePostureData, postureLabel, resolveInfrastructurePosture, type InfrastructurePostureRow } from "@/services/infrastructurePostureService";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";

const postureStatus = (state: InfrastructurePostureRow["state"]): OisStatus => state === "stable" ? "stable" : state === "attention" ? "attention" : state === "degraded" ? "critical" : "unavailable";
const badgeClass = "px-1.5 py-px text-[10px] opacity-75";

export default function UnifiedInfrastructurePosture() {
  const [rows, setRows] = useState<InfrastructurePostureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadInfrastructurePostureData().then((next) => {
      if (!mounted) return;
      setRows(resolveInfrastructurePosture(next));
    }).catch(() => {
      if (!mounted) return;
      setRows([]);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return <OisCard as="section" className="h-full border-white/[0.06] bg-white/[0.024] p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Infrastructure Posture</h2><p className="mt-1 text-[11px] leading-4 text-zinc-500">Current state across estate infrastructure sources.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-200" /> : null}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{rows.map((row) => <button key={row.source} type="button" onClick={() => openInfrastructureDrawer(row.source)} className="block text-left">
    <OisListItem
      title={<span className="font-medium text-white">{row.label}</span>}
      description={<span className="text-[11px] text-zinc-500">{row.reason}</span>}
      meta={<span className="text-[11px] text-zinc-500">{row.affected ? `${row.affected} affected` : "0 affected"}</span>}
      action={<OisStatusBadge status={postureStatus(row.state)} label={postureLabel(row.state)} className={badgeClass} />}
      className="h-full gap-2"
    />
  </button>)}{!loading && !rows.length ? <p className="text-xs text-zinc-500">Infrastructure posture is unavailable for this facility context.</p> : null}</div></OisCard>;
}
