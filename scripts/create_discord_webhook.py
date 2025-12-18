#!/usr/bin/env python3
"""
Create a Discord webhook for deployment notifications.
Usage: python create_discord_webhook.py
"""
import os
import sys
import argparse

import requests

# Configuration from environment
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
CHANNEL_ID = os.getenv("DISCORD_CHANNEL_ID", "1424229003593515090")  # The channel to send notifications to

def _mask_webhook_url(url: str) -> str:
    if not url:
        return url
    parts = url.split("/")
    if len(parts) < 2:
        return "***"
    # Keep the ID, mask the token.
    parts[-1] = "***"
    return "/".join(parts)


def create_webhook(*, reveal: bool) -> str | None:
    """Create a Discord webhook for the specified channel."""
    if not DISCORD_TOKEN:
        print("Missing DISCORD_TOKEN; set it in your environment before running this script.", file=sys.stderr)
        return None

    url = f'https://discord.com/api/v10/channels/{CHANNEL_ID}/webhooks'
    headers = {
        'Authorization': f'Bot {DISCORD_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {
        'name': 'Gray Deploy Bot',
    }
    
    print(f"Creating webhook for channel {CHANNEL_ID}...")
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code in (200, 201):
        webhook_data = response.json()
        webhook_url = f"https://discord.com/api/webhooks/{webhook_data['id']}/{webhook_data['token']}"
        print(f"\n✅ Webhook created successfully!")
        if reveal:
            print("\nWebhook URL:")
            print(webhook_url)
            print("\nAdd this to your .env file:")
            print(f"DISCORD_WEBHOOK_URL={webhook_url}")
        else:
            print("\nWebhook URL (masked):")
            print(_mask_webhook_url(webhook_url))
            print("\nTo print the full URL, rerun with --reveal (avoid terminals/logs you don't trust).")
        print("DISCORD_USER_ID=your-discord-user-id")
        return webhook_url
    else:
        print(f"❌ Failed to create webhook: {response.status_code}")
        print(f"Response: {response.text}")
        return None
	
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Create a Discord webhook for Gray deploy notifications.")
    parser.add_argument(
        "--reveal",
        action="store_true",
        help="Print the full webhook URL (sensitive). By default it is masked.",
    )
    args = parser.parse_args()
    create_webhook(reveal=bool(args.reveal))
