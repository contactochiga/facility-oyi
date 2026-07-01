"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { AuthShell } from "@/components/auth/AuthShell";

function ForgotPasswordSentInner() {
  const params = useSearchParams();
  const email = useMemo(() => params.get("email") || "your email", [params]);
  const mode = useMemo(() => params.get("mode") || "reset_link", [params]);

  return (
    <AuthShell
      title="Email sent"
      subtitle={mode === "otp" ? `A recovery code was sent to ${email}.` : `A recovery link was sent to ${email}.`}
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-zinc-400">
        Continue after the recovery message arrives. If it doesn’t appear, check spam or retry from the recovery screen.
      </div>
      <Link href={`/reset-password?email=${encodeURIComponent(email)}&mode=${encodeURIComponent(mode)}`} className="block">
        <Button className="w-full">Continue</Button>
      </Link>
      <Link href="/login" className="block text-center text-sm text-zinc-500 transition hover:text-zinc-300">
        Back to sign in
      </Link>
    </AuthShell>
  );
}

export default function ForgotPasswordSentPage() {
  return (
    <Suspense fallback={<AuthShell title="Email sent" subtitle="Preparing recovery confirmation."><div /></AuthShell>}>
      <ForgotPasswordSentInner />
    </Suspense>
  );
}
