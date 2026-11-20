"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AREAS, PROPERTY_TYPES } from "@josstay/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { useAuth, useCurrency, useToast } from "@/components/providers";
import { api } from "@/lib/api";

const SIGNUP_MIN_PASSWORD_LENGTH = 8;

const benefits = [
  { icon: "wallet", title: "Earn from every night", text: "Set your own prices and get paid securely through Paystack after each stay." },
  { icon: "calendar", title: "You control the calendar", text: "Block dates, adjust weekend rates, and pause your listing whenever you need." },
  { icon: "shield", title: "Verified guests", text: "Guest identities and contact details are checked before arrival." },
  { icon: "whatsapp", title: "Host support", text: "A real person on WhatsApp to help with bookings, guests and payouts." },
];

export function HostView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [form, setForm] = useState({ name: "", email: "", phone: "", type: "apartment", area: "Rayfield" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(65000);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      setForm((current) => ({
        ...current,
        name: current.name || auth.user.name || "",
        email: current.email || auth.user.email || "",
      }));
    }
  }, [auth.isAuthenticated, auth.user]);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && auth.user?.role === "host") {
      router.replace("/host/dashboard");
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, router]);

  const estimate = Math.round(rate * 30 * 0.7 * 0.9);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const next = {};
    if (!form.name.trim()) next.name = "Enter your full name";
    if (form.phone.replace(/\D/g, "").length < 10) next.phone = "Enter a valid phone number";

    const isAuthed = auth.isAuthenticated;
    if (!isAuthed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) next.email = "Enter a valid email address";
      if (password.length < SIGNUP_MIN_PASSWORD_LENGTH) next.password = `Use at least ${SIGNUP_MIN_PASSWORD_LENGTH} characters`;
      if (confirmPassword !== password) next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setErrors({});

    try {
      if (isAuthed) {
        await api.post("/api/host/onboard", {
          name: form.name.trim(),
          phone: form.phone.trim(),
          type: form.type,
          area: form.area,
        });
        // Refresh auth/profile state so role updates are reflected.
        await auth.refresh().catch(() => {});
        toast("Host profile created. Welcome to your dashboard.", "success");
        router.push("/host/dashboard");
      } else {
        const res = await api.post("/api/host/register", {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password,
          phone: form.phone.trim(),
          type: form.type,
          area: form.area,
        });
        if (res?.data) {
          auth.setSession(res.data);
        } else {
          await auth.refresh().catch(() => {});
        }
        toast("Host account created. Welcome to your dashboard.", "success");
        router.push("/host/dashboard");
      }
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      // Local/demo fallback: if API is unavailable, keep previous demo behavior.
      if (!error?.status || error.status >= 500 || error.code === "NETWORK_ERROR" || error.code === "REQUEST_ABORTED") {
        try { window.localStorage.setItem("josstay-host-name", form.name); } catch {}
        toast("Host setup saved locally (demo fallback).", "success");
        router.push("/host/dashboard");
      } else {
        const message = error?.message || "Could not create host account";
        setErrors((current) => ({ ...current, form: message }));
        toast(message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden bg-plum-800">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, rgba(225,183,82,.45), transparent 40%), radial-gradient(circle at 15% 90%, rgba(107,63,160,.75), transparent 45%)" }} />
        <div className="container-page relative grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="max-w-xl">
            <Badge tone="gold" className="!border-gold-300/30 !bg-gold-500/15 !text-gold-300">Host with JosStay</Badge>
            <h1 className="mt-5 text-balance font-display text-[34px] font-bold leading-[1.02] tracking-tightest text-white sm:text-[42px] lg:text-[52px]">
              Your place in Jos could be someone&apos;s favourite stay.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-plum-100 sm:text-base">
              Join verified hosts earning from hotels, apartments, shortlets and guest houses across Plateau State. We bring the guests, payments and support.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-gold-300"><Icon name={benefit.icon} className="h-4 w-4" /></span>
                  <p className="mt-2 text-xs font-bold text-white">{benefit.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-plum-200">{benefit.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs font-bold text-white">Estimate your monthly income</p>
              <div className="mt-3 flex items-center justify-between text-xs text-plum-100">
                <span>Nightly rate</span>
                <span className="font-semibold text-white">{format(rate)}</span>
              </div>
              <input type="range" min={10000} max={150000} step={5000} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-2 w-full accent-gold-500" aria-label="Nightly rate" />
              <div className="mt-3 flex items-end justify-between rounded-xl bg-white/10 px-3 py-2.5">
                <span className="text-[11px] text-plum-100">At 70% occupancy, after 10% fee</span>
                <span className="font-display text-[19px] font-bold text-gold-300">{format(estimate)}<span className="text-[10px] font-normal text-plum-200"> / month</span></span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-float sm:p-6">
            <h2 className="font-display text-[24px] font-bold tracking-tightest text-ink">{auth.isAuthenticated ? "Set up your host profile" : "Become a host"}</h2>
            <p className="mt-1 text-xs text-muted">{auth.isAuthenticated ? "Complete your host details to access your dashboard." : "Create your account. Adding a listing takes about 5 minutes."}</p>

            {errors.form && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{errors.form}</p>}

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              <label className="block">
                <span className="label">Full name</span>
                <input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: undefined, form: undefined })); }} className={`field ${errors.name ? "!border-red-400" : ""}`} placeholder="Grace Pam" />
                {errors.name && <span className="mt-1 block text-[11px] text-red-600">{errors.name}</span>}
              </label>

              <label className="block">
                <span className="label">Email address</span>
                <input type="email" value={form.email} onChange={(e) => { if (!auth.isAuthenticated) { setForm((f) => ({ ...f, email: e.target.value })); setErrors((er) => ({ ...er, email: undefined, form: undefined })); } }} readOnly={auth.isAuthenticated} className={`field ${errors.email ? "!border-red-400" : ""} ${auth.isAuthenticated ? "bg-canvas text-muted" : ""}`} placeholder="grace@example.com" />
                {errors.email && <span className="mt-1 block text-[11px] text-red-600">{errors.email}</span>}
              </label>

              <label className="block">
                <span className="label">Phone number</span>
                <input type="tel" value={form.phone} onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setErrors((er) => ({ ...er, phone: undefined, form: undefined })); }} className={`field ${errors.phone ? "!border-red-400" : ""}`} placeholder="+234 800 000 0000" />
                {errors.phone && <span className="mt-1 block text-[11px] text-red-600">{errors.phone}</span>}
              </label>

              {!auth.isAuthenticated && (
                <>
                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: undefined, form: undefined })); }}
                    error={errors.password}
                    hint={`At least ${SIGNUP_MIN_PASSWORD_LENGTH} characters.`}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={SIGNUP_MIN_PASSWORD_LENGTH}
                    maxLength={72}
                  />

                  <PasswordField
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((er) => ({ ...er, confirmPassword: undefined, form: undefined })); }}
                    error={errors.confirmPassword}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    maxLength={72}
                  />
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Property type</span>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="field">
                    {PROPERTY_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Area</span>
                  <select value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} className="field">
                    {AREAS.map((area) => (<option key={area} value={area}>{area}</option>))}
                  </select>
                </label>
              </div>

              <Button full size="lg" type="submit" loading={loading} iconRight="arrowRight">{loading ? (auth.isAuthenticated ? "Saving…" : "Creating account…") : (auth.isAuthenticated ? "Continue to host dashboard" : "Create host account")}</Button>

              <p className="text-center text-[10px] leading-relaxed text-muted">By continuing you agree to host verification and the JosStay host terms.</p>
            </form>

            <div className="mt-4 border-t border-line pt-4 text-center">
              <button type="button" onClick={() => router.push("/host/dashboard")} className="text-xs font-semibold text-plum-700 underline underline-offset-4">Already a host? Go to dashboard</button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <h2 className="text-center font-display text-[26px] font-bold tracking-tightest text-ink sm:text-[32px]">How hosting works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { step: "01", title: "Create your account", text: "Tell us who you are and what you host. It takes less than two minutes." },
            { step: "02", title: "Add your listing", text: "Upload photos, set your nightly price, and submit your ID and ownership documents." },
            { step: "03", title: "Get verified & earn", text: "Once verified, your listing goes live. Guests book, you host, we handle payment." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border border-line bg-white p-5">
              <span className="font-display text-[12px] font-bold italic tracking-widest text-plum-300">{item.step}</span>
              <h3 className="mt-2 text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] text-muted">Sample host data · verification is simulated in this demo.</p>
      </section>
    </div>
  );
}
