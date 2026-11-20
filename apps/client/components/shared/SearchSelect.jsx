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
  const isForm = variant === "form";
  const isFilter = variant === "filter";
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
      const width = Math.min(Math.max(rect.width, 264), window.innerWidth - 24);
      const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const openUp = below < 300 && above > below;
      const maxHeight = Math.min(360, Math.max(180, openUp ? above : below));
      setPosition({
        left,
        top: openUp ? Math.max(12, rect.top - Math.min(maxHeight, 360) - 10) : rect.bottom + 10,
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
      className="flex flex-col gap-0.5 p-1.5 outline-none"
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
            className={`group/opt flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
              isActive ? "bg-plum-50/80" : "bg-transparent hover:bg-canvas/70"
            } ${isSelected ? "bg-plum-50 text-plum-900" : "text-ink"}`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13.5px] leading-snug ${isSelected ? "font-semibold" : "font-medium"}`}>
                {option.label}
              </span>
              {option.hint ? (
                <span className={`mt-0.5 block text-[11px] leading-snug ${isSelected ? "text-plum-600/80" : "text-muted"}`}>
                  {option.hint}
                </span>
              ) : null}
            </span>
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all duration-150 ${
                isSelected
                  ? "border-plum-700 bg-plum-700 text-white shadow-[0_2px_6px_rgba(78,41,113,.25)]"
                  : isActive
                    ? "border-plum-200 bg-white"
                    : "border-line bg-white"
              }`}
              aria-hidden="true"
            >
              {isSelected ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );

  const panelHeader = (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 bg-gradient-to-b from-white to-canvas/30 px-3.5 pb-2.5 pt-3">
      <span className="inline-flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-plum-50 text-plum-700 ring-1 ring-inset ring-plum-100">
          <Icon name={icon || "sliders"} className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/80">
          {panelTitle || label}
        </span>
      </span>
      <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-inset ring-line/60">
        {options.length}
      </span>
    </div>
  );

  return (
    <div
      className={
        isInline
          ? `relative inline-flex ${className}`
          : isForm || isFilter
            ? `relative w-full ${className}`
            : `relative h-full bg-white ${className}`
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
            ? `inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold shadow-[0_1px_2px_rgba(28,18,42,.04)] outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-plum-300/40 focus-visible:ring-offset-1 ${
                open
                  ? "border-plum-300 bg-plum-50 text-plum-900 shadow-[0_0_0_3px_rgba(107,63,160,.08)]"
                  : "border-line bg-white text-ink hover:-translate-y-px hover:border-plum-200 hover:shadow-sm active:translate-y-0"
              }`
            : isForm
              ? `group flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-3 text-left text-sm text-ink shadow-[0_1px_0_rgba(28,18,42,.02)] outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-plum-100/70 ${
                  open
                    ? "border-plum-500 ring-2 ring-plum-100/70"
                    : "border-line hover:border-plum-200 hover:bg-canvas/20"
                }`
            : isFilter
              ? `group flex w-full items-center justify-between gap-2 rounded-lg px-0 py-1 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-plum-200/60 ${
                  open ? "text-plum-800" : "text-ink"
                }`
              : `group flex h-full w-full items-center gap-3 px-4 py-3 text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-plum-300/50 lg:px-5 ${
                  open ? "bg-plum-50/50" : "bg-white hover:bg-canvas/40"
                }`
        }
      >
        {isInline ? (
          <>
            <span className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${open ? "bg-plum-100 text-plum-700" : "bg-canvas text-plum-600"}`}>
              <Icon name={icon || "sliders"} className="h-3.5 w-3.5" />
            </span>
            <span className="text-[12px] font-medium text-muted">{label}</span>
            <span className="max-w-[170px] truncate text-[13px] text-ink">
              {selected?.label ?? placeholder}
            </span>
            <Icon
              name="chevronDown"
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                open ? "rotate-180 text-plum-700" : "text-muted/80"
              }`}
            />
          </>
        ) : isForm ? (
          <>
            <span className={`min-w-0 flex-1 truncate ${selected ? "font-medium text-ink" : "text-muted/80"}`}>
              {selected?.label ?? placeholder}
            </span>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${open ? "bg-plum-50 text-plum-700" : "text-muted group-hover:bg-canvas group-hover:text-plum-600"}`}>
              <Icon
                name="chevronDown"
                className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </span>
          </>
        ) : isFilter ? (
          <>
            <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em] ${selected ? "text-ink" : "text-muted"}`}>
              {selected?.label ?? placeholder}
            </span>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-150 ${open ? "bg-plum-50 text-plum-700" : "text-muted group-hover:bg-plum-50/70 group-hover:text-plum-700"}`}>
              <Icon
                name="chevronDown"
                className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </span>
          </>
        ) : (
          <>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-150 ${open ? "bg-plum-100 text-plum-700" : "bg-plum-50/70 text-plum-600 group-hover:bg-plum-100/80"}`}>
              <Icon
                name={icon || "search"}
                className="h-[18px] w-[18px]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {label}
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {selected?.label ?? placeholder}
                </span>
                <Icon
                  name="chevronDown"
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    open ? "rotate-180 text-plum-700" : "text-muted/70 group-hover:text-plum-600"
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
                  className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[3px]"
                  aria-label={`Close ${label}`}
                  onClick={close}
                />
                <div
                  ref={panelRef}
                  className="absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col overflow-hidden rounded-t-[1.75rem] border-t border-white/60 bg-white shadow-[0_-30px_80px_-24px_rgba(28,18,42,.5)] animate-slide-up"
                >
                  <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" />
                  <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-plum-700">
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-plum-50 text-plum-700 ring-1 ring-inset ring-plum-100">
                          <Icon name={icon || "sliders"} className="h-3.5 w-3.5" />
                        </span>
                        {panelTitle || label}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        Choose an option below
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink shadow-sm transition hover:bg-canvas"
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
                className="z-[95] flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-white shadow-[0_30px_80px_-28px_rgba(28,18,42,.45)] ring-1 ring-black/[0.02] animate-fade-in"
              >
                {panelHeader}
                <div className="min-h-0 flex-1 overflow-auto">
                  {optionList}
                </div>
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
