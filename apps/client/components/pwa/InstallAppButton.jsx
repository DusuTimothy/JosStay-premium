"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOs;
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true
  );
};

export function InstallAppButton({
  variant = "secondary",
  size = "sm",
  full = false,
  label = "Install app",
  className = "",
}) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(null);
  const [platform, setPlatform] = useState("desktop");
  const [mounted, setMounted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    setPlatform(isIos() ? "ios" : /android/i.test(navigator.userAgent || "") ? "android" : "desktop");

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  if (installed !== false) return null;

  const canInstall =
    Boolean(promptEvent) || platform === "ios" || platform === "android";
  if (!canInstall) return null;

  const handleInstall = async () => {
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
    } catch {
      setHelpOpen(true);
    } finally {
      setInstalling(false);
    }
  };

  const steps =
    platform === "ios"
      ? [
          { icon: "share", text: "Tap the Share button in the Safari toolbar." },
          { icon: "plus", text: "Choose Add to Home Screen." },
          { icon: "check", text: "Tap Add — JosStay will appear with your other apps." },
        ]
      : platform === "android"
        ? [
            { icon: "menu", text: "Open the browser menu (⋮)." },
            { icon: "plus", text: "Choose Install app or Add to Home screen." },
            { icon: "check", text: "Confirm to add JosStay to your home screen." },
          ]
        : [
            { icon: "download", text: "Click the install icon in your browser's address bar." },
            { icon: "plus", text: "Choose Install JosStay." },
            { icon: "check", text: "Confirm to open JosStay in its own window." },
          ];

  return (
    <>
      <Button
        variant={variant}
        size={size}
        full={full}
        className={className}
        icon="download"
        loading={installing}
        onClick={handleInstall}
      >
        {label}
      </Button>

      {mounted && helpOpen
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0 bg-ink/50 animate-fade-in"
                aria-label="Close install instructions"
                onClick={() => setHelpOpen(false)}
              />
              <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="eyebrow">Home screen app</span>
                    <h2 className="mt-2 font-display text-xl font-bold text-ink">Install JosStay</h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
                    onClick={() => setHelpOpen(false)}
                    aria-label="Close install instructions"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  Add JosStay to your phone for quicker access. It opens full-screen like an app,
                  but bookings and payments still need an internet connection.
                </p>

                <ol className="mt-4 space-y-2.5">
                  {steps.map((step, index) => (
                    <li
                      key={step.text}
                      className="flex items-start gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-plum-700">
                        <Icon name={step.icon} className="h-4 w-4" />
                      </span>
                      <span className="text-[12.5px] leading-relaxed text-ink">
                        <strong className="font-semibold">{index + 1}.</strong> {step.text}
                      </span>
                    </li>
                  ))}
                </ol>

                <Button full className="mt-4" onClick={() => setHelpOpen(false)}>
                  Got it
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
