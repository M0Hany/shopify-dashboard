# Shopify Dashboard

A full-stack application for managing Shopify orders with shipping integration.

## Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose (for Docker deployment)
- Git
- Redis (for local development)

## Deployment Options

### 1. Local Development

#### Backend Setup
```bash
cd backend
npm install
# Copy and configure environment variables
cp .env.example .env
# Start Redis (if not already running)
redis-server
# Start the backend
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install
# Copy and configure environment variables
cp .env.example .env.local
# Start the frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### 2. Docker Deployment

1. Make sure Docker and Docker Compose are installed
2. Configure environment files:
   - Frontend: Copy `.env.example` to `.env.docker`
   - Backend: Copy `.env.example` to `.env`
3. Run the application:
```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

#### Building on DigitalOcean (or low-memory servers)

If the build appears to freeze during `RUN npm install` / `RUN npm ci`:

1. **Use full build logs** so you can see progress and any errors:
   ```bash
   docker compose build --progress=plain --no-cache
   ```
   Or to build and start:
   ```bash
   docker compose build --progress=plain && docker compose up -d
   ```

2. **If the server runs out of memory** during install:
   - Add swap (e.g. 1–2 GB) on the droplet, or
   - Upgrade to a droplet with at least 2 GB RAM for building, or
   - In the Dockerfiles, increase `NODE_OPTIONS=--max-old-space-size=512` to `768` or `1024` only if the droplet has enough RAM.

3. The Dockerfiles are set up to use `npm ci` (faster, deterministic), show npm progress (`NPM_CONFIG_LOGLEVEL=info`), and limit Node memory to reduce OOM kills on small servers.

#### After build: "Unexpected token 'export'" or "&lt;!DOCTYPE ... is not valid JSON"

- **API returns HTML / "not valid JSON"**: The frontend build must have `VITE_API_URL` set at build time (e.g. from `.env.production`). The frontend `.dockerignore` is set so `.env.production` is **included** in the image during build; ensure that file exists and has `VITE_API_URL=https://your-api-origin` (same origin as your backend, e.g. `https://ocdcrochet.store` if the API is there).
- **"Unexpected token 'export'"**: If you serve the built frontend with **nginx** (or another static server), do **not** serve `index.html` for every request. Serve real files for `/assets/*` (and `/favicon.png`, etc.). Only use the SPA fallback (`try_files $uri $uri/ /index.html`) for routes that are not files. Otherwise the browser requests a JS chunk, gets HTML, and throws this error.

### 3. Production Deployment (Vercel + GitHub Pages)

#### Backend Deployment (Vercel)
1. Push your code to GitHub
2. Create a new project in Vercel
3. Connect your GitHub repository
4. Configure environment variables in Vercel dashboard
5. Deploy

#### Frontend Deployment (GitHub Pages)
1. Update `.env.production` with your Vercel backend URL
2. Push your code to GitHub
3. Enable GitHub Pages in repository settings
4. Configure GitHub Actions for automatic deployment

## Backend scheduled jobs (cron)

All cron times use **Africa/Cairo**. The backend starts these when the process starts; they keep running as long as the Node process is up (e.g. in Docker or PM2).

| Schedule | Job | Description |
|----------|-----|-------------|
| **Every 30 min** | Shipping status check | ShipBlu orders: check fulfillment `displayStatus`, move to fulfilled when delivered. Started from `index.ts` (`startShippingStatusChecker`). |
| **Every 30 min** | Pending orders (confirmation) | Find orders without confirmation tags and schedule WhatsApp confirmation (1h delay). In `SchedulerService` (`checkPendingOrders`). |
| **Every 6 hours** | Order status auto-move | Order lifecycle: `order_ready` → `on_hold` after 2 days without confirmation; `on_hold` → `cancelled` after 2 more days. Discord notifications. In `SchedulerService` (`runOrderStatusAutoMove`). |
| **Daily 00:00** | Daily cleanup | Placeholder (logs only). In `SchedulerService` (`dailyCleanup`). |

**Queue-based (Bull + Redis):** Order confirmation messages are queued with a 1h delay when a new pending order is found; the queue processor sends the WhatsApp message. Queue cleanup runs every 24h.

For production, ensure the backend process is long-running (e.g. one container or PM2 instance). If the process restarts, cron jobs run again from startup.

## Environment Variables

### Frontend (.env.local, .env.docker, .env.production)
```env
VITE_API_BASE_URL=<backend-url>/api
VITE_API_URL=<backend-url>
VITE_AUTH0_DOMAIN=<auth0-domain>
VITE_AUTH0_CLIENT_ID=<auth0-client-id>
VITE_AUTH0_CALLBACK_URL=<frontend-url>
```

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
# ... other variables as in .env.example
```

## Additional Notes

- For local development, make sure Redis is running
- For Docker deployment, all services (including Redis) are containerized
- For production, the backend uses Vercel's serverless functions
- Frontend environment files:
  - `.env.local`: Local development
  - `.env.docker`: Docker deployment
  - `.env.production`: GitHub Pages deployment 