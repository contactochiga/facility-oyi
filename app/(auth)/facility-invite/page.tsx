"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/services/authService";
import { facilityService, type MyEstatesResponse } from "@/services/facilityService";
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
//
// Office->Facility provisioning lifecycle closure -- extended from a bare
// verify->credentials->redirect flow into the full wizard the brief asks
// for (requirement #8): invitation verification -> account/security setup
// -> personal profile/photo -> Facility profile confirmation -> supported
// verification -> activation complete. Every added step reuses an
// already-proven function (authService.updateMyProfile/uploadMyAvatar,
// facilityService.myEstates) rather than inventing new endpoints, and the
// "verification" step is deliberately possession-based copy, not a
// fabricated OTP/MFA capability the current contract doesn't support.

type InvitePreview = {
  invite_id: string;
  estate: { id: string; name: string };
  invited_email: string | null;
  role: string;
  expires_at: string;
};

type WizardStep = "credentials" | "profile" | "facility" | "verify" | "complete";

function friendlyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("expired")) return "This activation link has expired. Ask Ochiga to send a new one.";
  if (lower.includes("revoked")) return "This activation link has been revoked.";
  if (lower.includes("accepted") || lower.includes("not pending")) return "This invite has already been used. If that was you, sign in instead.";
  if (lower.includes("not sent to your account email")) return "This invite was sent to a different email address than the account you're signed in as.";
  if (lower.includes("please sign in instead")) return message;
  if (lower.includes("not found")) return "We couldn't recognize this activation link.";
  return message || "This activation link could not be verified.";
}

function readableExpiry(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
}

function StepDots({ step }: { step: WizardStep }) {
  const order: WizardStep[] = ["credentials", "profile", "facility", "verify", "complete"];
  const index = order.indexOf(step);
  return (
    <div className="mb-1 flex items-center gap-1.5">
      {order.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? "bg-sky-400" : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}

function ProfileStep({
  onContinue,
  initialFullName,
  initialPhone,
}: {
  onContinue: () => void;
  initialFullName: string;
  initialPhone: string;
}) {
  const { patchUser } = useSessionStore();
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAvatarPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image must be 6MB or smaller.");
      return;
    }
    setAvatarBusy(true);
    setError(null);
    try {
      const res = await authService.uploadMyAvatar(file);
      if (!res.ok) {
        setError(res.error || "Unable to upload your photo.");
        return;
      }
      const url = res.avatar_url || res.profile_image_url || res.user?.avatar_url || res.profile?.avatar_url;
      setAvatarUrl(url || null);
      patchUser({ avatar_url: url || null, profile_image_url: url || null });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const res = await authService.updateMyProfile({ full_name: fullName.trim(), phone: phone.trim() || undefined });
      if (!res.ok) {
        setError(res.error || "Unable to save your profile.");
        return;
      }
      patchUser({ full_name: fullName.trim() });
      onContinue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full border border-sky-400/20 bg-sky-600/20 text-sm font-semibold text-zinc-100">
            {fullName.trim().slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">
          <Camera className="h-3.5 w-3.5" />
          {avatarBusy ? "Uploading..." : avatarUrl ? "Replace photo" : "Add a photo (optional)"}
          <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={(event) => void onAvatarPick(event)} />
        </label>
      </div>
      <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" />
      <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number (optional)" type="tel" />
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      <Button className="w-full" onClick={saveAndContinue} disabled={saving || !fullName.trim()}>
        {saving ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}

function FacilityConfirmStep({ estateId, onContinue }: { estateId: string | null; onContinue: () => void }) {
  const [loading, setLoading] = useState(true);
  const [estate, setEstate] = useState<MyEstatesResponse["estates"][number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await facilityService.myEstates();
        if (cancelled) return;
        const match = (res.estates || []).find((row) => String(row.id) === String(estateId)) || res.estates?.[0] || null;
        setEstate(match);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || "Unable to load your Facility profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estateId]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
        {loading ? (
          "Loading your Facility profile…"
        ) : error ? (
          <span className="text-rose-200">{error}</span>
        ) : estate ? (
          <dl className="space-y-2.5">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Facility name</dt>
              <dd className="text-zinc-100">{estate.name}</dd>
            </div>
            {estate.type ? (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Type</dt>
                <dd className="capitalize text-zinc-100">{estate.type}</dd>
              </div>
            ) : null}
            {estate.address ? (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Address</dt>
                <dd className="text-zinc-100">{estate.address}</dd>
              </div>
            ) : null}
            {estate.timezone ? (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Timezone</dt>
                <dd className="text-zinc-100">{estate.timezone}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          "Your Facility record could not be found."
        )}
      </div>
      <p className="text-xs text-zinc-500">
        These commercial/deployment details were set by Ochiga during provisioning. Contact your Ochiga representative if anything here needs to change.
      </p>
      <Button className="w-full" onClick={onContinue} disabled={loading}>
        This is correct, continue
      </Button>
    </div>
  );
}

function VerifyStep({ email, onContinue }: { email: string | null; onContinue: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <p>
          Your email{email ? <> (<strong>{email}</strong>)</> : null} is verified because you opened this secure,
          single-use activation link that Ochiga sent to your inbox. No further code is needed.
        </p>
      </div>
      <Button className="w-full" onClick={onContinue}>
        Confirm and finish activation
      </Button>
    </div>
  );
}

function CompleteStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
      </div>
      <p className="text-sm text-zinc-300">
        Your Facility is activated and you're set up as its owner. Next, set up your first Building and Home.
      </p>
      <Button className="w-full" onClick={onFinish}>
        Continue to your Facility
      </Button>
    </div>
  );
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

  const [wizardStep, setWizardStep] = useState<WizardStep | null>(null);

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
      setWizardStep("profile");
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
      setWizardStep("profile");
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

  if (wizardStep) {
    const stepCopy: Record<WizardStep, { title: string; subtitle: string }> = {
      credentials: { title: "", subtitle: "" },
      profile: { title: "Your profile", subtitle: "Add your name and a photo so your team recognizes you." },
      facility: { title: "Confirm your Facility", subtitle: "Review the deployment Ochiga provisioned for you." },
      verify: { title: "Verify your email", subtitle: "One last check before we finish activation." },
      complete: { title: "You're all set", subtitle: `Welcome to ${preview.estate.name}.` },
    };
    const copy = stepCopy[wizardStep];
    return (
      <AuthShell title={copy.title} subtitle={copy.subtitle}>
        <StepDots step={wizardStep} />
        {wizardStep === "profile" ? (
          <ProfileStep
            initialFullName={session.user?.full_name || ""}
            initialPhone={session.user?.phone || ""}
            onContinue={() => setWizardStep("facility")}
          />
        ) : null}
        {wizardStep === "facility" ? (
          <FacilityConfirmStep estateId={session.user?.estate_id || preview.estate.id} onContinue={() => setWizardStep("verify")} />
        ) : null}
        {wizardStep === "verify" ? (
          <VerifyStep email={session.user?.email || preview.invited_email} onContinue={() => setWizardStep("complete")} />
        ) : null}
        {wizardStep === "complete" ? <CompleteStep onFinish={() => router.replace("/first-run")} /> : null}
      </AuthShell>
    );
  }

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
