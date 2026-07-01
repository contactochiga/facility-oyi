"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";

function ForgotPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = useMemo(() => params.get("email") || "", [params]);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    const result = await authService.requestPasswordReset(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Unable to start password recovery.");
      return;
    }
    router.push(`/forgot-password/sent?email=${encodeURIComponent(email.trim())}&mode=${encodeURIComponent(result.mode)}`);
  }

  return (
    <AuthShell title="Recover password" subtitle="Enter your operator email to start recovery.">
      <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      <Button className="w-full" onClick={() => void submit()} disabled={loading || !email.trim()}>
        {loading ? "Sending..." : "Send recovery email"}
      </Button>
      <AuthLink href="/login" align="center">
        Back to sign in
      </AuthLink>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Recover password" subtitle="Preparing password recovery."><div /></AuthShell>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
