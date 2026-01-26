"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

async function sendOtp(email: string) {
  const API = getApiBase();
  if (!API) throw new Error("Missing NEXT_PUBLIC_API_URL");

  const res = await fetch(`${API}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.message || data?.error || "Failed to send OTP");
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
  if (!res.ok)
    throw new Error(data?.message || data?.error || "OTP verification failed");
  return data;
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();

  // ✅ Hydration guard
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
  const [info, setInfo] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  async function startOtp() {
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      if (!cleanEmail || !cleanEmail.includes("@")) {
        setErr("Enter a valid email");
        return;
      }
      if (!fullName.trim() || !password) {
        setErr("Fill full name and password");
        return;
      }

      await sendOtp(cleanEmail);
      setStep("otp");
      setInfo(`OTP sent to ${cleanEmail}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      if (!otp.trim() || otp.trim().length < 4) {
        setErr("Enter the OTP code");
        return;
      }

      await verifyOtp(cleanEmail, otp.trim());

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

  const changeEmail = () => {
    setErr(null);
    setInfo(null);
    setOtp("");
    setStep("form");
  };

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
      <div className="glass w-full max-w-md p-8">
        <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>
        <div className="muted mt-1">
          {step === "form"
            ? "Create your facility control account"
            : "Enter the verification code we sent"}
        </div>

        <div className="mt-6 space-y-3">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            type="text"
            disabled={loading || step === "otp"}
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            disabled={loading || step === "otp"}
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            disabled={loading || step === "otp"}
          />

          {step === "otp" && (
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="OTP code"
              type="text"
              disabled={loading}
            />
          )}
        </div>

        {info && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {info}
          </div>
        )}

        {err && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {step === "form" ? (
          <Button
            className="mt-5 w-full"
            onClick={startOtp}
            disabled={loading || !fullName || !email || !password}
          >
            {loading ? "Sending code..." : "Send verification code"}
          </Button>
        ) : (
          <>
            <Button
              className="mt-5 w-full"
              onClick={verifyAndCreate}
              disabled={loading || otp.trim().length < 4}
            >
              {loading ? "Verifying..." : "Verify & Create account"}
            </Button>

            <Button
              className="mt-3 w-full"
              onClick={startOtp}
              disabled={loading}
              variant="secondary"
            >
              {loading ? "..." : "Resend code"}
            </Button>

            <Button
              className="mt-3 w-full"
              onClick={changeEmail}
              disabled={loading}
              variant="secondary"
            >
              Change email
            </Button>
          </>
        )}

        <div className="mt-6 text-xs text-zinc-500">
          Already have an account?{" "}
          <a
            className="text-zinc-200 underline"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Sign in
          </a>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Backend:{" "}
          <span className="text-zinc-300">
            {process.env.NEXT_PUBLIC_API_URL ||
              process.env.NEXT_PUBLIC_API_BASE_URL}
          </span>
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
