// app/(auth)/login/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const LOGO_SRC = "/oyi-logo-transparent.png";

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

function Logo({ size = 18 }: { size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src={LOGO_SRC}
        alt="Oyi"
        fill
        priority
        className="object-contain"
      />
    </span>
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

      {/* skyline blocks */}
      <g filter="url(#blur)">
        <path
          d="M80 560V420h70v140H80Z M180 560V360h95v200h-95Z M305 560V310h70v250h-70Z
             M395 560V280h120v280H395Z M545 560V350h85v210h-85Z M650 560V250h160v310H650Z
             M835 560V330h95v230h-95Z M950 560V300h140v260H950Z"
          fill="url(#g1)"
        />
      </g>

      {/* horizon line */}
      <path
        d="M40 560H1160"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2"
      />

      {/* network lines */}
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

      {/* nodes */}
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

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextRaw = params.get("next") || "/overview";
  const next = useMemo(() => nextRaw, [nextRaw]);

  const { setToken } = useSessionStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <div className="text-xl font-semibold tracking-tight text-white">
              Oyi Facility
            </div>
          </div>
          <div className="text-white/50 mt-2">Loading…</div>
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
              <Logo size={16} />
              <StatusDot ok={backendOk} />
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

            <div className="mt-8 text-[11px] text-white/45">
              Operator console • secure cookies • infrastructure-grade workflow
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 px-6 py-10 lg:px-12 lg:py-14 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* ✅ logo header */}
            <div className="flex items-center gap-3">
              <Logo size={34} />
              <div>
                <div className="text-white text-lg font-semibold tracking-tight">
                  Oyi Facility
                </div>
                <div className="text-[11px] text-white/45">
                  operator access • control plane
                </div>
              </div>
            </div>

            <div className="mt-6 text-white text-2xl font-semibold tracking-tight">
              Sign in
            </div>
            <div className="mt-1 text-sm text-white/50">
              Operator access for the control plane.
            </div>

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

            {err && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}

            <Button
              className="mt-5 w-full"
              onClick={submit}
              disabled={loading || !email || !password}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <a
              className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/80 hover:bg-white/10 transition"
              href={`/signup?next=${encodeURIComponent(next)}`}
            >
              Create an operator account
            </a>

            <div className="mt-5 text-[11px] text-white/40">
              Use facility operator credentials. Consumer logins won’t work here.
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
            <div className="flex items-center gap-2">
              <span className="relative inline-block" style={{ width: 22, height: 22 }}>
                <Image
                  src={LOGO_SRC}
                  alt="Oyi"
                  fill
                  className="object-contain"
                />
              </span>
              <div className="text-xl font-semibold tracking-tight text-white">
                Oyi Facility
              </div>
            </div>
            <div className="text-white/50 mt-2">Loading…</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
