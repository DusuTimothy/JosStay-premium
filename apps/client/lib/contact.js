const digits = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER || "2348000000000").replace(/[^\d]/g, "");

export const SUPPORT_WHATSAPP_NUMBER = digits || "2348000000000";
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
export const SUPPORT_TEL_URL = `tel:+${SUPPORT_WHATSAPP_NUMBER}`;
export const SUPPORT_PHONE_DISPLAY = `+${SUPPORT_WHATSAPP_NUMBER}`;

export function supportWhatsAppUrl(message) {
  if (!message) return SUPPORT_WHATSAPP_URL;
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
