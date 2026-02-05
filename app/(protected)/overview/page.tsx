"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import type { FacilityOverview } from "@/types/facility";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import {
  communityService,
  type CommunityPost,
} from "@/services/communityService";
import Link from "next/link";

// ✅ Cameras
import { cameraService, type BoundCamera } from "@/services/cameraService";

/* -------------------------------------------------- */
/* Helpers                                            */
/* -------------------------------------------------- */

function series(seed = 10) {
  const now = Date.now();
  return Array.from({ length: 12 }).map((_, i) => ({
    x: new Date(now - (11 - i) * 24 * 3600 * 1000).toLocaleDateString([], {
      month: "short",
      day: "2-digit",
    }),
    y: Math.max(0, Math.round(seed + Math.random() * seed * 2)),
  }));
}

function score(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function OpsPill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : value >= 55
      ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
      : "border-red-500/20 bg-red-500/10 text-red-200";

  return (
    <div className={`glass p-4 border ${color}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-xl font-semibold">{value}%</div>
    </div>
  );
}

function extractErr(e: any) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.error || e?.message || "Request failed";
  return { status, msg: String(msg) };
}

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------- */
/* Minimal HLS Player                                 */
/* -------------------------------------------------- */

function HlsVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let hls: any = null;
    let cancelled = false;

    async function attach() {
      const video = ref.current;
      if (!video) return;

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }

      const mod = await import("hls.js");
      if (cancelled) return;

      const Hls = mod.default;
      if (!Hls.isSupported()) {
        video.src = src;
        return;
      }

      hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    }

    attach();

    return () => {
      cancelled = true;
      try {
        if (hls) hls.destroy();
      } catch {}
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className="w-full rounded-xl border border-white/10 bg-black/40"
      controls
      playsInline
      muted
      autoPlay
    />
  );
}

/* -------------------------------------------------- */
/* Page                                               */
/* -------------------------------------------------- */

export default function OverviewPage() {
  const [data, setData] = useState<FacilityOverview | null>(null);

  const [estateId, setEstateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const [needsEstate, setNeedsEstate] = useState(false);
  const [syncingEstate, setSyncingEstate] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const [estateForm, setEstateForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    type: "estate",
  });

  const [communityItems, setCommunityItems] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityErr, setCommunityErr] = useState<string | null>(null);

  const [cameras, setCameras] = useState<BoundCamera[]>([]);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const trendDevices = useMemo(() => series(8), []);
  const trendVisitors = useMemo(() => series(5), []);
  const trendWallet = useMemo(() => series(12), []);

  const canCreateEstate = estateForm.name.trim().length > 1;

  async function loadCameras(eid?: string | null) {
    const estate = eid || estateId;
    if (!estate) return;

    setCameraLoading(true);
    setCameraErr(null);

    try {
      const res = await cameraService.listByEstate(estate);

      // ✅ FIX: explicit typing
      const items: BoundCamera[] = Array.isArray(res?.items)
        ? res.items
        : [];

      setCameras(items);

      if (!activeCameraId && items[0]?.id) {
        setActiveCameraId(items[0].id);
      }

      if (activeCameraId && !items.some((c) => c.id === activeCameraId)) {
        setActiveCameraId(items[0]?.id || null);
      }
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setCameraErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setCameras([]);
      setActiveCameraId(null);
    } finally {
      setCameraLoading(false);
    }
  }

  /* ---------- rest of file unchanged ---------- */

  // (Everything below remains EXACTLY as you pasted)

}
