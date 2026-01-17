"use client";

import { Suspense, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { setCookie, decodeToken, isExpired } from "@/lib/auth";

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/overview";

  const { setToken } = useSessionStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const res = await authService.signup(email.trim(), password, fullName.trim());

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-5">
      <div className="glass w-full max-w-md p-8">
        <div className="text-xl font-semibold tracking-tight">Oyi Facility</div>
        <div className="muted mt-1">Create your facility control account</div>

        <div className="mt-6 space-y-3">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            type="text"
          />
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
          disabled={loading || !fullName || !email || !password}
        >
          {loading ? "Creating account..." : "Sign up"}
        </Button>

        <div className="mt-6 text-xs text-zinc-500">
          Already have an account?{" "}
          <a className="text-zinc-200 underline" href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in
          </a>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Backend: <span className="text-zinc-300">{process.env.NEXT_PUBLIC_API_URL}</span>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <SignupInner />
    </Suspense>
  );
}
