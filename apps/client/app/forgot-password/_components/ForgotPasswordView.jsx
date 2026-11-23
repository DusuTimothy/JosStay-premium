"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError("Enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/auth/password/forgot", { email: trimmedEmail });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not send reset instructions. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page pb-16 pt-8 sm:pt-12">
      <span className="eyebrow">Account recovery</span>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
        Reset your password.
      </h1>
      <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
        Enter the email address for your account and we&apos;ll send a secure reset link.
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
        {submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-[13px] text-emerald-900">
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-emerald-800">
              If an account matches <span className="font-semibold">{email.trim().toLowerCase()}</span>,
              we sent a password reset link. The link expires shortly and can be used once.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className={`field ${error ? "!border-red-400" : ""}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
            </label>

            <Button type="submit" full size="lg" loading={submitting}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-[11.5px] text-muted">
          Remember your password?{" "}
          <Link href="/account" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
