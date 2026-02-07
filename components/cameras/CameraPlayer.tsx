// components/cameras/CameraPlayer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cameraService from "@/services/cameraService";

type Props = {
  cameraId: string;
  poster?: string;
  muted?: boolean;
  autoPlay?: boolean;
};

export default function CameraPlayer({
  cameraId,
  poster,
  muted = true,
  autoPlay = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [src, setSrc] = useState<string>("");

  const isHlsNative = useMemo(() => {
    if (typeof document === "undefined") return false;
    const v = document.createElement("video");
    return v.canPlayType("application/vnd.apple.mpegurl") !== "";
  }, []);

  // ✅ Fetch token + build src, refresh every 60s
  useEffect(() => {
    let alive = true;
    let timer: any = null;

    async function refreshTokenAndSrc() {
      try {
        setErr(null);
        const res = await cameraService.getHlsToken(cameraId);
        if (!alive) return;

        const url = cameraService.hlsUrl(cameraId, res.token);
        setSrc(url);
      } catch (e: any) {
        if (!alive) return;
        const msg = e?.response?.data?.error || e?.message || "Failed to load stream token";
        setErr(String(msg));
      }
    }

    refreshTokenAndSrc();

    // token is 2 mins on backend; refresh every 60s to stay safe
    timer = setInterval(refreshTokenAndSrc, 60_000);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [cameraId]);

  // ✅ Mount HLS playback whenever src changes
  useEffect(() => {
    let hls: any;

    async function mount() {
      setErr((prev) => prev); // keep err if any
      const video = videoRef.current;
      if (!video || !src) return;

      // reset
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}

      // ✅ Safari native HLS
      if (isHlsNative) {
        video.src = src;
        try {
          if (autoPlay) await video.play();
        } catch {}
        return;
      }

      // ✅ Non-safari via hls.js
      try {
        const mod = await import("hls.js");
        const Hls = mod.default;

        if (!Hls.isSupported()) {
          setErr("HLS not supported in this browser.");
          return;
        }

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src);
        });

        hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
          if (data?.fatal) {
            setErr(data?.details || "Stream error");
            try {
              hls.destroy();
            } catch {}
          }
        });

        try {
          if (autoPlay) await video.play();
        } catch {}
      } catch (e: any) {
        setErr(e?.message || "Failed to load HLS player.");
      }
    }

    mount();

    return () => {
      try {
        hls?.destroy?.();
      } catch {}
    };
  }, [src, autoPlay, isHlsNative]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
      <video
        ref={videoRef}
        className="w-full aspect-video bg-black"
        controls
        muted={muted}
        playsInline
        poster={poster}
      />
      {err && (
        <div className="px-3 py-2 text-xs text-red-200 bg-red-500/10 border-t border-red-500/20">
          {err}
        </div>
      )}
      {!err && !src && (
        <div className="px-3 py-2 text-xs text-zinc-300 bg-white/5 border-t border-white/10">
          Loading stream…
        </div>
      )}
    </div>
  );
}
