import { redirect } from "next/navigation";

export default function VisitorsCompatibilityPage() {
  redirect("/traffic?view=visitors");
}
