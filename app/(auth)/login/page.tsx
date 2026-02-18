// app/(auth)/login/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
}

async function pingBackend() {
  const API = getApiBase();
  if (!API) return false;

  try {
    const res = await fetch(`${API}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  // ✅ Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextRaw = params.get("next") || "/overview";
  const next = useMemo(() => nextRaw, [nextRaw]);

  const { setToken } = useSessionStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ backend status dot
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
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

  async function submit() {
    setErr(null);
    setLoading(true);

    try {
      const res = await authService.login(email.trim(), password);

      if (res.error || !res.token) {
        setErr(res.error || "Login failed");
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
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8">
          <div className="text-xl font-semibold tracking-tight text-white">
            Oyi Facility
          </div>
          <div className="text-white/50 mt-1">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* -----------------------------------
          BACKGROUND: "arrogant" command vibe
      ------------------------------------ */}
      <div className="absolute inset-0">
        {/* base gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_20%_15%,rgba(59,130,246,0.22),transparent_60%),radial-gradient(1000px_700px_at_80%_30%,rgba(56,189,248,0.14),transparent_55%),radial-gradient(900px_600px_at_50%_85%,rgba(99,102,241,0.12),transparent_60%)]" />

        {/* grid */}
        <div className="absolute inset-0 opacity-[0.25] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:46px_46px]" />

        {/* subtle scanline */}
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] [background-size:100%_12px]" />

        {/* vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.55)_70%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* -----------------------------------
          LAYOUT
      ------------------------------------ */}
      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT: Brand / narrative panel */}
        <div className="lg:col-span-7 px-6 py-10 lg:px-14 lg:py-14 flex items-center">
          <div className="max-w-2xl">
            {/* top badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Facility Control Plane
              <span className="text-white/35">•</span>
              <span className="text-white/55">command • observe • enforce</span>
            </div>

            <h1 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-white">
              Run buildings like infrastructure.
            </h1>

            <p className="mt-4 text-sm md:text-base text-white/60 leading-relaxed">
              One console for operations: devices, access, maintenance, visitors,
              service delivery, and resident communications — designed for real-world
              ops, not dashboards that look pretty and do nothing.
            </p>

            {/* feature bullets */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { k: "Ops visibility", v: "System health + live activity lanes" },
                { k: "Access control", v: "Codes, links, entry & exit tracking" },
                { k: "Work orders", v: "SLA lanes, assignments, escalation" },
                { k: "Device command", v: "Discovery → registry → control hooks" },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="text-xs text-white/55">{x.k}</div>
                  <div className="mt-1 text-sm font-medium text-white/85">
                    {x.v}
                  </div>
                </div>
              ))}
            </div>

            {/* bottom trust line */}
            <div className="mt-8 flex items-center gap-3 text-[11px] text-white/45">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                Secure session cookies
              </span>
              <span className="text-white/25">•</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                Operator-grade UI
              </span>
              <span className="text-white/25">•</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                Live backend checks
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Auth card */}
        <div className="lg:col-span-5 px-6 py-10 lg:px-12 lg:py-14 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Floating card */}
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_25px_80px_-25px_rgba(0,0,0,0.8)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white text-xl font-semibold tracking-tight">
                    Sign in
                  </div>
                  <div className="mt-1 text-sm text-white/50">
                    Operator access for the control plane.
                  </div>
                </div>

                {/* backend status */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-white/40">Backend</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      backendOk === null
                        ? "bg-zinc-500"
                        : backendOk
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    )}
                    title={
                      backendOk === null
                        ? "Checking…"
                        : backendOk
                        ? "Connected"
                        : "Not connected"
                    }
                  />
                </div>
              </div>

              {/* Inputs */}
              <div className="mt-6 space-y-3">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                />
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                />
              </div>

              {/* Error */}
              {err && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              )}

              {/* Submit */}
              <Button
                className="mt-5 w-full"
                onClick={submit}
                disabled={loading || !email || !password}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              {/* Divider */}
              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-[11px] text-white/35">or</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Create account */}
              <a
                className="mt-4 block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/80 hover:bg-black/30 transition"
                href={`/signup?next=${encodeURIComponent(next)}`}
              >
                Create an operator account
              </a>

              {/* micro-footnote */}
              <div className="mt-4 text-[11px] text-white/40">
                Tip: use your facility operator credentials. Consumer logins won’t work here.
              </div>
            </div>

            {/* bottom legal / brand line */}
            <div className="mt-6 text-center text-[11px] text-white/35">
              Oyi Facility • Infrastructure-grade operations console
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8">
            <div className="text-xl font-semibold tracking-tight text-white">
              Oyi Facility
            </div>
            <div className="text-white/50 mt-1">Loading…</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
