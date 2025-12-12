#!/bin/bash
# Deploy script for manual deployments on the server.
# Usage: ./scripts/deploy.sh [branch]

set -e

echo "🚀 Starting deployment..."

cd /home/ubuntu/gray

BRANCH=${1:-$(git rev-parse --abbrev-ref HEAD)}

# Pull latest code for the selected branch
git pull origin "$BRANCH"

# Build and restart services
echo "🔄 Building and restarting services..."
docker compose -f docker-compose.yml up -d --build --remove-orphans

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

# Show running containers
echo ""
echo "✅ Deploy complete! Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
