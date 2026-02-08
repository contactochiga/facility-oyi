"use client";

import { useEffect, useMemo, useState } from "react";
import CameraPlayer from "@/components/cameras/CameraPlayer";
import cameraService, { type BoundCamera } from "@/services/cameraService";

type Props = {
  estateId: string;
  title?: string;
  subtitle?: string;

  // layout knobs
  maxCameras?: number; // total in widget (default 4 = 1 big + 3 small)
};

export default function MultiCameraWall({
  estateId,
  title = "Live Cameras",
  subtitle = "HLS stream • facility view • estate security",
  maxCameras = 4,
}: Props) {
  const [items, setItems] = useState<BoundCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await cameraService.listByEstate(estateId);
      const list = (res?.items || []) as BoundCamera[];
      setItems(list);

      // keep current selection if still exists, else pick first
      if (list.length) {
        setActiveId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
      } else {
        setActiveId(null);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to load cameras";
      setErr(String(msg));
      setItems([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!estateId) return;
    load();
    // IMPORTANT: No widget refresh button. If you want periodic refresh,
    // do it at page-level, not inside this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  const visible = useMemo(() => {
    // show active first, then the rest, limited to maxCameras
    if (!items.length) return [];
    const active = items.find((c) => c.id === activeId) || items[0];
    const rest = items.filter((c) => c.id !== active.id);
    return [active, ...rest].slice(0, Math.max(1, maxCameras));
  }, [items, activeId, maxCameras]);

  const active = visible[0];
  const others = visible.slice(1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="text-xs text-white/60">{subtitle}</div>
        </div>

        {/* No refresh button here */}
        {loading && <div className="text-xs text-white/50">Loading…</div>}
      </div>

      {!!err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
          No cameras bound yet.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          {/* BIG SCREEN */}
          <div className="col-span-12 lg:col-span-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {/* Label */}
              <div className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                ● LIVE <span className="opacity-70">/</span> {active?.name || "Camera"}
              </div>

              {/* Player */}
              <CameraPlayer
                cameraId={active.id}
                muted={false}
                autoPlay={true}
                // new props we’ll add below (optional; safe)
                controls={true}
                variant="hero"
              />

              {/* Quick switch chips */}
              <div className="flex flex-wrap gap-2 border-t border-white/10 bg-black/30 p-3">
                {items.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={[
                      "rounded-full px-3 py-1 text-xs transition",
                      c.id === active.id
                        ? "bg-white/15 text-white"
                        : "bg-white/5 text-white/70 hover:bg-white/10",
                    ].join(" ")}
                    title={c.name || `Camera ${c.ip}`}
                  >
                    {c.name || "Camera"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SMALL PREVIEWS */}
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className="text-left"
                title={c.name || `Camera ${c.ip}`}
              >
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 hover:border-white/20 transition">
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                    {c.name || "Camera"}
                  </div>

                  <CameraPlayer
                    cameraId={c.id}
                    muted={true}
                    autoPlay={true}
                    controls={false}
                    variant="tile"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
