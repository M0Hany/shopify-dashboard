FROM node:18-alpine

WORKDIR /app

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
ENV DOCKER_BUILD_LIGHT=true

# Build the project
RUN npm run build:docker

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5173

# Start the preview server
CMD ["npm", "run", "preview", "--", "--host", "--port", "5173"] 