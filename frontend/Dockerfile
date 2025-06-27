FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Build the project
RUN npm run build

# Expose port
EXPOSE 5173

# Start the preview server
CMD ["npm", "run", "preview", "--", "--host", "--port", "5173"] 