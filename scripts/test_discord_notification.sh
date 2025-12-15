#!/bin/bash
# Test Discord notification
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/1450059573409873950/RvYql3tRU5pkyJjsAsN2Vwe8oK9kHMtuhnflBaZReTsA_HMJgxNc1zrva5GnrulWqptR"
DISCORD_USER_ID="853296501882093598"

message="<@${DISCORD_USER_ID}> 🚨 **Test Deployment Notification**\n**Testing Discord webhook integration**\n\`\`\`\nThis is a test message from the deploy_robust.sh script.\nDeployment notifications are now configured!\n\`\`\`"

curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"content\":$(echo "$message" | jq -Rs .)}"

echo -e "\nDiscord notification sent!"
