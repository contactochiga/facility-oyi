"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

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

  // ✅ Hydration guard (prevents SSR/CSR mismatch)
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

  // ✅ Render stable UI after mount only
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
        <div className="flex items-center justify-between gap-3">
          <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>

          {/* ✅ backend status dot */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/40">Backend</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                backendOk === null
                  ? "bg-zinc-500"
                  : backendOk
                  ? "bg-emerald-500"
                  : "bg-red-500"
              }`}
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

        <div className="muted mt-1">Sign in to the facility control plane</div>

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
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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

        {/* ✅ SIGN UP LINK */}
        <div className="mt-6 text-xs text-zinc-500">
          New here?{" "}
          <a
            className="text-zinc-200 underline"
            href={`/signup?next=${encodeURIComponent(next)}`}
          >
            Create an account
          </a>
        </div>

        {/* ✅ removed Backend URL text */}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
          <div className="glass w-full max-w-md p-8">
            <div className="text-xl font-semibold tracking-tight">
              Oyi Facility
            </div>
            <div className="muted mt-1">Loading…</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
