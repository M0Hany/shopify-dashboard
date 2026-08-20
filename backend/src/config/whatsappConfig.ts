function envFlag(name: string, defaultValue = false): boolean {
  const raw = (process.env[name] ?? (defaultValue ? 'true' : 'false'))
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '');
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Meta Cloud API (WABA) — inbox webhooks, templates API, order-ready automation. */
export function isWabaEnabled(): boolean {
  return envFlag('WHATSAPP_WABA_ENABLED', false);
}

/** Baileys / WhatsApp Web — automated order-confirmed + optional send from dashboard. Default off for serverless. */
export function isWhatsAppWebEnabled(): boolean {
  return envFlag('WHATSAPP_WEB_ENABLED', false);
}

/** Baileys cannot run on Vercel serverless (ESM + persistent session). */
export function canRunWhatsAppWeb(): boolean {
  return isWhatsAppWebEnabled() && process.env.VERCEL !== '1';
}
