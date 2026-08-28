"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { useSessionStore } from "@/store/useSessionStore";
import { decodeToken, isExpired } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";

// Commercial production-hardening -- this is Facility's activation screen
// for an Ochiga-Office-issued estate-owner invite. Facility previously had
// no equivalent to this at all (public signup let anyone self-provision an
// estate instead); this is the replacement authorized path. Mirrors
// Consumer's own invite-activation UI pattern (validate token -> collect
// identity -> activate), adapted to Facility's design system and to the
// estate-owner (not resident/home) invite shape.

type InvitePreview = {
  invite_id: string;
  estate: { id: string; name: string };
  invited_email: string | null;
  role: string;
  expires_at: string;
};

function friendlyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("expired")) return "This activation link has expired. Ask Ochiga to send a new one.";
  if (lower.includes("revoked")) return "This activation link has been revoked.";
  if (lower.includes("accepted") || lower.includes("not pending")) return "This invite has already been used. If that was you, sign in instead.";
  if (lower.includes("not sent to your account email")) return "This invite was sent to a different email address than the account you're signed in as.";
  if (lower.includes("already exists")) return "An account already exists for this email. Please sign in instead.";
  if (lower.includes("not found")) return "We couldn't recognize this activation link.";
  return message || "This activation link could not be verified.";
}

function readableExpiry(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
}

function FacilityInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useMemo(() => (params.get("token") || "").trim(), [params]);
  const session = useSessionStore();

  const [mounted, setMounted] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [useDifferentAccount, setUseDifferentAccount] = useState(false);

  useEffect(() => {
    setMounted(true);
    session.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      setValidationError("This activation link is missing its token.");
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await authService.validateEstateInvite(token);
      if (cancelled) return;
      if (res?.ok && res?.preview) {
        setPreview(res.preview);
      } else {
        setValidationError(friendlyError(res?.error || ""));
      }
      setLoadingPreview(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, token]);

  const hasActiveSession = Boolean(session.hydrated && session.token && session.user && !isExpired(session.user));

  async function acceptAsCurrentUser() {
    if (!session.token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await authService.acceptEstateInvite(token, session.token);
      if (res?.error || !res?.token) {
        setFormError(friendlyError(res?.error || ""));
        return;
      }
      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setFormError("Secure session could not be created.");
        return;
      }
      session.setToken(res.token);
      router.replace("/overview");
    } catch (err: any) {
      setFormError(err?.message || "Unable to accept this invite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function activateAsNewUser() {
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authService.activateEstateInvite({ token, username: username.trim(), password, confirmPassword });
      if (res?.error || !res?.token) {
        setFormError(friendlyError(res?.error || ""));
        return;
      }
      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setFormError("Secure session could not be created.");
        return;
      }
      session.setToken(res.token);
      router.replace("/overview");
    } catch (err: any) {
      setFormError(err?.message || "Unable to activate this invite.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || loadingPreview) {
    return (
      <AuthShell title="Facility activation" subtitle="Verifying your activation link.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
          Verifying your activation link…
        </div>
      </AuthShell>
    );
  }

  if (validationError || !preview) {
    return (
      <AuthShell title="Facility activation" subtitle="This link needs attention.">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {validationError || "This activation link could not be verified."}
        </div>
        <Button className="w-full" onClick={() => router.replace("/login")}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  const expiry = readableExpiry(preview.expires_at);

  return (
    <AuthShell
      title={`Activate ${preview.estate.name}`}
      subtitle={`Ochiga has invited you to own and administer this Oyi Facility deployment${expiry ? ` (link expires ${expiry})` : ""}.`}
    >
      {hasActiveSession && !useDifferentAccount ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            You're signed in as <strong>{session.user?.email}</strong>.
          </div>
          {formError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</div>
          ) : null}
          <Button className="w-full" onClick={acceptAsCurrentUser} disabled={submitting}>
            {submitting ? "Activating..." : `Accept as ${session.user?.email}`}
          </Button>
          <button
            type="button"
            onClick={() => setUseDifferentAccount(true)}
            className="w-full text-center text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            Not you? Use a different account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Choose a username" />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" type="password" />
          <Input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            type="password"
          />
          {formError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</div>
          ) : null}
          <Button
            className="w-full"
            onClick={activateAsNewUser}
            disabled={submitting || !username.trim() || !password || !confirmPassword}
          >
            {submitting ? "Activating..." : "Activate and sign in"}
          </Button>
          <div className="text-center text-sm text-zinc-500">
            Already have an Oyi account?{" "}
            <button
              type="button"
              onClick={() => router.replace(`/login?next=${encodeURIComponent(`/facility-invite?token=${token}`)}`)}
              className="text-sky-200 transition hover:text-sky-100"
            >
              Sign in first
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export default function FacilityInvitePage() {
  return (
    <Suspense fallback={<AuthShell title="Facility activation" subtitle="Verifying your activation link."><div /></AuthShell>}>
      <FacilityInviteInner />
    </Suspense>
  );
}
