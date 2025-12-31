# Discord Interactions Endpoint Verification Troubleshooting

## Common Issues and Solutions

### 1. "The specified interactions endpoint url could not be verified"

This error occurs when Discord cannot verify your endpoint. Here are the most common causes:

#### Issue: Missing or Incorrect DISCORD_PUBLIC_KEY

**Solution:**
1. Go to Discord Developer Portal → Your Application → General Information
2. Copy the **Public Key** (64-character hex string)
3. Set it in your `.env` file:
   ```
   DISCORD_PUBLIC_KEY=your-64-character-hex-string-here
   ```
4. Restart your backend server

#### Issue: Reverse Proxy (Nginx) Modifying Request

If you're using Nginx as a reverse proxy, you need to ensure it forwards the raw body and headers correctly.

**Nginx Configuration:**
```nginx
location /api/discord/interactions {
    proxy_pass http://localhost:YOUR_PORT;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # CRITICAL: Preserve raw body for Discord signature verification
    proxy_set_header Content-Type $content_type;
    proxy_pass_request_headers on;
    
    # Don't buffer the request body
    proxy_request_buffering off;
    client_max_body_size 1M;
}
```

#### Issue: SSL/HTTPS Certificate Problems

Discord requires HTTPS. Ensure:
- Your SSL certificate is valid
- The endpoint is accessible via HTTPS
- No certificate errors

#### Issue: Firewall Blocking Discord IPs

Discord's verification requests come from specific IP ranges. Ensure your firewall allows:
- Discord's IP ranges (check Discord's documentation)
- Or allow all HTTPS traffic on port 443

### 2. Testing the Endpoint Manually

Test if your endpoint responds correctly:

```bash
# Test PING (Discord verification)
curl -X POST https://ocdcrochet.store/api/discord/interactions \
  -H "Content-Type: application/json" \
  -H "X-Signature-Ed25519: test" \
  -H "X-Signature-Timestamp: 1234567890" \
  -d '{"type":1}'
```

**Expected Response:**
- Status: 401 (because signature is invalid, but endpoint is reachable)
- OR Status: 200 with `{"type":1}` if signature verification is bypassed in dev

### 3. Check Server Logs

When Discord tries to verify, check your server logs for:
- "Discord interaction received" - endpoint is reachable
- "Discord PING received" - PING was received
- "Discord signature verification failed" - signature issue
- "Missing Discord signature headers" - headers not forwarded correctly

### 4. Verification Process

Discord's verification process:
1. Sends a POST request to your endpoint with `type: 1` (PING)
2. Includes signature headers: `X-Signature-Ed25519` and `X-Signature-Timestamp`
3. Expects response: `{"type": 1}` (PONG) with status 200
4. Verifies the signature matches

### 5. Common Mistakes

- ❌ Setting endpoint URL without `https://`
- ❌ Missing trailing slash or extra path
- ❌ DISCORD_PUBLIC_KEY not set in production environment
- ❌ Reverse proxy stripping headers or modifying body
- ❌ Endpoint returning wrong status code
- ❌ Endpoint not responding within Discord's timeout (3 seconds)

### 6. Step-by-Step Verification

1. **Verify Environment Variable:**
   ```bash
   # On your server
   echo $DISCORD_PUBLIC_KEY
   # Should output your 64-character hex string
   ```

2. **Check Endpoint Accessibility:**
   ```bash
   curl -I https://ocdcrochet.store/api/discord/interactions
   # Should return 405 (Method Not Allowed) or 401, not 404
   ```

3. **Check Server Logs:**
   When you click "Save Changes" in Discord Developer Portal, check your logs for incoming requests.

4. **Verify Route Registration:**
   Ensure the route is registered BEFORE `express.json()` middleware in `backend/src/index.ts`:
   ```typescript
   // CORRECT ORDER:
   app.use('/api/discord', discordInteractions); // BEFORE json()
   app.use(express.json()); // AFTER discord route
   ```

### 7. Still Not Working?

If verification still fails:
1. Check server logs for detailed error messages
2. Verify the endpoint URL is exactly: `https://ocdcrochet.store/api/discord/interactions`
3. Ensure your backend is running and accessible
4. Try temporarily disabling signature verification (development only) to test if endpoint works
5. Contact Discord support if all else fails

