# Server Setup Guide

One-time setup for a new VPS server.

## Prerequisites

- Ubuntu 22.04+ (or similar Debian-based distro)
- SSH access with sudo privileges
- Domain pointing to server IP

## 1. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (logout/login after)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

## 2. Clone the Repository

```bash
cd /home/ubuntu
git clone git@github.com:YOUR_USERNAME/gray.git
cd gray
```

## 3. Set Up Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
nano .env
```

## 4. Create Data Directories

```bash
mkdir -p /home/ubuntu/gray/data
mkdir -p /home/ubuntu/gray/redis_data
mkdir -p /home/ubuntu/gray/backend/media_uploads
```

## 5. Set Up GitHub Actions Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions, and add:

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Your server IP or domain |
| `SERVER_USER` | SSH username (e.g., `ubuntu`) |
| `SERVER_SSH_KEY` | Private SSH key for deployment |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_URL` | API URL (e.g., `https://gray.alignment.id/api/backend`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile key |

### Generate SSH Key for GitHub Actions

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/github_deploy.pub ubuntu@YOUR_SERVER_IP

# The private key (~/.ssh/github_deploy) goes into SERVER_SSH_KEY secret
cat ~/.ssh/github_deploy
```

## 6. Configure Nginx

```bash
# Copy nginx config
sudo cp infra/nginx/gray.alignment.id.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/gray.alignment.id.conf /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Set Up SSL with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d gray.alignment.id

# Auto-renewal is set up automatically
```

## 8. First Deploy

```bash
cd /home/ubuntu/gray

# Build and start containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check status
docker ps
docker compose logs -f
```

## Useful Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# Restart a service
docker compose restart backend

# Stop everything
docker compose down

# Full rebuild
docker compose down
docker compose up -d --build

# Check disk space used by Docker
docker system df
```

## Troubleshooting

### Containers not starting?
```bash
docker compose logs backend
```

### Database issues?
```bash
# Check if volume is mounted correctly
docker compose exec backend ls -la /app/data
```

### Nginx 502 Bad Gateway?
```bash
# Check if containers are running
docker ps

# Check container health
docker compose logs frontend
```
