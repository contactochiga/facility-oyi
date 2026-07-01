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
    let blurTimer = 0;
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
    const previousKeyboardHeight = document.documentElement.style.getPropertyValue("--oyi-keyboard-height");
    const previousVisualHeight = document.documentElement.style.getPropertyValue("--oyi-visual-height");
    const previousVisualBottom = document.documentElement.style.getPropertyValue("--oyi-visual-bottom");
    const hadKeyboardClass = document.body.classList.contains("oyi-keyboard-open");

    function setKeyboardClass(open: boolean) {
      if (open) {
        document.body.classList.add("oyi-keyboard-open");
        return;
      }
      document.body.classList.remove("oyi-keyboard-open");
    }

    function measure() {
      const nextDockHeight = Math.ceil(dockRef?.current?.getBoundingClientRect().height || 92);
      setDockHeight((current) => (Math.abs(current - nextDockHeight) > 2 ? nextDockHeight : current));
    }

    function update() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextHeight = Math.round(viewport?.height || window.innerHeight);
        const nextWidth = Math.round(viewport?.width || window.innerWidth);
        const nextInset = viewport ? Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop))) : 0;
        const nextVisualBottom = nextInset;
        const nextKeyboardHeight = nextInset;
        const keyboardOpen = nextKeyboardHeight > 0;

        setViewportHeight((current) => (current !== nextHeight ? nextHeight : current));
        setKeyboardInset((current) => (current !== nextInset ? nextInset : current));
        document.documentElement.style.setProperty("--oyi-viewport-height", `${nextHeight}px`);
        document.documentElement.style.setProperty("--oyi-viewport-width", `${nextWidth}px`);
        document.documentElement.style.setProperty("--oyi-keyboard-inset", `${nextInset}px`);
        document.documentElement.style.setProperty("--oyi-keyboard-height", `${nextKeyboardHeight}px`);
        document.documentElement.style.setProperty("--oyi-visual-height", `${nextHeight}px`);
        document.documentElement.style.setProperty("--oyi-visual-bottom", `${nextVisualBottom}px`);
        setKeyboardClass(keyboardOpen);
        measure();
        onViewportChange?.();
      });
    }

    function onViewportEvent() {
      update();
    }

    function onFocusIn() {
      window.clearTimeout(blurTimer);
      document.body.classList.add("oyi-keyboard-open");
      update();
    }

    function onFocusOut() {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!viewport) {
          document.body.classList.remove("oyi-keyboard-open");
        }
        update();
      }, 180);
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
    viewport?.addEventListener("resize", onViewportEvent);
    viewport?.addEventListener("scroll", onViewportEvent);
    window.addEventListener("orientationchange", onViewportEvent);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(blurTimer);
      observer?.disconnect();
      viewport?.removeEventListener("resize", onViewportEvent);
      viewport?.removeEventListener("scroll", onViewportEvent);
      window.removeEventListener("orientationchange", onViewportEvent);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
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
      if (previousKeyboardHeight) document.documentElement.style.setProperty("--oyi-keyboard-height", previousKeyboardHeight);
      else document.documentElement.style.removeProperty("--oyi-keyboard-height");
      if (previousVisualHeight) document.documentElement.style.setProperty("--oyi-visual-height", previousVisualHeight);
      else document.documentElement.style.removeProperty("--oyi-visual-height");
      if (previousVisualBottom) document.documentElement.style.setProperty("--oyi-visual-bottom", previousVisualBottom);
      else document.documentElement.style.removeProperty("--oyi-visual-bottom");
      if (hadKeyboardClass) document.body.classList.add("oyi-keyboard-open");
      else document.body.classList.remove("oyi-keyboard-open");
    };
  }, [active, dockRef, lockDocument, onViewportChange]);

  return { viewportHeight, dockHeight, keyboardInset };
}
