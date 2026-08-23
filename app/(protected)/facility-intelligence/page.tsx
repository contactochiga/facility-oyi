import { redirect } from "next/navigation";

export default function LegacyFacilityIntelligenceRoute() {
  redirect("/overview?oyi=open");
}
