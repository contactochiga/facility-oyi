"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/overview", [params]);
  const { setToken } = useSessionStore();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await authService.login(email.trim(), password);
      if (res.error || !res.token) {
        setError(res.error || "Unable to sign in.");
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
      setError(err?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <AuthShell title="Welcome back" subtitle="Preparing secure operator access.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
          Preparing secure operator access.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to Facility OS.">
      <div className="space-y-3">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
        <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
      </div>

      <AuthLink href={`/forgot-password?email=${encodeURIComponent(email.trim())}`} align="right">
        Forgot password
      </AuthLink>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <Button className="w-full" onClick={submit} disabled={loading || !email.trim() || !password}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>

      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-500"
      >
        <Fingerprint className="h-4 w-4" />
        Biometric unlock coming soon
      </button>

      <div className="text-center text-sm text-zinc-500">
        New operator?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-sky-200 transition hover:text-sky-100">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Welcome back" subtitle="Preparing secure operator access."><div /></AuthShell>}>
      <LoginInner />
    </Suspense>
  );
}
