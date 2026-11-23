"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { refresh } = useAuth();
  const [state, setState] = useState(token ? "loading" : "missing"); // loading | success | error | missing
  const [message, setMessage] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (!token || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const res = await api.post("/api/auth/verify-email/confirm", { token });
        setState("success");
        setMessage(res?.message || "Email address verified");
        // Refresh session so the account badge updates if the user is signed in.
        refresh().catch(() => {});
      } catch (err) {
        setState("error");
        setMessage(
          err instanceof ApiError
            ? err.message
            : "This verification link is invalid or has expired.",
        );
      }
    })();
  }, [refresh, token]);

  return (
    <div className="container-page pb-16 pt-8 sm:pt-12">
      <span className="eyebrow">Account security</span>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
        Verify your email.
      </h1>
      <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
        Confirming your email helps keep your JosStay account secure.
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
        {state === "loading" && (
          <div className="text-[13px] text-muted">Verifying your email address…</div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-[13px] text-emerald-900">
              <p className="font-semibold">Email verified</p>
              <p className="mt-1 text-emerald-800">{message}</p>
            </div>
            <Button href="/account" size="lg">Go to your account</Button>
          </div>
        )}

        {(state === "error" || state === "missing") && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-[13px] text-red-700">
              <p className="font-semibold">Verification link not valid</p>
              <p className="mt-1">
                {state === "missing"
                  ? "This verification link is missing a token."
                  : message}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button href="/account" size="md">Go to account</Button>
              <Link
                href="/account"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-plum-300 hover:text-plum-800"
              >
                Resend from account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VerifyEmailView() {
  return (
    <Suspense
      fallback={
        <div className="container-page pb-16 pt-8 sm:pt-12">
          <div className="h-8 w-48 animate-pulse rounded bg-line/60" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
