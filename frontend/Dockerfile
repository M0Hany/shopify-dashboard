FROM node:18-alpine

WORKDIR /app

# Reduce memory use during install (helps on small DO droplets; adjust if you have more RAM)
ENV NODE_OPTIONS=--max-old-space-size=512
# Show npm progress so build doesn't appear frozen
ENV NPM_CONFIG_LOGLEVEL=info
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# Install dependencies first (better caching); npm ci is faster and more reliable than npm install
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Build the project
RUN npm run build

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set correct ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5173

# Start the preview server
CMD ["npm", "run", "preview", "--", "--host", "--port", "5173"] 