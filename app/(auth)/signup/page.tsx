"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";

type Step = "form" | "otp";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOtp(email: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (!base) throw new Error("Missing backend URL.");
  const res = await fetch(`${base}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signup" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "Unable to send verification code.");
}

async function verifyOtp(email: string, code: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (!base) throw new Error("Missing backend URL.");
  const res = await fetch(`${base}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "Unable to verify code.");
  return data as { otpToken?: string };
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/overview", [params]);
  const { setToken } = useSessionStore();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresLeft, setExpiresLeft] = useState(0);
  const [resendLocked, setResendLocked] = useState(true);

  const cleanEmail = email.trim().toLowerCase();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setInterval(() => setExpiresLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  function startOtpSession() {
    setExpiresLeft(10 * 60);
    setResendLocked(true);
    window.setTimeout(() => setResendLocked(false), 60 * 1000);
  }

  function mmss(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  async function continueToOtp() {
    setError(null);
    setLoading(true);
    try {
      if (!fullName.trim() || !password) {
        setError("Enter your name and password.");
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        setError("Enter a valid email.");
        return;
      }
      await sendOtp(cleanEmail);
      setOtp("");
      setStep("otp");
      startOtpSession();
    } catch (err: any) {
      setError(err?.message || "Unable to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (resendLocked || loading) return;
    setError(null);
    setLoading(true);
    try {
      await sendOtp(cleanEmail);
      setOtp("");
      startOtpSession();
    } catch (err: any) {
      setError(err?.message || "Unable to resend verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setError(null);
    setLoading(true);
    try {
      const code = otp.replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) {
        setError("Enter the 6-digit code.");
        return;
      }
      const verification = await verifyOtp(cleanEmail, code);
      if (!verification.otpToken) {
        setError("Verification token was not returned.");
        return;
      }
      const res = await authService.signup(cleanEmail, password, fullName.trim(), verification.otpToken);
      if (res?.error || !res?.token) {
        setError(res?.error || "Unable to create account.");
        return;
      }
      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setError("Secure session could not be created.");
        return;
      }
      setCookie("oyi_facility_token", res.token, 30);
      setToken(res.token);
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "Unable to verify code.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <AuthShell title="Create account" subtitle="Preparing secure onboarding.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
          Preparing secure onboarding.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={step === "form" ? "Create account" : "Verify email"}
      subtitle={step === "form" ? "Set up operator access for Facility OS." : `Enter the 6-digit code sent to ${cleanEmail}.`}
    >
      {step === "form" ? (
        <div className="space-y-3">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
        </div>
      ) : (
        <div className="space-y-3">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Code expires in {mmss(expiresLeft)}</span>
            <button type="button" onClick={() => void resendOtp()} disabled={resendLocked || loading} className="text-sky-200 disabled:text-zinc-600">
              Resend code
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {step === "form" ? (
        <Button className="w-full" onClick={() => void continueToOtp()} disabled={loading || !fullName.trim() || !email.trim() || !password}>
          {loading ? "Continuing..." : "Continue"}
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void verifyAndCreate()} disabled={loading || otp.replace(/\D/g, "").length !== 6}>
          {loading ? "Verifying..." : "Verify and create account"}
        </Button>
      )}

      {step === "otp" ? (
        <button type="button" onClick={() => setStep("form")} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
          Change email
        </button>
      ) : null}

      <div className="text-center text-sm text-zinc-500">
        Already have access?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sky-200 transition hover:text-sky-100">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Create account" subtitle="Preparing secure onboarding."><div /></AuthShell>}>
      <SignupInner />
    </Suspense>
  );
}
