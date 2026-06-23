"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { loadInfrastructurePostureData, postureLabel, resolveInfrastructurePosture, type InfrastructurePostureRow } from "@/services/infrastructurePostureService";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";

const postureStatus = (state: InfrastructurePostureRow["state"]): OisStatus => state === "stable" ? "stable" : state === "attention" ? "attention" : state === "degraded" ? "critical" : "unavailable";

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

  return <OisCard as="section" className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Infrastructure Posture</h2><p className="mt-1 text-xs text-zinc-500">Current state across estate infrastructure sources.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-200" /> : null}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{rows.map((row) => <button key={row.source} type="button" onClick={() => openInfrastructureDrawer(row.source)} className="block text-left">
    <OisListItem
      title={<span>{row.label}</span>}
      description={`${row.affected ? `${row.affected} affected · ` : ""}${row.reason}`}
      meta={<OisStatusBadge status={postureStatus(row.state)} label={postureLabel(row.state)} />}
      action={<ChevronRight className="h-4 w-4 text-zinc-600" />}
      className="h-full"
    />
  </button>)}{!loading && !rows.length ? <p className="text-xs text-zinc-500">Infrastructure posture is unavailable for this facility context.</p> : null}</div></OisCard>;
}
