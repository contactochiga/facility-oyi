"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function ctor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechComposer(onTranscript: (text: string) => void) {
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(ctor()));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recognitionRef.current?.abort?.();
    };
  }, []);

  function startTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((current) => current + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function start() {
    const Recognition = ctor();
    if (!Recognition) {
      setError("Voice input is not available on this device yet.");
      return false;
    }
    try {
      const instance = new Recognition();
      instance.lang = "en-US";
      instance.interimResults = true;
      instance.continuous = true;
      let finalTranscript = "";
      instance.onresult = (event: any) => {
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
          if (!transcript) continue;
          if (event.results[index].isFinal) finalTranscript += `${transcript} `;
          else interim += `${transcript} `;
        }
        const combined = `${finalTranscript}${interim}`.trim();
        if (combined) onTranscript(combined);
      };
      instance.onerror = (event: any) => {
        setError(event?.error === "not-allowed" ? "Microphone permission was denied." : "Voice input could not start on this device.");
        setRecording(false);
        stopTimer();
      };
      instance.onend = () => {
        setRecording(false);
        stopTimer();
      };
      recognitionRef.current = instance;
      setError(null);
      setRecording(true);
      startTimer();
      instance.start();
      return true;
    } catch {
      setError("Voice input could not start on this device.");
      setRecording(false);
      stopTimer();
      return false;
    }
  }

  function stop() {
    recognitionRef.current?.stop?.();
    setRecording(false);
    stopTimer();
  }

  function cancel() {
    recognitionRef.current?.abort?.();
    setRecording(false);
    stopTimer();
  }

  return {
    supported,
    recording,
    elapsed,
    error,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
