export function normalizeNgPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = "+" + digits.slice(1).replace(/\D/g, "");
  else digits = digits.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("+234")) return "+234" + digits.slice(4).replace(/\D/g, "");
  if (digits.startsWith("234")) return "+234" + digits.slice(3);
  if (digits.startsWith("0")) return "+234" + digits.slice(1);
  if (/^[789]\d{9}$/.test(digits)) return "+234" + digits;

  if (digits.startsWith("+")) return digits;
  return digits;
}

export function isValidNgPhone(value) {
  const normalized = normalizeNgPhone(value);
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
