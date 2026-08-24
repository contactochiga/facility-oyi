import { LoaderCircle, type LucideIcon } from "lucide-react";

export default function OyiProcessingRow({ label, icon: Icon = LoaderCircle }: { label: string; icon?: LucideIcon }) {
  return (
    <div className="oyi-shell-processing" role="status" aria-live="polite" aria-atomic="true">
      <span className="oyi-shell-processing-icon" aria-hidden="true"><Icon /></span>
      <span className="truncate">{label}</span>
    </div>
  );
}
