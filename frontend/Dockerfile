# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and environment files
COPY . .
COPY .env.docker .env.production

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Create a non-root user first
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files and install dependencies including Vite
COPY package*.json ./
COPY vite.config.ts ./
RUN npm install

# Copy the build from builder stage
COPY --from=builder /app/dist ./dist

# Set correct ownership and permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5173

# Start the application
ENV NODE_ENV=production
CMD ["npx", "vite", "preview", "--port", "5173", "--host"] 