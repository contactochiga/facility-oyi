"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ResetPasswordSuccessPage() {
  return (
    <AuthShell title="Password updated" subtitle="Your operator password has been changed.">
      <Link href="/login" className="block">
        <Button className="w-full">Return to sign in</Button>
      </Link>
    </AuthShell>
  );
}
