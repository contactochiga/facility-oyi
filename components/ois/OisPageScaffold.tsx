import Topbar from "@/components/shell/Topbar";
import OisPageToolbar from "@/components/ois/OisPageToolbar";

export default function OisPageScaffold({
  title,
  subtitle,
  strip,
  toolbar,
  registry,
  drawer,
  runtime,
  actions,
}: {
  title: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number; detail?: string; tone?: "stable" | "attention" | "warning" | "critical" | "info" }>;
  toolbar?: React.ReactNode;
  registry: React.ReactNode;
  drawer?: React.ReactNode;
  runtime?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ois-shell-page">
      <Topbar title={title} subtitle={subtitle} strip={strip} />
      {toolbar || <OisPageToolbar />}
      <section>{registry}</section>
      {drawer || null}
      {runtime ? <section>{runtime}</section> : null}
      {actions ? <section>{actions}</section> : null}
    </div>
  );
}
