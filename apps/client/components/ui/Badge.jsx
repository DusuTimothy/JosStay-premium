import { Icon } from "@/components/ui/Icon";

const tones = {
  verified: "bg-cream text-ink border-gold-200",
  gold: "bg-cream text-ink border-gold-200",
  purple: "bg-plum-50 text-plum-700 border-plum-100",
  neutral: "bg-white/90 text-ink border-line",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  white: "bg-white text-ink border-line shadow-sm",
  dark: "bg-ink/85 text-white border-transparent backdrop-blur",
};

export function Badge({ children, tone = "neutral", icon, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold leading-none ${
        tones[tone] || tones.neutral
      } ${className}`}
    >
      {icon ? <Icon name={icon} className="h-3 w-3" strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

export function VerifiedBadge({ className = "", label = "Verified property" }) {
  return (
    <Badge tone="verified" icon="check" className={className}>
      {label}
    </Badge>
  );
}
