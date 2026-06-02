import { redirect } from "next/navigation";

export default function SecurityCompatibilityRedirect() {
  redirect("/security-access");
}
