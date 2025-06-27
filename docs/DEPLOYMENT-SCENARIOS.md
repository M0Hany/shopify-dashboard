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