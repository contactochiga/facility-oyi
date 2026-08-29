"use client";

// PHASE 3 UX closure -- Account is no longer a standalone administrative
// workspace; it duplicated Facility Administration and exposed raw
// technical identifiers (user/estate UUIDs) as primary content. All real
// functionality (password change, notification preferences, sign out) has
// moved into Facility Administration's "My Profile" tab. This route stays
// only as a redirect so old bookmarks/links keep working, rather than
// leaving a dead or 404 destination behind.
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shell/Topbar";

function AccountRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/facility-administration?tab=profile");
  }, [router]);
  return <div className="space-y-6"><Topbar title="My Profile" subtitle="Redirecting to Facility Administration." /></div>;
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Topbar title="My Profile" subtitle="Redirecting to Facility Administration." /></div>}>
      <AccountRedirect />
    </Suspense>
  );
}
