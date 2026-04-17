# Deploy without building on droplet

This setup builds Docker images on GitHub Actions and runs them on the droplet with `pull + up`.

## One-time setup on droplet

```bash
ssh root@165.22.25.137
apt update && apt install -y docker.io docker-compose-plugin
systemctl enable --now docker
mkdir -p /opt/shopify-dashboard
exit
```

## One-time project sync to droplet

Run from your local machine:

```powershell
scp "C:\Users\medo_\Desktop\Shopify dashboard\docker-compose.yml" root@165.22.25.137:/opt/shopify-dashboard/
scp "C:\Users\medo_\Desktop\Shopify dashboard\backend\.env" root@165.22.25.137:/opt/shopify-dashboard/backend.env
scp "C:\Users\medo_\Desktop\Shopify dashboard\frontend\.env.production" root@165.22.25.137:/opt/shopify-dashboard/frontend.env.production
```

Then on droplet:

```bash
ssh root@165.22.25.137
cd /opt/shopify-dashboard
cp backend.env .env.backend
cp frontend.env.production .env.frontend
cat <<'EOF' > .env
BACKEND_ENV_FILE=./.env.backend
FRONTEND_ENV_FILE=./.env.frontend
EOF
```

## One-time GHCR login on droplet

Create a GitHub Personal Access Token (classic) with:
- `read:packages`

Then run:

```bash
docker login ghcr.io -u M0Hany
```

## First run on droplet

```bash
cd /opt/shopify-dashboard
docker compose pull
docker compose up -d
docker compose ps
```

## Update flow (every deployment)

1. Push code to `main` on GitHub.
2. Wait for workflow `Build and publish Docker images` to finish.
3. On droplet:

```bash
ssh root@165.22.25.137
cd /opt/shopify-dashboard
docker compose pull
docker compose up -d
docker image prune -f
```
