// components/cameras/CameraPlayer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  muted?: boolean;
  autoPlay?: boolean;
};

export default function CameraPlayer({
  src,
  poster,
  muted = true,
  autoPlay = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const isHlsNative = useMemo(() => {
    if (typeof document === "undefined") return false;
    const v = document.createElement("video");
    return v.canPlayType("application/vnd.apple.mpegurl") !== "";
  }, []);

  useEffect(() => {
    let hls: any;

    async function mount() {
      setErr(null);
      const video = videoRef.current;
      if (!video) return;

      video.pause();
      video.removeAttribute("src");
      video.load();

      // ✅ Safari / iOS native HLS (cookies will be sent if crossOrigin is set)
      if (isHlsNative) {
        video.src = src;
        try {
          if (autoPlay) await video.play();
        } catch {}
        return;
      }

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

          // ✅ IMPORTANT: send cookies with playlist/segment requests
          xhrSetup: (xhr: XMLHttpRequest) => {
            xhr.withCredentials = true;
          },
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
        crossOrigin="use-credentials"   // ✅ IMPORTANT
      />
      {err && (
        <div className="px-3 py-2 text-xs text-red-200 bg-red-500/10 border-t border-red-500/20">
          {err}
        </div>
      )}
    </div>
  );
}
