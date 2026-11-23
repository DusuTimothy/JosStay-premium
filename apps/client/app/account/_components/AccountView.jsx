"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { useAuth, useBooking, useToast } from "@/components/providers";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const SIGNUP_MIN_PASSWORD_LENGTH = 8;

const shortcuts = [
  { href: "/bookings", icon: "calendar", title: "My bookings", text: "View and manage your stays in Jos." },
  { href: "/host/dashboard", icon: "home", title: "Host dashboard", text: "Manage listings, calendar and payouts." },
  { href: "/bundle", icon: "plane", title: "Flight + stay", text: "Coming soon — flight booking will be available later." },
  { href: "/help", icon: "whatsapp", title: "Help centre", text: "Answers, policies and support." },
];

function getErrorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
}

export function AccountView() {
  const { bookings } = useBooking();
  const { toast } = useToast();
  const auth = useAuth();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const googleButtonRef = useRef(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrors({});
    setFormError("");
  };

  useEffect(() => {
    if (auth.isAuthenticated || auth.isLoading || !googleClientId) return;

    let cancelled = false;
    const initializeGoogle = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
      try {
        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response?.credential || cancelled) return;
            setSubmitting(true);
            setFormError("");
            try {
              await auth.loginWithGoogle({ credential: response.credential });
              toast("Signed in with Google", "success");
            } catch (error) {
              const message = getErrorMessage(error, "Could not sign in with Google");
              setFormError(message);
              toast(message, "error");
            } finally {
              if (!cancelled) setSubmitting(false);
            }
          },
          ux_mode: "popup",
          context: mode === "signup" ? "signup" : "signin",
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "signin_with",
          width: 320,
        });
        setGoogleReady(true);
        setGoogleError("");
      } catch {
        if (!cancelled) setGoogleError("Google sign-in is unavailable right now");
      }
    };

    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    if (existing) {
      existing.addEventListener("load", initializeGoogle);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", initializeGoogle);
      };
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      if (!cancelled) setGoogleError("Could not load Google sign-in");
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
    };
  }, [auth, auth.isAuthenticated, auth.isLoading, googleClientId, mode, toast]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const next = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (mode === "signup" && trimmedName.length < 2) {
      next.name = "Enter your full name";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address";
    }
    if (mode === "signup") {
      if (password.length < SIGNUP_MIN_PASSWORD_LENGTH) {
        next.password = `Use at least ${SIGNUP_MIN_PASSWORD_LENGTH} characters`;
      }
    } else if (password.length < 1) {
      next.password = "Enter your password";
    }

    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await auth.register({ name: trimmedName, email: trimmedEmail, password });
        toast("Account created. Check your email to verify your address.", "success");
      } else {
        await auth.login({ email: trimmedEmail, password });
        toast("Signed in to your JosStay account", "success");
      }
      setPassword("");
    } catch (error) {
      const message = getErrorMessage(
        error,
        mode === "signup" ? "Could not create your account" : "Could not sign you in",
      );
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await auth.logout();
      setMode("signin");
      setName("");
      setPassword("");
      setErrors({});
      setFormError("");
      toast("Signed out", "default");
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthenticated = auth.isAuthenticated && !!auth.user;
  const displayName = auth.user?.name || auth.user?.email || "Guest";
  const initials =
    displayName
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "JS";
  const upcoming = bookings.filter((b) => b.status === "upcoming").length;
  const isSignup = mode === "signup";

  if (auth.isLoading) {
    return (
      <div className="container-page pb-16 pt-8 sm:pt-12">
        <span className="eyebrow">Your account</span>
        <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
          Checking your session…
        </h1>
        <div className="mt-8 rounded-xl border border-line bg-white p-7 shadow-card">
          <div className="h-4 w-40 animate-pulse rounded bg-line/70" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded bg-line/60" />
          <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-line/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page pb-16 pt-8 sm:pt-12">
      <span className="eyebrow">Your account</span>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
        {isAuthenticated ? "Welcome back." : isSignup ? "Create your account." : "Sign in to JosStay."}
      </h1>
      <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
        {isAuthenticated
          ? "Manage your bookings and account details in one place."
          : isSignup
            ? "Create an account to manage bookings and check out faster."
            : "Sign in to view your bookings and manage your account."}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
          {isAuthenticated ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500 font-display text-lg font-bold text-plum-900">
                    {initials}
                  </span>
                  <div>
                    <p className="font-display text-[20px] font-bold text-ink">{displayName}</p>
                    <p className="text-[11.5px] text-muted">{auth.user?.email || ""}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="purple" className="capitalize">{auth.user?.role || "guest"}</Badge>
                      {auth.user?.emailVerified ? (
                        <Badge tone="green">Email verified</Badge>
                      ) : (
                        <Badge tone="amber">Email not verified</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={signOut} loading={submitting}>Sign out</Button>
              </div>

              {!auth.user?.emailVerified && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
                  <p className="font-semibold">Verify your email address</p>
                  <p className="mt-1 text-amber-800">
                    We sent a verification link when you created your account. Check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    className="mt-2 font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4 disabled:opacity-60"
                    disabled={submitting}
                    onClick={async () => {
                      if (submitting) return;
                      setSubmitting(true);
                      try {
                        await auth.requestEmailVerification(auth.user.email);
                        toast("If your account needs verification, we sent a new link.", "success");
                      } catch (error) {
                        const message = getErrorMessage(error, "Could not send verification email");
                        toast(message, "error");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    Resend verification email
                  </button>
                </div>
              )}

              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {[
                  { label: "Upcoming stays", value: upcoming },
                  { label: "Bookings in view", value: bookings.length },
                  { label: "Currency", value: "NGN / USD" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-line bg-canvas px-3.5 py-3">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-muted">{stat.label}</p>
                    <p className="mt-1 font-display text-[18px] font-bold text-ink">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 divide-y divide-line border-t border-line">
                {shortcuts.map((item) => (
                  <Link key={item.href} href={item.href} className="group flex items-center gap-3.5 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700">
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">{item.title}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">{item.text}</span>
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-plum-700" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <form onSubmit={submit} className="space-y-3.5">
                {googleClientId ? (
                  <div className="space-y-2">
                    <div ref={googleButtonRef} className="min-h-[44px] flex justify-center" />
                    {!googleReady && !googleError && (
                      <p className="text-center text-[11px] text-muted">Loading Google sign-in…</p>
                    )}
                    {googleError && (
                      <p className="text-center text-[11px] text-red-600">{googleError}</p>
                    )}
                    <div className="my-2 flex items-center gap-3">
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">or use email</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  </div>
                ) : null}

                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700" role="alert">
                    {formError}
                  </div>
                )}

                {isSignup && (
                  <label className="block">
                    <span className="label">Full name</span>
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((er) => ({ ...er, name: undefined }));
                      }}
                      className={`field ${errors.name ? "!border-red-400" : ""}`}
                      placeholder="Grace Pam"
                      autoComplete="name"
                    />
                    {errors.name && <span className="mt-1 block text-[11px] text-red-600">{errors.name}</span>}
                  </label>
                )}

                <label className="block">
                  <span className="label">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((er) => ({ ...er, email: undefined }));
                    }}
                    className={`field ${errors.email ? "!border-red-400" : ""}`}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {errors.email && <span className="mt-1 block text-[11px] text-red-600">{errors.email}</span>}
                </label>

                <PasswordField
                  label="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((er) => ({ ...er, password: undefined }));
                  }}
                  error={errors.password}
                  hint={isSignup ? `At least ${SIGNUP_MIN_PASSWORD_LENGTH} characters.` : undefined}
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? SIGNUP_MIN_PASSWORD_LENGTH : undefined}
                  maxLength={72}
                />

                {!isSignup && (
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-[11.5px] font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

                <Button type="submit" full size="lg" loading={submitting}>
                  {isSignup ? "Create account" : "Sign in"}
                </Button>
              </form>

              <p className="mt-4 text-center text-[11px] text-muted">
                {isSignup ? (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New to JosStay?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">
                      Create an account
                    </button>
                  </>
                )}
              </p>

              <p className="mt-2 text-center text-[11px] text-muted">
                Want to list a place?{" "}
                <Link href="/host" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">
                  Create a host account
                </Link>
              </p>

              <div className="mt-6 rounded-lg bg-cream px-3.5 py-3 text-[11px] leading-relaxed text-ink/75">
                <strong className="font-semibold text-ink">Secure sign-in:</strong> your account is protected by the JosStay API using encrypted passwords and token-based sessions.
              </div>
            </>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-[12px] font-bold text-ink">
              <Icon name="shield" className="h-4 w-4 text-plum-700" />Why an account helps
            </p>
            <ul className="mt-3 space-y-2.5 text-[11.5px] text-muted">
              {["Manage bookings and receipts", "Save details for faster checkout", "Access guest and host tools", "Get support for your stays"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.4} />{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-plum-800 p-5 text-white">
            <p className="font-display text-[18px] font-bold leading-snug">Have a place in Jos?</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/70">List your property on JosStay and reach guests looking for trusted stays.</p>
            <Link href="/host" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-gold-500 px-4 text-[12.5px] font-bold text-ink transition hover:bg-gold-400">
              Start hosting<Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
