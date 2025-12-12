#!/bin/bash
# Deploy script for manual/CI deployments on the server.
# Usage: ./scripts/deploy.sh [branch]

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/gray}"
BRANCH="${1:-main}"

echo "Starting deployment in ${REPO_DIR} (branch: ${BRANCH})"

if [ ! -d "${REPO_DIR}/.git" ]; then
  echo "Repo not found at ${REPO_DIR}. Set REPO_DIR or clone first."
  exit 1
fi

cd "${REPO_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Neither docker compose nor docker-compose is available."
  exit 1
fi

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "Building and restarting services..."
${COMPOSE_CMD} -f docker-compose.yml up -d --build --remove-orphans

echo "Cleaning up old images..."
docker image prune -f

echo "Deploy complete. Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
