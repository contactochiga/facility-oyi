import type { CSSProperties, ReactNode, RefObject } from "react";
import type { LucideIcon } from "lucide-react";

export type OyiShellCapability = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  onSelect: () => void;
};

export type OyiShellMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

export type OyiInteractionShellProps = {
  open: boolean;
  title: string;
  subtitle: string;
  contextLabel?: string;
  accentClass?: string;
  messages: OyiShellMessage[];
  processingLabel?: string | null;
  processingIcon?: LucideIcon;
  emptyState?: ReactNode;
  history?: ReactNode;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onClose: () => void;
  onSubmit: (value: string) => void;
  input: string;
  onInputChange: (value: string) => void;
  busy?: boolean;
  capabilities?: OyiShellCapability[];
  onStartVoice?: () => void;
  voiceActive?: boolean;
  voiceElapsed?: number;
  voiceError?: string | null;
  onStopVoice?: () => void;
  onCancelVoice?: () => void;
  renderMessage?: (message: OyiShellMessage) => ReactNode;
  headerActions?: ReactNode;
  viewportStyle?: CSSProperties;
  panelStyle?: CSSProperties;
  composerRef?: RefObject<HTMLFormElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};
