"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import CameraPlayer from "@/components/cameras/CameraPlayer";
import cameraService, { type BoundCamera, type DiscoveredCamera } from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";

function extractErr(e: any) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.error || e?.message || "Request failed";
  return { status, msg: String(msg) };
}

function ipFromDiscovered(d: DiscoveredCamera) {
  return (
    d?.metadata?.raw?.ip ||
    d?.metadata?.ip ||
    d?.externalId ||
    ""
  );
}

export default function CamerasPage() {
  const [estateId, setEstateId] = useState<string | null>(null);

  const [items, setItems] = useState<BoundCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<DiscoveredCamera[]>([]);

  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // bind state
  const [binding, setBinding] = useState(false);
  const [bindName, setBindName] = useState("");
  const [selected, setSelected] = useState<DiscoveredCamera | null>(null);

  const selectedIp = useMemo(() => (selected ? ipFromDiscovered(selected) : ""), [selected]);

  async function hydrateEstate() {
    // same strategy as your overview page
    try {
      const res = await facilityService.overview();
      if (res?.estate_id) {
        setEstateId(res.estate_id);
        return res.estate_id as string;
      }
    } catch {}

    try {
      const r = await facilityService.myEstates();
      const first = r?.estates?.[0];
      if (first?.id) {
        setEstateId(first.id);
        return first.id as string;
      }
    } catch {}

    setEstateId(null);
    return null;
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const eid = estateId || (await hydrateEstate());
      if (!eid) {
        setItems([]);
        setErr("No site linked yet. Create/Join a site first.");
        return;
      }

      const res = await cameraService.listByEstate(eid);
      setItems(res?.items || []);
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function scan() {
    setScanErr(null);
    setScanning(true);
    setScanResults([]);
    setSelected(null);

    try {
      const res = await cameraService.scan({
        cidr: cidr.trim() || undefined,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
      });

      setScanResults(res?.items || []);
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setScanErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }

  async function bindSelected() {
    if (!selected) return;
    const ip = selectedIp;
    const rtsp = selected?.metadata?.raw?.rtsp || selected?.metadata?.rtsp || "";

    if (!ip) {
      setScanErr("Selected camera has no IP in metadata. (metadata.raw.ip missing)");
      return;
    }
    if (!rtsp) {
      setScanErr("Selected camera has no RTSP URI. Ensure ONVIF stream URI was discovered.");
      return;
    }

    setScanErr(null);
    setBinding(true);
    try {
      const payload = {
        estateId: estateId || undefined,
        name: bindName.trim() || selected.name || `Camera ${ip}`,
        ip,
        onvif_port: selected?.metadata?.raw?.onvifPort || selected?.metadata?.onvifPort || null,
        rtsp_url: rtsp,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
      };

      await cameraService.bind(payload);
      setSelected(null);
      setBindName("");
      setScanOpen(false);
      await load();
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setScanErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
    } finally {
      setBinding(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-7">
      <Topbar title="Cameras" subtitle="Discovery • binding • live stream" />

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button onClick={() => setScanOpen(true)}>Scan Cameras</Button>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!!err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Bound cameras */}
      {items.length === 0 ? (
        <div className="glass p-6 text-sm text-zinc-400">
          No cameras bound yet. Click <span className="text-zinc-200">Scan Cameras</span> to find ONVIF cameras on your network.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="glass p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {c.name || `Camera ${c.ip}`}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    IP: <span className="text-zinc-200">{c.ip}</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-500">Live</div>
              </div>

              <CameraPlayer src={cameraService.hlsUrl(c.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Scan modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !scanning && !binding && setScanOpen(false)}
          />

          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Scan Cameras (ONVIF)</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {scanning ? "Scanning..." : `Found ${scanResults.length} camera(s)`}
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !scanning && !binding && setScanOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="CIDR (e.g. 192.168.1.0/24)"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                disabled={scanning || binding}
              />
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="ONVIF username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={scanning || binding}
              />
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="ONVIF password (optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={scanning || binding}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={scan} disabled={scanning || binding}>
                {scanning ? "Scanning..." : "Scan"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setScanResults([]);
                  setSelected(null);
                  setScanErr(null);
                }}
                disabled={scanning || binding}
              >
                Clear
              </Button>
            </div>

            {scanErr && (
              <div className="mt-4 glass border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {scanErr}
              </div>
            )}

            {/* results */}
            <div className="mt-5 overflow-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2">Pick</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">IP</th>
                    <th className="text-left py-2">RTSP</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map((d, idx) => {
                    const ip = ipFromDiscovered(d);
                    const rtsp = d?.metadata?.raw?.rtsp || d?.metadata?.rtsp || "";
                    const picked = selected?.externalId === d.externalId;

                    return (
                      <tr key={`${d.externalId}-${idx}`} className="border-b border-white/5">
                        <td className="py-3">
                          <input
                            type="radio"
                            name="cam"
                            checked={picked}
                            onChange={() => setSelected(d)}
                            disabled={scanning || binding}
                          />
                        </td>
                        <td className="py-3 text-zinc-100">{d.name}</td>
                        <td className="py-3 text-zinc-300">{ip || "—"}</td>
                        <td className="py-3 text-zinc-300 truncate max-w-[320px]">
                          {rtsp ? rtsp : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {!scanResults.length && !scanning && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500">
                        No cameras found yet. Enter CIDR and Scan.
                      </td>
                    </tr>
                  )}

                  {scanning && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-400">
                        Scanning… please wait.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* bind panel */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-xs text-zinc-500 mb-2">Bind name</div>
                <input
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder={selected ? (selected.name || "Camera name") : "Select a camera first"}
                  value={bindName}
                  onChange={(e) => setBindName(e.target.value)}
                  disabled={!selected || scanning || binding}
                />
              </div>

              <Button onClick={bindSelected} disabled={!selected || scanning || binding}>
                {binding ? "Binding..." : "Bind Camera"}
              </Button>
            </div>

            {/* quick preview */}
            {selected && (
              <div className="mt-5 glass p-4">
                <div className="text-sm font-medium">Preview (after you bind)</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Stream will appear on this page after binding.
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScanOpen(false)} disabled={scanning || binding}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
