"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

const byValue = (value) => (option) => option.value === value;

export function SearchSelect({
  icon,
  label,
  value,
  onChange,
  options,
  placeholder = "",
  ariaLabel,
  panelTitle,
  variant = "field",
  className = "",
}) {
  const isInline = variant === "inline";
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex(byValue(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => setMounted(true), []);

  const close = () => setOpen(false);

  const toggle = () => {
    if (!open && typeof window !== "undefined") {
      setIsMobile(window.matchMedia("(max-width: 639px)").matches);
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);

    const mql = window.matchMedia("(max-width: 639px)");
    const updateMode = () => setIsMobile(mql.matches);

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 248), window.innerWidth - 24);
      const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const openUp = below < 280 && above > below;
      const maxHeight = Math.min(320, Math.max(160, openUp ? above : below));
      setPosition({
        left,
        top: openUp ? Math.max(12, rect.top - Math.min(maxHeight, 320) - 8) : rect.bottom + 8,
        width,
        maxHeight,
      });
    };

    updateMode();
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    mql.addEventListener?.("change", updateMode);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      mql.removeEventListener?.("change", updateMode);
    };
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) {
          onChange(option.value);
          close();
          triggerRef.current?.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, activeIndex, options, onChange]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectOption = (option) => {
    onChange(option.value);
    close();
    triggerRef.current?.focus();
  };

  const optionList = (
    <div
      id={listId}
      role="listbox"
      aria-label={label}
      tabIndex={-1}
      className="outline-none"
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isActive = index === activeIndex;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => selectOption(option)}
            onMouseEnter={() => setActiveIndex(index)}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition ${
              isActive ? "bg-plum-50" : "bg-transparent"
            } ${isSelected ? "font-semibold text-plum-800" : "font-medium text-ink"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]">{option.label}</span>
              {option.hint ? (
                <span className="mt-0.5 block text-[11px] font-normal text-muted">
                  {option.hint}
                </span>
              ) : null}
            </span>
            {isSelected ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-plum-700 text-white">
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
            ) : (
              <span className="h-6 w-6 shrink-0 rounded-full border border-line" />
            )}
          </button>
        );
      })}
    </div>
  );

  const panelHeader = (
    <div className="flex items-center justify-between gap-3 px-3 pb-1.5 pt-1">
      <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-plum-700">
        <Icon name={icon || "sliders"} className="h-3.5 w-3.5" />
        {panelTitle || label}
      </span>
      <span className="text-[10px] font-medium text-muted">
        {options.length} option{options.length === 1 ? "" : "s"}
      </span>
    </div>
  );

  return (
    <div
      className={
        isInline ? `relative inline-flex ${className}` : `relative h-full bg-white ${className}`
      }
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel || label}
        className={
          isInline
            ? `inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold shadow-[0_1px_2px_rgba(28,18,42,.04)] outline-none transition focus-visible:ring-2 focus-visible:ring-plum-200 ${
                open
                  ? "border-plum-400 bg-plum-50 text-plum-800"
                  : "border-line bg-white text-ink hover:border-plum-300 hover:shadow-sm"
              }`
            : `group flex h-full w-full items-center gap-3 px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-plum-300 lg:px-5 ${
                open ? "bg-plum-50/60" : "bg-white"
              }`
        }
      >
        {isInline ? (
          <>
            <Icon
              name={icon || "sliders"}
              className={`h-4 w-4 transition ${open ? "text-plum-700" : "text-plum-600"}`}
            />
            <span className="font-medium text-muted">{label}</span>
            <span className="h-3.5 w-px bg-line" aria-hidden="true" />
            <span className="max-w-[160px] truncate text-ink">
              {selected?.label ?? placeholder}
            </span>
            <Icon
              name="chevronDown"
              className={`h-3.5 w-3.5 shrink-0 transition ${
                open ? "rotate-180 text-plum-700" : "text-muted"
              }`}
            />
          </>
        ) : (
          <>
            <Icon
              name={icon || "search"}
              className={`h-5 w-5 shrink-0 transition ${open ? "text-plum-700" : "text-plum-600"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {label}
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold text-ink">
                  {selected?.label ?? placeholder}
                </span>
                <Icon
                  name="chevronDown"
                  className={`h-4 w-4 shrink-0 transition ${
                    open ? "rotate-180 text-plum-700" : "text-muted group-hover:text-plum-600"
                  }`}
                />
              </span>
            </span>
          </>
        )}
      </button>

      {open && mounted && (isMobile || position)
        ? createPortal(
            isMobile ? (
              <div className="fixed inset-0 z-[95] sm:hidden">
                <button
                  type="button"
                  className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]"
                  aria-label={`Close ${label}`}
                  onClick={close}
                />
                <div
                  ref={panelRef}
                  className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-3xl bg-white shadow-[0_-24px_60px_-20px_rgba(28,18,42,.45)] animate-slide-up"
                >
                  <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" />
                  <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-plum-700">
                        <Icon name={icon || "sliders"} className="h-3.5 w-3.5" />
                        {panelTitle || label}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        Tap an option to continue
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink"
                      aria-label="Close"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[62vh] overflow-auto px-2 pb-[max(env(safe-area-inset-bottom),1rem)] pt-1">
                    {optionList}
                  </div>
                </div>
              </div>
            ) : (
              <div
                ref={panelRef}
                style={{
                  position: "fixed",
                  left: position?.left ?? 0,
                  top: position?.top ?? 0,
                  width: position?.width ?? 260,
                  maxHeight: position?.maxHeight ?? 320,
                }}
                className="z-[95] overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_28px_70px_-24px_rgba(28,18,42,.45)] animate-fade-in"
              >
                {panelHeader}
                {optionList}
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
