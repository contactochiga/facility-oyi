"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

type Step = "form" | "otp";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
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
  return data;
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

/** OTP 6 boxes that ALWAYS fits inside the card */
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
      {/* grid ensures it never spills outside the card */}
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

      {/* Tip + timers (clean + professional) */}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>Tip: you can paste the full code.</span>
        {/* timers will be injected from parent UI */}
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

  // ✅ pro UX timers
  // - resend cooldown: 60s
  // - otp expiry display: 10min (matches your email copy)
  const [resendLeft, setResendLeft] = useState(0);
  const [expiresLeft, setExpiresLeft] = useState(0);

  const cleanEmail = email.trim().toLowerCase();

  // tick timers
  useEffect(() => {
    if (step !== "otp") return;

    const t = setInterval(() => {
      setResendLeft((s) => Math.max(0, s - 1));
      setExpiresLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [step]);

  function startOtpTimers() {
    setResendLeft(60);
    setExpiresLeft(10 * 60);
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
      startOtpTimers();
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
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

      await verifyOtp(cleanEmail, code);

      const res = await authService.signup(cleanEmail, password, fullName.trim());
      if (res.error || !res.token) {
        setErr(res.error || "Signup failed");
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
    setResendLeft(0);
    setExpiresLeft(0);
    setStep("form");
  }

  async function resendNow() {
    if (loading) return;
    if (resendLeft > 0) return;

    setErr(null);
    setLoading(true);
    try {
      await sendOtp(cleanEmail);
      setOtp("");
      startOtpTimers();
    } catch (e: any) {
      setErr(e?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
      <div className="glass w-full max-w-md p-8 overflow-hidden">
        <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>
        <div className="muted mt-1">
          {step === "form" ? "Create your facility control account" : "Enter the verification code we sent"}
        </div>

        {/* SLIDE WRAPPER */}
        <div
          className={`mt-6 flex w-[200%] transition-transform duration-300 ease-out ${
            step === "otp" ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          {/* STEP 1: FORM */}
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
              <a className="text-zinc-200 underline" href={`/login?next=${encodeURIComponent(next)}`}>
                Sign in
              </a>
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              Backend: <span className="text-zinc-300">{getApiBase()}</span>
            </div>
          </div>

          {/* STEP 2: OTP ONLY */}
          <div className="w-1/2 pl-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-zinc-300">We sent a 6-digit code to</div>
              <div className="mt-1 text-sm font-medium text-white break-all underline underline-offset-4">
                {cleanEmail || "—"}
              </div>

              <Otp6 value={otp} onChange={setOtp} disabled={loading} />

              {/* timers row under tip */}
              <div className="-mt-6 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span />
                <span className="text-zinc-400">Expires in {formatMMSS(expiresLeft)}</span>
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

              {/* inline resend control (professional) */}
              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resendNow}
                  disabled={loading || resendLeft > 0}
                  className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 transition ${
                    loading || resendLeft > 0
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <ResendIcon className="opacity-90" />
                  <span>Resend</span>
                </button>

                <span className="text-zinc-500">
                  {resendLeft > 0 ? `Available in ${formatMMSS(resendLeft)}` : "You can resend now"}
                </span>
              </div>

              {/* change email stays small but clear */}
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
              <a className="text-zinc-200 underline" href={`/login?next=${encodeURIComponent(next)}`}>
                Sign in
              </a>
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              Backend: <span className="text-zinc-300">{getApiBase()}</span>
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
