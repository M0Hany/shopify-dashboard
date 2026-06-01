/** Egypt-focused phone normalization for WhatsApp (digits only, 12 chars max). */
export function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\D/g, '');

  if (formatted.startsWith('201')) {
    formatted = formatted.substring(0, 12);
  } else if (formatted.startsWith('20')) {
    formatted = '201' + formatted.substring(2);
    formatted = formatted.substring(0, 12);
  } else if (formatted.startsWith('01')) {
    formatted = '2' + formatted;
    formatted = formatted.substring(0, 12);
  } else if (formatted.startsWith('1')) {
    formatted = '20' + formatted;
    formatted = formatted.substring(0, 12);
  } else {
    formatted = '201' + formatted;
    formatted = formatted.substring(0, 12);
  }

  return formatted;
}

export function phoneToWhatsAppJid(phone: string): string {
  return `${formatPhoneNumber(phone)}@s.whatsapp.net`;
}
