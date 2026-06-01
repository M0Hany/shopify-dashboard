# WhatsApp Web (order confirmation automation)

Automated **order confirmed** messages are sent through your normal **WhatsApp Business** app number using [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web protocol). This replaces WABA for that single flow only.

## Setup

1. **Backend `.env`**

   ```env
   WHATSAPP_WEB_ENABLED=true
   WHATSAPP_WEB_AUTH_DIR=data/whatsapp-web-auth
   # Optional in production:
   WHATSAPP_WEB_ADMIN_SECRET=choose-a-long-random-string
   ```

2. **Frontend `.env`** (only if you set `WHATSAPP_WEB_ADMIN_SECRET`)

   ```env
   VITE_WHATSAPP_WEB_ADMIN_SECRET=same-as-backend
   ```

3. Restart the backend.

4. Open the dashboard → **WhatsApp** → **Message templates** → **Link account**, or go to `/whatsapp/connect`.

5. On your phone: **WhatsApp Business** → **Linked devices** → **Link a device** → scan the QR code.

6. Ensure a template with key `order_confirmed` exists (or the built-in default text is used).

## Behaviour

- New pending orders still queue a confirmation job with a **1 hour** delay (unchanged).
- The job sends a **plain text** message (not a Meta template) from your linked number.
- On success, the `confirmation_sent` Shopify tag is added (unchanged).
- **Order ready**, inbox, and other WABA features are unchanged unless you disable WABA env vars separately.

## Production notes

- Mount a **persistent volume** for `WHATSAPP_WEB_AUTH_DIR` so you do not rescan QR after every deploy.
- If the session drops, open **Link account** again and scan QR.
- Unofficial automation may violate WhatsApp terms; keep volume low and monitor for blocks.

## WABA (Meta Cloud API)

Set `WHATSAPP_WABA_ENABLED=true` only if you still want the old API inbox and webhooks. Default is `false`; the dashboard **Messaging hub** uses templates + `wa.me` + optional WhatsApp Web send.

## Disable WhatsApp Web

Set `WHATSAPP_WEB_ENABLED=false`. Order confirmations then require `WHATSAPP_WABA_ENABLED=true` or manual messages from the hub.
