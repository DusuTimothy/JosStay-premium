"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const variants = {
  primary:
    "bg-gold-500 text-ink hover:bg-gold-400 active:bg-gold-600 border border-transparent",
  plum: "bg-plum-700 text-white hover:bg-plum-800 border border-transparent",
  secondary:
    "bg-white text-ink border border-line hover:border-plum-300 hover:text-plum-800",
  ghost: "bg-transparent text-ink hover:bg-black/5 border border-transparent",
  gold: "bg-gold-500 text-ink hover:bg-gold-400 border border-transparent",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  subtle: "bg-plum-50 text-plum-700 hover:bg-plum-100 border border-transparent",
  dark: "bg-ink text-white hover:bg-black border border-transparent",
};

const sizes = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-[52px] px-5 text-[15px] gap-2",
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  full = false,
  loading = false,
  icon,
  iconRight,
  className = "",
  type = "button",
  disabled,
  ...rest
}) {
  const base = `inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
    variants[variant] || variants.primary
  } ${sizes[size] || sizes.md} ${full ? "w-full" : ""} ${className}`;

  const content = (
    <>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <Icon name={icon} className="h-4 w-4" />
      ) : null}
      <span>{children}</span>
      {iconRight && !loading ? <Icon name={iconRight} className="h-4 w-4" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={base} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={base} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}
