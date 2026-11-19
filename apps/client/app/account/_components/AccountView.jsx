"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { useBooking, useToast } from "@/components/providers";

const SIGNUP_MIN_PASSWORD_LENGTH = 12;

const shortcuts = [
  { href: "/bookings", icon: "calendar", title: "My bookings", text: "View, cancel or rebook a stay in Jos." },
  { href: "/host/dashboard", icon: "home", title: "Host dashboard", text: "Manage listings, calendar and payouts." },
  { href: "/bundle", icon: "plane", title: "Flight + stay", text: "Bundle a flight with your accommodation." },
  { href: "/help", icon: "whatsapp", title: "Help centre", text: "Answers, policies and WhatsApp support." },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.7h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}

export function AccountView() {
  const { bookings } = useBooking();
  const { toast } = useToast();
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    try {
      setSignedIn(window.localStorage.getItem("josstay-account") === "demo");
      setAccountName(window.localStorage.getItem("josstay-account-name") || "");
      setEmail(window.localStorage.getItem("josstay-account-email") || "");
    } catch {}
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrors({});
  };

  const signIn = (provider) => {
    if (provider === "email") {
      const next = {};
      if (mode === "signup" && name.trim().length < 2) {
        next.name = "Enter your full name";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
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
      if (Object.keys(next).length) return;

      const displayName = name.trim() || email.trim().split("@")[0];
      try {
        window.localStorage.setItem("josstay-account", "demo");
        window.localStorage.setItem("josstay-account-email", email.trim());
        window.localStorage.setItem("josstay-account-name", displayName);
      } catch {}
      setAccountName(displayName);
      setSignedIn(true);
      toast(
        mode === "signup"
          ? "Account created. Welcome to JosStay (demo)."
          : "Signed in to your JosStay account (demo)",
        "success",
      );
      return;
    }

    try {
      window.localStorage.setItem("josstay-account", "demo");
    } catch {}
    setSignedIn(true);
    toast("Signed in with Google (demo)", "success");
  };

  const signOut = () => {
    try {
      window.localStorage.removeItem("josstay-account");
      window.localStorage.removeItem("josstay-account-email");
      window.localStorage.removeItem("josstay-account-name");
    } catch {}
    setSignedIn(false);
    setMode("signin");
    setName("");
    setAccountName("");
    setEmail("");
    setPassword("");
    setErrors({});
    toast("Signed out", "default");
  };

  const upcoming = bookings.filter((b) => b.status === "upcoming").length;
  const displayName = accountName || "Demo Guest";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DA";
  const isSignup = mode === "signup";

  return (
    <div className="container-page pb-16 pt-8 sm:pt-12">
      <span className="eyebrow">Your account</span>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">
        {signedIn ? "Welcome back." : isSignup ? "Create your account." : "Sign in to JosStay."}
      </h1>
      <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
        {isSignup
          ? "Save your bookings, keep your favourite stays and check out faster next time. This is a demo account stored only in your browser."
          : "Keep your bookings, saved stays and host tools in one place. This is a demo account — no password is stored and no real sign-in happens."}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
          {signedIn ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500 font-display text-lg font-bold text-plum-900">{initials}</span>
                  <div>
                    <p className="font-display text-[20px] font-bold text-ink">{displayName}</p>
                    <p className="text-[11.5px] text-muted">{email || "demo.guest@josstay.ng"}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone="purple">Guest</Badge><Badge tone="verified" icon="shield">Verified email</Badge></div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
              </div>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {[{ label: "Upcoming stays", value: upcoming }, { label: "Total bookings", value: bookings.length }, { label: "Currency", value: "NGN / USD" }].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-line bg-canvas px-3.5 py-3">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-muted">{stat.label}</p>
                    <p className="mt-1 font-display text-[18px] font-bold text-ink">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 divide-y divide-line border-t border-line">
                {shortcuts.map((item) => (
                  <Link key={item.href} href={item.href} className="group flex items-center gap-3.5 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon name={item.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-ink">{item.title}</span><span className="mt-0.5 block text-[11.5px] text-muted">{item.text}</span></span>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-plum-700" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => signIn("google")} className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white text-[13.5px] font-semibold text-ink transition hover:border-plum-300 hover:bg-canvas"><GoogleMark />Continue with Google</button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">or use email</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); signIn("email"); }} className="space-y-3.5">
                {isSignup && (
                  <label className="block">
                    <span className="label">Full name</span>
                    <input
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: undefined })); }}
                      className={`field ${errors.name ? "!border-red-400" : ""}`}
                      placeholder="Grace Pam"
                      autoComplete="name"
                    />
                    {errors.name && <span className="mt-1 block text-[11px] text-red-600">{errors.name}</span>}
                  </label>
                )}

                <label className="block">
                  <span className="label">Email address</span>
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: undefined })); }} className={`field ${errors.email ? "!border-red-400" : ""}`} placeholder="you@example.com" autoComplete="email" />
                  {errors.email && <span className="mt-1 block text-[11px] text-red-600">{errors.email}</span>}
                </label>

                <PasswordField
                  label="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: undefined })); }}
                  error={errors.password}
                  hint={isSignup ? `At least ${SIGNUP_MIN_PASSWORD_LENGTH} characters.` : undefined}
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? SIGNUP_MIN_PASSWORD_LENGTH : undefined}
                  maxLength={72}
                />

                <Button type="submit" full size="lg">{isSignup ? "Create account" : "Sign in"}</Button>
              </form>

              <p className="mt-4 text-center text-[11px] text-muted">
                {isSignup ? (
                  <>Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">Sign in</button>
                  </>
                ) : (
                  <>New to JosStay?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">Create an account</button>
                  </>
                )}
              </p>

              <p className="mt-2 text-center text-[11px] text-muted">Want to list a place? <Link href="/host" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">Create a host account</Link></p>

              <div className="mt-6 rounded-lg bg-cream px-3.5 py-3 text-[11px] leading-relaxed text-ink/75"><strong className="font-semibold text-ink">Demo note:</strong> this account is stored only in your browser. In production, registration and sign-in are handled by the Express API with bcrypt, JWT sessions and role-based access control.</div>
            </>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-[12px] font-bold text-ink"><Icon name="shield" className="h-4 w-4 text-plum-700" />Why an account helps</p>
            <ul className="mt-3 space-y-2.5 text-[11.5px] text-muted">
              {["Manage bookings and download receipts", "Save stays you want to revisit", "Faster checkout with saved details", "Switch between guest and host tools"].map((item) => (
                <li key={item} className="flex items-start gap-2"><Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.4} />{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-plum-800 p-5 text-white">
            <p className="font-display text-[18px] font-bold leading-snug">Have a place in Jos?</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/70">List it on JosStay and earn from every night. Verification and payouts handled for you.</p>
            <Link href="/host" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-gold-500 px-4 text-[12.5px] font-bold text-ink transition hover:bg-gold-400">Start hosting<Icon name="arrowRight" className="h-3.5 w-3.5" /></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
