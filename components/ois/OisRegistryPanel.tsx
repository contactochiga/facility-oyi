import type { ReactNode } from "react";
import OisCard from "./OisCard";
import OisRegistryHeader from "./OisRegistryHeader";

export default function OisRegistryPanel({
  title,
  caption,
  action,
  toolbar,
  children,
  className = "p-4 sm:p-5",
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <OisCard className={className}>
      <OisRegistryHeader title={title} caption={caption} action={action} />
      {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      <div className="mt-4">{children}</div>
    </OisCard>
  );
}
