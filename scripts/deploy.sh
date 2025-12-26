#!/bin/bash
# Deploy script for manual/CI deployments on the server.
# Usage: ./scripts/deploy.sh [branch]

set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/gray/repo}"
BRANCH="${1:-main}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
DISCORD_USER_ID="${DISCORD_USER_ID:-853296501882093598}"
DISCORD_NOTIFY_SUCCESS_PING="${DISCORD_NOTIFY_SUCCESS_PING:-false}"

echo "Starting deployment in ${REPO_DIR} (branch: ${BRANCH})"

load_discord_env() {
  if [[ -z "${DISCORD_WEBHOOK_URL:-}" && -f "${REPO_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${REPO_DIR}/.env"
    set +a
  fi
}

send_success_notification() {
  local body="$1"

  if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
    return 0
  fi

  local mention_prefix=""
  if [[ "${DISCORD_NOTIFY_SUCCESS_PING}" == "true" && -n "${DISCORD_USER_ID:-}" ]]; then
    mention_prefix="<@${DISCORD_USER_ID}> "
  fi

  local discord_message="${mention_prefix}✅ **Deployment Successful**\n\`\`\`$body\`\`\`"

  if curl -sf -X POST "${DISCORD_WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"content\":$(echo "${discord_message}" | jq -Rs .)}" >/dev/null; then
    echo "Discord notification sent."
  else
    echo "Discord notification failed."
  fi
}

if [ ! -d "${REPO_DIR}/.git" ]; then
  echo "Repo not found at ${REPO_DIR}. Set REPO_DIR or clone first."
  exit 1
fi

cd "${REPO_DIR}"
load_discord_env

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

current_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
success_body="Branch: ${BRANCH}
Commit: ${current_commit}
Host: $(hostname)
Time: $(date)"
send_success_notification "${success_body}"
