#!/bin/bash
# Deploy script for manual deployments
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

cd /home/ubuntu/gray

# Pull latest code
git pull origin main

# Pull latest Docker images
echo "📦 Pulling latest images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Restart services
echo "🔄 Restarting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

# Show running containers
echo ""
echo "✅ Deploy complete! Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
