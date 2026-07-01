"use client";

import { useRef } from "react";

export default function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(index: number, next: string) {
    const chars = value.split("");
    while (chars.length < 6) chars.push("");
    chars[index] = next;
    onChange(chars.join("").slice(0, 6));
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={value[index] || ""}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-center text-base font-semibold text-white outline-none focus:border-sky-300/40"
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 1);
            setAt(index, next);
            if (next && index < 5) refs.current[index + 1]?.focus({ preventScroll: true });
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              if (value[index]) {
                setAt(index, "");
                return;
              }
              if (index > 0) {
                refs.current[index - 1]?.focus({ preventScroll: true });
                setAt(index - 1, "");
              }
            }
            if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus({ preventScroll: true });
            if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus({ preventScroll: true });
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!text) return;
            event.preventDefault();
            onChange(text);
            refs.current[Math.min(text.length - 1, 5)]?.focus({ preventScroll: true });
          }}
        />
      ))}
    </div>
  );
}
