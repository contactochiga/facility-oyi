// Temporary wrapper: exposes Facility's existing Web Speech composer
// (hooks/useSpeechComposer) as an oyi-interaction voice SNAPSHOT so it drives
// the shared interaction state through voiceSnapshotEvents(). Web Speech is
// not a reliable installed-app solution; a native implementation will
// replace this behind the same OyiVoiceAdapter interface in a later slice.
import type { OyiVoiceSnapshot } from "oyi-interaction/core";

export function facilityVoiceSnapshot(voice: { supported: boolean; recording: boolean; error: string | null }): OyiVoiceSnapshot {
  return {
    available: voice.supported,
    permissionState: voice.supported ? "unknown" : "unsupported",
    status: voice.recording ? "listening" : voice.error ? "error" : "idle",
    // useSpeechComposer writes transcripts straight into the composer input;
    // it exposes no separate interim/final stream.
    interimTranscript: "",
    finalTranscript: "",
    audioLevel: null,
    error: voice.error,
  };
}
