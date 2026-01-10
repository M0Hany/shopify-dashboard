# Discord Bot Setup Guide

This guide explains how to set up Discord buttons for quick WhatsApp replies.

## 1. FRONTEND_URL Configuration

**FRONTEND_URL** is the URL where your frontend dashboard is accessible. This is used to create deep links for the "Open Chat" button.

### For Local Development:
```env
FRONTEND_URL=http://localhost:5173
```

### For Production:
```env
FRONTEND_URL=https://ocdcrochet.store
```

### For Local Testing with ngrok:
```env
FRONTEND_URL=https://your-ngrok-url.ngrok.io
```

**How to find your FRONTEND_URL:**
- **Local**: Usually `http://localhost:5173` (check your frontend dev server)
- **Production**: Your actual domain where the dashboard is hosted (e.g., `https://ocdcrochet.store`)
- **ngrok**: The URL provided by ngrok (e.g., `https://abc123.ngrok.io`)

## 2. Discord Interaction Endpoint Setup

### For Local Testing with ngrok:

1. **Install ngrok** (if not already installed):
   ```bash
   # Download from https://ngrok.com/download
   # Or install via package manager
   ```

2. **Start your backend server**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Start ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```
   This will give you a URL like: `https://abc123.ngrok.io`

4. **Update your .env file**:
   ```env
   FRONTEND_URL=https://abc123.ngrok.io
   ```

5. **Set Discord Interaction Endpoint**:
   - Go to https://discord.com/developers/applications
   - Select your bot application
   - Go to **Interactions** > **Interaction Endpoint URL**
   - Enter: `https://abc123.ngrok.io/api/discord/interactions`
   - Click **Save Changes**
   - Discord will verify the endpoint (it should show a green checkmark)

6. **Test the setup**:
   - Send a WhatsApp message (or trigger a notification)
   - Check Discord for the notification with buttons
   - Click "Quick Reply" button - it should open a modal

### For Production:

1. **Update your .env file**:
   ```env
   FRONTEND_URL=https://ocdcrochet.store
   ```

2. **Set Discord Interaction Endpoint**:
   - Go to https://discord.com/developers/applications
   - Select your bot application
   - Go to **Interactions** > **Interaction Endpoint URL**
   - Enter: `https://ocdcrochet.store/api/discord/interactions`
   - Click **Save Changes**
   - Discord will verify the endpoint

## 3. Environment Variables

Make sure your `.env` file has:

```env
# Discord Configuration
DISCORD_WEBHOOK_URL=your-discord-webhook-url
DISCORD_WHATSAPP_WEBHOOK_URL=your-discord-whatsapp-webhook-url
DISCORD_PUBLIC_KEY=1876a685ec35ebd67c19381d5d05fb3a941a861a949c504e5c9657c2cdf65bf3

# Frontend URL (for deep links)
# Local: http://localhost:5173
# ngrok: https://your-ngrok-url.ngrok.io
# Production: https://ocdcrochet.store
FRONTEND_URL=http://localhost:5173
```

## 4. How It Works

### Open Chat Button (Works Immediately)
- Uses a URL link (no bot required)
- Opens the WhatsApp chat in your dashboard
- Deep link format: `/#/whatsapp?phone=PHONE_NUMBER`

### Quick Reply Button (Requires Bot Setup)
- Requires Discord bot and interaction endpoint
- Opens a modal in Discord to type a reply
- Sends the message directly via WhatsApp API

## 5. Troubleshooting

### "Interaction endpoint verification failed"
- Make sure your backend is running
- Check that ngrok is running (for local testing)
- Verify the URL in Discord matches your ngrok/production URL
- Check backend logs for errors

### "Invalid signature" error
- Verify `DISCORD_PUBLIC_KEY` is correct in `.env`
- Make sure the public key matches your bot's public key in Discord Developer Portal

### Buttons not appearing
- Check that the webhook message includes `components` field
- Verify Discord webhook URL is correct
- Check backend logs for notification sending errors

### Modal not opening
- Verify interaction endpoint is set correctly in Discord
- Check that your bot is added to the Discord server
- Verify the endpoint URL is accessible (test with curl or browser)

## 6. Testing Checklist

- [ ] Backend server is running
- [ ] ngrok is running (for local testing) or production URL is accessible
- [ ] `.env` has correct `DISCORD_PUBLIC_KEY`
- [ ] `.env` has correct `FRONTEND_URL`
- [ ] Discord Interaction Endpoint URL is set and verified
- [ ] Bot is added to your Discord server
- [ ] Send a test WhatsApp message
- [ ] Check Discord for notification with buttons
- [ ] Test "Open Chat" button (should open dashboard)
- [ ] Test "Quick Reply" button (should open modal)
- [ ] Send a reply via modal (should send WhatsApp message)

## 7. Switching Between Local and Production

When switching between local testing and production:

1. **Update `.env` file**:
   - Local: `FRONTEND_URL=http://localhost:5173`
   - Production: `FRONTEND_URL=https://ocdcrochet.store`

2. **Update Discord Interaction Endpoint**:
   - Local: `https://your-ngrok-url.ngrok.io/api/discord/interactions`
   - Production: `https://ocdcrochet.store/api/discord/interactions`

3. **Restart your backend server** after changing `.env`

**Note**: You can have different Discord bot applications for development and production, or use the same one and just change the interaction endpoint URL.









