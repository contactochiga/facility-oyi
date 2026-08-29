"use client";

// PHASE 3 UX/commercial closure -- Oyi Facility is invitation-only.
// Public self-service signup has been removed: this route no longer
// renders a signup form (that behavior was only ever a genuine security
// gap even though it could not self-escalate to a Facility role -- it
// still let any anonymous visitor mint an unsolicited account). Anyone
// who lands here (direct URL, old bookmark, old link) is redirected to
// login immediately -- this is a real redirect, not a hidden button; the
// route has no reachable form behind it. Facility access begins only
// from an Ochiga-issued invitation (see app/(auth)/facility-invite),
// which is untouched by this change.
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";

function SignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <AuthShell title="Invitation required" subtitle="Facility access begins from an Ochiga-issued invitation.">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
        Redirecting to sign in...
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Invitation required" subtitle="Facility access begins from an Ochiga-issued invitation."><div /></AuthShell>}>
      <SignupRedirect />
    </Suspense>
  );
}
