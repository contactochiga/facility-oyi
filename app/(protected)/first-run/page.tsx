"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Home as HomeIcon } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { facilityService, type EstateBuildingRow } from "@/services/facilityService";
import { useContextStore } from "@/store/useContextStore";
import { useSessionStore } from "@/store/useSessionStore";

// Office->Facility provisioning lifecycle closure -- requirement #15's
// first-run target ("Facility profile -> first Building -> first Home")
// rather than an empty generic dashboard. Reuses the exact
// facilityService.createBuilding/createHome calls and estate-resolution
// pattern already used by FacilityStructureWorkspace.tsx and the Overview
// page, not new endpoints. This is a one-time post-activation landing
// page, not a persistent gate -- existing Facilities are unaffected since
// nothing routes them here.

type Stage = "loading" | "building" | "home" | "done";

export default function FirstRunPage() {
  const router = useRouter();
  const { context } = useContextStore();
  const { user } = useSessionStore();
  const [estateId, setEstateId] = useState<string | null>(null);
  const [estateName, setEstateName] = useState<string>("");
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [buildingName, setBuildingName] = useState("");
  const [building, setBuilding] = useState<EstateBuildingRow | null>(null);
  const [homeName, setHomeName] = useState("");
  const [homeUnit, setHomeUnit] = useState("");

  const resolveEstate = useCallback(async () => {
    setError(null);
    try {
      const candidate = context?.estate_id || user?.estate_id || null;
      if (candidate) {
        setEstateId(String(candidate));
        setEstateName(context?.estate?.name || user?.estate_name || "");
        setStage("building");
        return;
      }
      const res = await facilityService.myEstates();
      const first = res.estates?.[0] || null;
      if (!first) {
        setError("No Facility is linked to your account yet. Contact your Ochiga representative.");
        setStage("building");
        return;
      }
      setEstateId(String(first.id));
      setEstateName(first.name);
      setStage("building");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to load your Facility.");
      setStage("building");
    }
  }, [context?.estate?.name, context?.estate_id, user?.estate_id, user?.estate_name]);

  useEffect(() => {
    void resolveEstate();
  }, [resolveEstate]);

  async function createFirstBuilding() {
    if (!estateId || !buildingName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await facilityService.createBuilding({ estate_id: estateId, name: buildingName.trim() });
      setBuilding(res.building);
      setStage("home");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to create this Building.");
    } finally {
      setSaving(false);
    }
  }

  async function createFirstHome() {
    if (!estateId || !homeName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await facilityService.createHome({
        estate_id: estateId,
        building_id: building?.id,
        name: homeName.trim(),
        unit: homeUnit.trim() || undefined,
        type: "home",
      });
      setStage("done");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to create this Home.");
    } finally {
      setSaving(false);
    }
  }

  function skipToOverview() {
    router.replace("/overview");
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-10 pt-2">
      <Topbar title="Set up your Facility" subtitle={estateName ? `Getting ${estateName} ready for residents` : "Let's get your Facility ready"} />

      {error ? <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}

      {stage === "loading" ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-zinc-400">Loading your Facility…</div>
      ) : null}

      {stage === "building" ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-sky-300" />
            <div>
              <h2 className="text-sm font-semibold text-white">Add your first Building</h2>
              <p className="mt-0.5 text-xs text-zinc-500">A Building groups Homes together — you can add more later.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Input value={buildingName} onChange={(event) => setBuildingName(event.target.value)} placeholder="Building name (e.g. Block A)" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void createFirstBuilding()} disabled={saving || !buildingName.trim() || !estateId}>
                {saving ? "Creating…" : "Create Building"}
              </Button>
              <Button variant="ghost" onClick={skipToOverview} disabled={saving}>
                Skip for now
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "home" ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2.5">
            <HomeIcon className="h-5 w-5 text-sky-300" />
            <div>
              <h2 className="text-sm font-semibold text-white">Add your first Home</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Homes are where residents live and get invited to.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Input value={homeName} onChange={(event) => setHomeName(event.target.value)} placeholder="Home name (e.g. Unit 4B)" />
            <Input value={homeUnit} onChange={(event) => setHomeUnit(event.target.value)} placeholder="Unit identifier (optional)" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void createFirstHome()} disabled={saving || !homeName.trim()}>
                {saving ? "Creating…" : "Create Home"}
              </Button>
              <Button variant="ghost" onClick={skipToOverview} disabled={saving}>
                Skip for now
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "done" ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <h2 className="text-sm font-semibold text-white">You're ready to go</h2>
          <p className="mt-1 text-xs text-zinc-500">Your first Building and Home are set up. You can invite a resident from Buildings any time.</p>
          <Button className="mt-4 w-full" onClick={skipToOverview}>
            Go to your Facility
          </Button>
        </section>
      ) : null}
    </div>
  );
}
