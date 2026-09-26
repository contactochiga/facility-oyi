import type { InteractionScope } from "oyi-twin-engine";
import type { OisContext } from "@/store/useContextStore";

// facility-oyi is a staff/operator surface (surface: "facility" resolved
// context) — residents use a separate Consumer OS, so in practice every
// session here resolves to "facility" scope. The rule below is still real
// (derived from the actual role/permissions the host resolved), not a
// hardcoded constant, per Phase 7 §4: the engine must receive scope from
// the caller, never assume "Facility sees everything" on its own.
const HOME_LEVEL_ROLES = new Set(["owner", "resident"]);

export function deriveLunaScope(context: OisContext | null): InteractionScope {
  if (!context) return "facility";
  if (HOME_LEVEL_ROLES.has(context.role)) return "consumer";
  const hasOperationalPermission = context.permissions.some((p) => p.startsWith("facility.") || p.startsWith("staff.") || p.startsWith("estate."));
  if (!hasOperationalPermission && context.permissions.length > 0) return "consumer";
  return "facility";
}
