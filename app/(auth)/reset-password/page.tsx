"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = useMemo(() => params.get("email") || "", [params]);
  const mode = useMemo(() => params.get("mode") || "otp", [params]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const result = await authService.completePasswordReset(email, code.replace(/\D/g, "").slice(0, 6), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Unable to reset password.");
      return;
    }
    router.push("/reset-password/success");
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={mode === "otp" ? `Enter the recovery code sent to ${email}.` : "Enter your new password."}
    >
      <OtpInput value={code} onChange={setCode} disabled={loading} />
      <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" />
      <Input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" type="password" />
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      <Button className="w-full" onClick={() => void submit()} disabled={loading || code.replace(/\D/g, "").length !== 6 || !password || !confirmPassword}>
        {loading ? "Resetting..." : "Reset password"}
      </Button>
      <AuthLink href={`/forgot-password?email=${encodeURIComponent(email)}`} align="center">
        Back to recovery
      </AuthLink>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Reset password" subtitle="Preparing password reset."><div /></AuthShell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
