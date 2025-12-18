#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -z "${DISCORD_WEBHOOK_URL:-}" && -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${REPO_ROOT}/.env"
  set +a
fi

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  echo "Missing DISCORD_WEBHOOK_URL (set it in env or ${REPO_ROOT}/.env)" >&2
  exit 1
fi

DISCORD_USER_ID="${DISCORD_USER_ID:-}"
mention_prefix=""
if [[ -n "${DISCORD_USER_ID}" ]]; then
  mention_prefix="<@${DISCORD_USER_ID}> "
fi

message="${mention_prefix}🚨 **Test Deployment Notification**\n**Testing Discord webhook integration**\n\`\`\`\nThis is a test message from the deploy_robust.sh script.\nDeployment notifications are now configured!\n\`\`\`"

curl -sf -X POST "${DISCORD_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "{\"content\":$(echo "${message}" | jq -Rs .)}"

echo -e "\nDiscord notification sent!"
