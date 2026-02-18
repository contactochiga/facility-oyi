// app/(auth)/signup/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

type Step = "form" | "otp";

const LOGO_SRC = "/oyi-logo-transparent.png";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Image src={LOGO_SRC} alt="Oyi" fill priority className="object-contain" />
    </span>
  );
}

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

async function pingBackend() {
  const API = getApiBase();
  if (!API) return false;

  try {
    const res = await fetch(`${API}/health`, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function StatusDot({ ok }: { ok: boolean | null }) {
  const cls =
    ok === null ? "bg-zinc-500" : ok ? "bg-emerald-500" : "bg-amber-500";
  const title = ok === null ? "Checking…" : ok ? "Connected" : "Degraded";
  return (
    <span
      className={cn("h-2 w-2 rounded-full", cls)}
      title={title}
      aria-label={title}
    />
  );
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

/** simple inline svg "city / infra" background */
function InfraSvg() {
  return (
    <svg
      className="absolute -right-24 -bottom-20 w-[1200px] max-w-none opacity-[0.22]"
      viewBox="0 0 1200 700"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1200" y2="700">
          <stop stopColor="rgba(59,130,246,0.55)" />
          <stop offset="1" stopColor="rgba(14,165,233,0.10)" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="700" x2="1200" y2="0">
          <stop stopColor="rgba(99,102,241,0.30)" />
          <stop offset="1" stopColor="rgba(59,130,246,0.05)" />
        </linearGradient>
        <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <g filter="url(#blur)">
        <path
          d="M80 560V420h70v140H80Z M180 560V360h95v200h-95Z M305 560V310h70v250h-70Z
             M395 560V280h120v280H395Z M545 560V350h85v210h-85Z M650 560V250h160v310H650Z
             M835 560V330h95v230h-95Z M950 560V300h140v260H950Z"
          fill="url(#g1)"
        />
      </g>

      <path d="M40 560H1160" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />

      <path
        d="M120 520 C260 430, 420 610, 560 520 S860 460, 1040 520"
        stroke="rgba(59,130,246,0.45)"
        strokeWidth="2"
      />
      <path
        d="M120 520 L180 480 L240 520 L300 480 L360 520 L420 480 L480 520 L540 480 L600 520"
        stroke="rgba(14,165,233,0.25)"
        strokeWidth="2"
      />

      {[
        [120, 520],
        [180, 480],
        [240, 520],
        [300, 480],
        [360, 520],
        [420, 480],
        [480, 520],
        [540, 480],
        [600, 520],
        [860, 500],
        [1040, 520],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="url(#g2)" />
      ))}
    </svg>
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
              className="h-12 w-full rounded-xl bg-white/5 border border-white/10 text-center text-lg font-semibold outline-none focus:border-white/25 text-white"
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

  const [expiresLeft, setExpiresLeft] = useState(0);

  const [resendLocked, setResendLocked] = useState(true);
  const resendUnlockRef = useRef<number | null>(null);

  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await pingBackend();
      if (alive) setBackendOk(ok);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

      const v = await verifyOtp(cleanEmail, code);
      const otpToken = v?.otpToken;

      if (!otpToken) {
        setErr("OTP verified, but no token returned. Please try again.");
        return;
      }

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
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8">
          <div className="text-xl font-semibold tracking-tight text-white">Oyi Facility</div>
          <div className="text-white/50 mt-1">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_20%_15%,rgba(59,130,246,0.26),transparent_60%),radial-gradient(1000px_700px_at_80%_30%,rgba(14,165,233,0.16),transparent_55%),radial-gradient(900px_600px_at_50%_85%,rgba(99,102,241,0.12),transparent_60%)]" />
        <InfraSvg />
        <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:46px_46px]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] [background-size:100%_12px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.55)_70%,rgba(0,0,0,0.88)_100%)]" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-7 px-6 py-10 lg:px-14 lg:py-14 flex items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              <StatusDot ok={backendOk} />
              Facility Control Plane
              <span className="text-white/35">•</span>
              <span className="text-white/55">command • observe • enforce</span>
            </div>

            <h1 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-white">
              Operator onboarding.
            </h1>

            <p className="mt-4 text-sm md:text-base text-white/60 leading-relaxed">
              Create a facility operator account to manage devices, access, visitors,
              work orders, and community operations — with verification built in.
            </p>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { k: "Verified operators", v: "Email OTP gate before account creation" },
                { k: "Secure sessions", v: "Cookie-based operator auth flow" },
                { k: "Ops-first UI", v: "Designed for real facility operations" },
                { k: "Fast activation", v: "Create account in under a minute" },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="text-xs text-white/55">{x.k}</div>
                  <div className="mt-1 text-sm font-medium text-white/85">{x.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-[11px] text-white/45">
              Operator console • secure cookies • infrastructure-grade workflow
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 px-6 py-10 lg:px-12 lg:py-14 flex items-center justify-center">
          <div className="w-full max-w-md relative">
            {/* faint watermark */}
            <div className="pointer-events-none absolute -top-6 -right-4 opacity-[0.08]">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <Image src={LOGO_SRC} alt="" fill className="object-contain" />
              </div>
            </div>

            {/* header */}
            <div className="flex items-center gap-3">
              <Logo size={34} />
              <div>
                <div className="text-white text-lg font-semibold tracking-tight">
                  Oyi Facility
                </div>
                <div className="text-[11px] text-white/45">
                  operator onboarding • verification
                </div>
              </div>
            </div>

            <div className="mt-6 text-white text-2xl font-semibold tracking-tight">
              {step === "form" ? "Create account" : "Verify email"}
            </div>
            <div className="mt-1 text-sm text-white/50">
              {step === "form"
                ? "Create an operator account for the control plane."
                : "Enter the 6-digit code sent to your email."}
            </div>

            {/* slide wrapper (your original mechanic) */}
            <div
              className={cn(
                "mt-6 flex w-[200%] transition-transform duration-300 ease-out",
                step === "otp" ? "-translate-x-1/2" : "translate-x-0"
              )}
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
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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

                <a
                  className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/80 hover:bg-white/10 transition"
                  href={`/login?next=${encodeURIComponent(next)}`}
                >
                  I already have an account
                </a>

                <div className="mt-4 text-[11px] text-white/40">
                  Tip: use a work email for operator accounts.
                </div>
              </div>

              {/* OTP */}
              <div className="w-1/2 pl-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/70">We sent a 6-digit code to</div>
                  <div className="mt-1 text-sm font-medium text-white break-all underline underline-offset-4">
                    {cleanEmail || "—"}
                  </div>

                  <Otp6 value={otp} onChange={setOtp} disabled={loading} />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-white/55">
                      Expires in {formatMMSS(expiresLeft)}
                    </div>

                    <button
                      type="button"
                      onClick={resendNow}
                      disabled={loading || resendLocked}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition",
                        loading || resendLocked
                          ? "text-white/30 cursor-not-allowed"
                          : "text-white/80 hover:bg-white/5"
                      )}
                      aria-disabled={loading || resendLocked}
                      title={resendLocked ? "You can resend after 1 minute" : "Resend code"}
                    >
                      <ResendIcon className="opacity-90" />
                      <span>Resend</span>
                    </button>
                  </div>

                  {err && (
                    <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
                    className={cn(
                      "mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition",
                      loading ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10",
                      "text-white/85"
                    )}
                  >
                    Change email
                  </button>
                </div>

                <a
                  className="mt-3 block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/80 hover:bg-black/30 transition"
                  href={`/login?next=${encodeURIComponent(next)}`}
                >
                  Back to sign in
                </a>

                <div className="mt-4 text-[11px] text-white/40">
                  If you don’t see the email, check spam/junk folders.
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-[11px] text-white/35">
              Oyi Facility • Infrastructure-grade operations console
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
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8">
            <div className="text-xl font-semibold tracking-tight text-white">Oyi Facility</div>
            <div className="text-white/50 mt-1">Loading…</div>
          </div>
        </div>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
