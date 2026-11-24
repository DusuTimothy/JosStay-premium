-- Paystack processing-fee pass-through.
--
-- bookings.total remains the stay amount (nightly + cleaning + extras - discounts).
-- bookings.payment_fee is the guest-borne provider fee, charged in addition to
-- the stay amount. The charged amount is total + payment_fee.
--
-- payment_fee is pass-through: it is not host gross, not commissionable, and not
-- platform revenue. Refunds return the full charged amount; the platform absorbs
-- Paystack's fee on refunds.

alter table public.bookings
  add column if not exists payment_fee integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_payment_fee_nonnegative'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_payment_fee_nonnegative check (payment_fee >= 0);
  end if;
end
$$;

comment on column public.bookings.payment_fee is
  'Guest-borne Paystack processing fee in naira. Charged in addition to total; pass-through, not commissionable.';
