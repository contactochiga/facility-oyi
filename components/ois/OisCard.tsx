import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type OisCardVariant = "default" | "raised" | "hero" | "evidence" | "attention" | "critical";

const variants: Record<OisCardVariant, string> = {
  default: "ois-surface rounded-[var(--ois-radius-card)]",
  raised: "ois-surface-raised rounded-[var(--ois-radius-card)]",
  hero: "ois-surface-raised rounded-[var(--ois-radius-hero)] shadow-[var(--ois-elevation-raised)]",
  evidence: "ois-evidence-surface rounded-[var(--ois-radius-row)]",
  attention: "rounded-[var(--ois-radius-card)] border border-[var(--ois-status-attention-border)] bg-[var(--ois-status-attention-surface)]",
  critical: "rounded-[var(--ois-radius-card)] border border-[var(--ois-status-critical-border)] bg-[var(--ois-status-critical-surface)]",
};

export type OisCardProps<T extends ElementType = "section"> = {
  as?: T;
  variant?: OisCardVariant;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export default function OisCard<T extends ElementType = "section">({
  as,
  variant = "default",
  className = "",
  children,
  ...props
}: OisCardProps<T>) {
  // Cast to `any` only for this dynamic-tag render: with a very large
  // JSX.IntrinsicElements (react-three-fiber's tags merged in globally),
  // TS's LibraryManagedAttributes resolution for a runtime-computed tag
  // collapses `children` to `never`. OisCardProps<T> above still enforces
  // full typing at every call site.
  const Component = (as || "section") as any;
  return <Component className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</Component>;
}
