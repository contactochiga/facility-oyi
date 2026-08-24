// components/cameras/CameraPlayer.tsx
"use client";

import { useCallback } from "react";
import cameraService from "@/services/cameraService";
import { useCameraPlayback } from "@/lib/oyi-camera-core/useCameraPlayback";

type Props = {
  cameraId: string;
  poster?: string;
  muted?: boolean;
  autoPlay?: boolean;

  // NEW
  controls?: boolean;
  variant?: "hero" | "tile";
  rewindSeconds?: number;
};

export default function CameraPlayer({
  cameraId,
  poster,
  muted = true,
  autoPlay = true,
  controls = true,
  variant = "tile",
  rewindSeconds = 0,
}: Props) {
  const createSession = useCallback(
    (id: string, options?: { rewindSeconds?: number }) => cameraService.getPlayback(id, options?.rewindSeconds),
    []
  );
  const { videoRef, status, error: err } = useCameraPlayback({ cameraId, rewindSeconds, enabled: Boolean(cameraId), autoPlay, createSession });

  return (
    <div
      className={[
        "overflow-hidden border border-white/10 bg-black",
        variant === "hero" ? "rounded-2xl" : "rounded-xl",
      ].join(" ")}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video bg-black object-cover"
        controls={controls}
        muted={muted}
        playsInline
        poster={poster}
        crossOrigin="use-credentials"
      />

      {err && (
        <div className="px-3 py-2 text-xs text-red-200 bg-red-500/10 border-t border-red-500/20">
          {err}
        </div>
      )}

      {!err && status !== "ready" && (
        <div className="px-3 py-2 text-xs text-zinc-300 bg-white/5 border-t border-white/10">
          {status === "refreshing" ? "Refreshing stream…" : "Loading stream…"}
        </div>
      )}
    </div>
  );
}
