import { Icon } from "@/components/ui/Icon";

export function Divider() {
  return <div className="border-t border-line" />;
}

export function TrustRow({ icon, title, text }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 shrink-0 text-plum-700">
        <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={1.6} />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted">{text}</p>
      </div>
    </div>
  );
}
