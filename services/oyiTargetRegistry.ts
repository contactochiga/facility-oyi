import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import type { InfrastructureSource } from "@/services/infrastructurePostureService";

export type OyiTarget = {
  target_type: "workflow" | "prediction" | "incident" | "maintenance" | "visitor" | "device" | "camera" | "infrastructure" | "wallet" | "service" | "community" | "message" | "handover" | "none";
  target_id?: string | null;
  infrastructure_source?: InfrastructureSource;
  open_as: "drawer" | "page" | "queue" | "attention" | "none";
  action?: string;
};

type Router = { push: (href: string) => void };
export type TargetResolution = { handled: boolean; error?: string; legacy?: boolean };

/** Resolves only typed Oyi targets. Callers may use their legacy fallback when handled is false. */
export function resolveFacilityOyiTarget(target: OyiTarget | null | undefined, router: Router): TargetResolution {
  if (!target || target.target_type === "none" || target.open_as === "none") return { handled: false, error: "No source destination is available." };
  if (target.target_type === "workflow" && target.target_id) {
    openWorkflowDrawer(target.target_id);
    return { handled: true };
  }
  if (target.target_type === "infrastructure" && target.infrastructure_source) {
    openInfrastructureDrawer(target.infrastructure_source);
    return { handled: true };
  }
  const pages: Record<Exclude<OyiTarget["target_type"], "workflow" | "infrastructure" | "none">, string> = {
    prediction: "/facility-intelligence?module=predictions",
    incident: "/alerts",
    maintenance: "/maintenance",
    visitor: "/visitors",
    device: "/hardware-devices",
    camera: "/cameras",
    wallet: "/wallets",
    service: "/services",
    community: "/community",
    message: "/messages",
    handover: "/facility-intelligence?module=handover",
  };
  const href = pages[target.target_type as keyof typeof pages];
  if (!href) return { handled: false, error: "This source is unavailable in Facility OS." };
  router.push(href);
  return { handled: true };
}
