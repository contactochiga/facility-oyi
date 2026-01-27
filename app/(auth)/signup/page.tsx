// app/(auth)/signup/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

type Step = "form" | "otp";

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOtp(email: string) {
  const API = getApiBase();
  if (!API) throw new Error("Missing NEXT_PUBLIC_API_URL");

  const res = await fetch(`${API}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to send OTP");
  return data;
}

async function verifyOtp(email: string, code: string) {
  const API = getApiBase();
  if (!API) throw new Error("Missing NEXT_PUBLIC_API_URL");

  const res = await fetch(`${API}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "OTP verification failed");
  return data as { ok?: boolean; otpToken?: string; message?: string };
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function ResendIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 12a8 8 0 0 1-14.3 5M4 12A8 8 0 0 1 18.3 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 3v4h-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 21v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusDot({ ok }: { ok: boolean | null }) {
  const title =
    ok === null ? "Checking connection" : ok ? "Backend connected" : "Backend offline";

  const cls =
    ok === null
      ? "bg-zinc-500"
      : ok
      ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]"
      : "bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]";

  return (
    <span className="inline-flex items-center gap-2" title={title} aria-label={title}>
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
    </span>
  );
}

/** 6-box OTP input */
function Otp6({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(index: number, char: string) {
    const chars = value.split("");
    while (chars.length < 6) chars.push("");
    chars[index] = char;
    onChange(chars.join("").slice(0, 6));
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text.padEnd(6, "").slice(0, 6));
    const last = Math.min(text.length - 1, 5);
    inputsRef.current[last]?.focus();
  }

  return (
    <div className="mt-4" onPaste={handlePaste}>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const v = value[i] || "";
          return (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={v}
              disabled={disabled}
              inputMode="numeric"
              maxLength={1}
              className="h-12 w-full rounded-xl bg-white/5 border border-white/10 text-center text-lg font-semibold outline-none focus:border-white/25"
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 1);
                setAt(i, next);
                if (next && i < 5) inputsRef.current[i + 1]?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace") {
                  if (value[i]) {
                    setAt(i, "");
                    return;
                  }
                  if (i > 0) {
                    inputsRef.current[i - 1]?.focus();
                    setAt(i - 1, "");
                  }
                }
                if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < 5) inputsRef.current[i + 1]?.focus();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextRaw = params.get("next") || "/overview";
  const next = useMemo(() => nextRaw, [nextRaw]);

  const { setToken } = useSessionStore();

  const [step, setStep] = useState<Step>("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // single expiry timer
  const [expiresLeft, setExpiresLeft] = useState(0);

  // resend lock (60s)
  const [resendLocked, setResendLocked] = useState(true);
  const resendUnlockRef = useRef<number | null>(null);

  // backend status dot
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  // backend ping
  useEffect(() => {
    const API = getApiBase();
    if (!API) {
      setBackendOk(false);
      return;
    }

    let cancelled = false;
    setBackendOk(null);

    (async () => {
      try {
        const res = await fetch(`${API}/health`, { method: "GET" });
        if (cancelled) return;
        setBackendOk(res.ok);
      } catch {
        if (cancelled) return;
        setBackendOk(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // expiry tick
  useEffect(() => {
    if (step !== "otp") return;
    const t = window.setInterval(() => {
      setExpiresLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [step]);

  function startOtpSession() {
    setExpiresLeft(10 * 60);

    setResendLocked(true);
    if (resendUnlockRef.current) window.clearTimeout(resendUnlockRef.current);

    resendUnlockRef.current = window.setTimeout(() => {
      setResendLocked(false);
    }, 60 * 1000);
  }

  async function startOtp() {
    setErr(null);
    setLoading(true);

    try {
      if (!fullName.trim() || !password) {
        setErr("Fill full name and password");
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        setErr("Enter a valid email");
        return;
      }

      await sendOtp(cleanEmail);

      setOtp("");
      setStep("otp");
      startOtpSession();
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function resendNow() {
    if (loading) return;
    if (resendLocked) return;

    setErr(null);
    setLoading(true);

    try {
      if (!isValidEmail(cleanEmail)) {
        setErr("Enter a valid email");
        return;
      }

      await sendOtp(cleanEmail);
      setOtp("");
      startOtpSession();
    } catch (e: any) {
      setErr(e?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setErr(null);
    setLoading(true);

    try {
      const code = otp.replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) {
        setErr("Enter the 6-digit OTP code");
        return;
      }

      // ✅ verify and receive otpToken
      const v = await verifyOtp(cleanEmail, code);
      const otpToken = v?.otpToken;

      if (!otpToken) {
        setErr("OTP verified, but no token returned. Please try again.");
        return;
      }

      // ✅ signup gated by otpToken
      const res = await authService.signup(cleanEmail, password, fullName.trim(), otpToken);

      if (res?.error || !res?.token) {
        setErr(res?.error || "Signup failed");
        return;
      }

      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setErr("Invalid session token");
        return;
      }

      setCookie("oyi_facility_token", res.token, 30);
      setToken(res.token);

      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setErr(null);
    setOtp("");
    setExpiresLeft(0);
    setResendLocked(true);

    if (resendUnlockRef.current) window.clearTimeout(resendUnlockRef.current);
    resendUnlockRef.current = null;

    setStep("form");
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
        <div className="glass w-full max-w-md p-8">
          <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>
          <div className="muted mt-1">Loading…</div>
        </div>
      </div>
    );
  }

  const subtitle =
    step === "form"
      ? "Create your facility control account"
      : "Enter the verification code we sent";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
      <div className="glass w-full max-w-md p-8 overflow-hidden">
        <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>

        <div className="mt-1 flex items-center justify-between">
          <div className="muted">{subtitle}</div>
          <StatusDot ok={backendOk} />
        </div>

        {/* Slide wrapper */}
        <div
          className={`mt-6 flex w-[200%] transition-transform duration-300 ease-out ${
            step === "otp" ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          {/* FORM */}
          <div className="w-1/2 pr-4">
            <div className="space-y-3">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                type="text"
                disabled={loading}
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                disabled={loading}
              />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                disabled={loading}
              />
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}

            <Button
              className="mt-5 w-full"
              onClick={startOtp}
              disabled={loading || !fullName.trim() || !email.trim() || !password}
            >
              {loading ? "Please wait..." : "Continue"}
            </Button>

            <div className="mt-6 text-xs text-zinc-500">
              Already have an account?{" "}
              <a
                className="text-zinc-200 underline"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Sign in
              </a>
            </div>
          </div>

          {/* OTP */}
          <div className="w-1/2 pl-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-zinc-300">We sent a 6-digit code to</div>
              <div className="mt-1 text-sm font-medium text-white break-all underline underline-offset-4">
                {cleanEmail || "—"}
              </div>

              <Otp6 value={otp} onChange={setOtp} disabled={loading} />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Expires in {formatMMSS(expiresLeft)}
                </div>

                <button
                  type="button"
                  onClick={resendNow}
                  disabled={loading || resendLocked}
                  className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                    loading || resendLocked
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-200 hover:bg-white/5"
                  }`}
                  aria-disabled={loading || resendLocked}
                  title={resendLocked ? "You can resend after 1 minute" : "Resend code"}
                >
                  <ResendIcon className="opacity-90" />
                  <span>Resend</span>
                </button>
              </div>

              {err && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              )}

              <Button
                className="mt-5 w-full"
                onClick={verifyAndCreate}
                disabled={loading || otp.replace(/\D/g, "").length !== 6}
              >
                {loading ? "Verifying..." : "Verify & Create account"}
              </Button>

              <button
                type="button"
                onClick={changeEmail}
                disabled={loading}
                className={`mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition ${
                  loading ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
                }`}
              >
                Change email
              </button>
            </div>

            <div className="mt-6 text-xs text-zinc-500">
              Already have an account?{" "}
              <a
                className="text-zinc-200 underline"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
          <div className="glass w-full max-w-md p-8">
            <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>
            <div className="muted mt-1">Loading…</div>
          </div>
        </div>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
