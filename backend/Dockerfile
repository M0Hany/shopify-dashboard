FROM node:18-alpine

WORKDIR /app

# Skip Puppeteer Chrome download to save space (we use WhatsApp Business API, not whatsapp-web.js)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Reduce memory use during install (helps on small DO droplets; adjust if you have more RAM)
ENV NODE_OPTIONS=--max-old-space-size=512
# Show npm progress so build doesn't appear frozen
ENV NPM_CONFIG_LOGLEVEL=info
# Fewer parallel network requests = less memory spike
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# Install dependencies first (better caching); npm ci is faster and more reliable than npm install
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set correct ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application with proper NODE_ENV
ENV NODE_ENV=production
CMD ["npm", "run", "start:prod"] 