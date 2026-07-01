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
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlWidth = document.documentElement.style.width;
    const previousViewportHeight = document.documentElement.style.getPropertyValue("--oyi-viewport-height");
    const previousViewportWidth = document.documentElement.style.getPropertyValue("--oyi-viewport-width");
    const previousKeyboardInset = document.documentElement.style.getPropertyValue("--oyi-keyboard-inset");

    function measure() {
      const nextDockHeight = Math.ceil(dockRef?.current?.getBoundingClientRect().height || 92);
      setDockHeight((current) => (Math.abs(current - nextDockHeight) > 2 ? nextDockHeight : current));
    }

    function update() {
      const nextHeight = Math.round(viewport?.height || window.innerHeight);
      const nextWidth = Math.round(viewport?.width || window.innerWidth);
      const nextInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setViewportHeight((current) => (current !== nextHeight ? nextHeight : current));
      setKeyboardInset((current) => (current !== nextInset ? nextInset : current));
      document.documentElement.style.setProperty("--oyi-viewport-height", `${nextHeight}px`);
      document.documentElement.style.setProperty("--oyi-viewport-width", `${nextWidth}px`);
      document.documentElement.style.setProperty("--oyi-keyboard-inset", `${nextInset}px`);
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
      document.body.style.overflowX = "hidden";
      document.documentElement.style.overflowX = "hidden";
      document.body.style.width = "100%";
      document.documentElement.style.width = "100%";
      document.body.dataset.oyiViewportLocked = "true";
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
        document.body.style.overflowX = previousBodyOverflowX;
        document.documentElement.style.overflowX = previousHtmlOverflowX;
        document.body.style.width = previousBodyWidth;
        document.documentElement.style.width = previousHtmlWidth;
        delete document.body.dataset.oyiViewportLocked;
      }
      if (previousViewportHeight) document.documentElement.style.setProperty("--oyi-viewport-height", previousViewportHeight);
      else document.documentElement.style.removeProperty("--oyi-viewport-height");
      if (previousViewportWidth) document.documentElement.style.setProperty("--oyi-viewport-width", previousViewportWidth);
      else document.documentElement.style.removeProperty("--oyi-viewport-width");
      if (previousKeyboardInset) document.documentElement.style.setProperty("--oyi-keyboard-inset", previousKeyboardInset);
      else document.documentElement.style.removeProperty("--oyi-keyboard-inset");
    };
  }, [active, dockRef, lockDocument, onViewportChange]);

  return { viewportHeight, dockHeight, keyboardInset };
}
