"use client";

import Button from "@/components/ui/Button";
import { deleteCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import { useRouter } from "next/navigation";

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const { user, clear } = useSessionStore();

  function logout() {
    deleteCookie("oyi_facility_token");
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="title">{title}</div>
        {subtitle && <div className="muted mt-1">{subtitle}</div>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-sm text-zinc-200">{user?.email ?? "—"}</div>
          <div className="text-xs text-zinc-500">{user?.role ?? "operator"}</div>
        </div>
        <Button variant="ghost" onClick={logout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
