"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { api, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const next = {};
    if (!token) next.token = "This reset link is missing or invalid.";
    if (password.length < 8) next.password = "Use at least 8 characters";
    if (confirmPassword !== password) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.post("/api/auth/password/reset", { token, password });
      setDone(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Could not reset your password. Please request a new link.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page pb-16 pt-8 sm:pt-12">
      <span className="eyebrow">Account recovery</span>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
        Choose a new password.
      </h1>
      <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
        Your new password must be at least 8 characters. After resetting, you&apos;ll sign in again on all devices.
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-[13px] text-emerald-900">
              <p className="font-semibold">Password updated</p>
              <p className="mt-1 text-emerald-800">
                Your password has been changed. Sign in with your new password.
              </p>
            </div>
            <Link
              href="/account"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-gold-500 px-4 text-sm font-semibold text-ink transition hover:bg-gold-400"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {errors.token && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700" role="alert">
                {errors.token}{" "}
                <Link href="/forgot-password" className="font-semibold underline underline-offset-4">
                  Request a new link
                </Link>
                .
              </div>
            )}
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700" role="alert">
                {formError}
              </div>
            )}

            <PasswordField
              label="New password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((er) => ({ ...er, password: undefined }));
              }}
              error={errors.password}
              hint="At least 8 characters."
              placeholder="Create a new password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
            />

            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((er) => ({ ...er, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
            />

            <Button type="submit" full size="lg" loading={submitting} disabled={!token}>
              Update password
            </Button>
          </form>
        )}

        {!done && (
          <p className="mt-5 text-center text-[11.5px] text-muted">
            Need a new link?{" "}
            <Link href="/forgot-password" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">
              Forgot password
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordView() {
  return (
    <Suspense
      fallback={
        <div className="container-page pb-16 pt-8 sm:pt-12">
          <div className="h-8 w-48 animate-pulse rounded bg-line/60" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
