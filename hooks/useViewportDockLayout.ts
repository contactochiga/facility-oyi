"use client";

import { useEffect, useState, type RefObject } from "react";

export function useViewportDockLayout({
  active = true,
  dockRef,
  lockDocument = false,
  onViewportChange,
}: {
  active?: boolean;
  dockRef?: RefObject<HTMLElement | null>;
  lockDocument?: boolean;
  onViewportChange?: () => void;
}) {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [dockHeight, setDockHeight] = useState(92);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    let frame = 0;
    const viewport = window.visualViewport;
    const observer = typeof ResizeObserver !== "undefined" && dockRef?.current ? new ResizeObserver(() => measure()) : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    function measure() {
      const nextDockHeight = Math.ceil(dockRef?.current?.getBoundingClientRect().height || 92);
      setDockHeight((current) => (Math.abs(current - nextDockHeight) > 2 ? nextDockHeight : current));
    }

    function update() {
      const nextHeight = Math.round(viewport?.height || window.innerHeight);
      const nextInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setViewportHeight((current) => (current !== nextHeight ? nextHeight : current));
      setKeyboardInset((current) => (current !== nextInset ? nextInset : current));
      measure();
      onViewportChange?.();
    }

    function onResize() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    }

    if (lockDocument) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    update();
    if (observer && dockRef?.current) observer.observe(dockRef.current);
    viewport?.addEventListener("resize", onResize);
    viewport?.addEventListener("scroll", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      viewport?.removeEventListener("resize", onResize);
      viewport?.removeEventListener("scroll", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (lockDocument) {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
    };
  }, [active, dockRef, lockDocument, onViewportChange]);

  return { viewportHeight, dockHeight, keyboardInset };
}
