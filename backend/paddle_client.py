import os
import logging
import httpx
import hashlib
import hmac
from typing import Dict, Any, Optional

logger = logging.getLogger("backend.paddle_client")

class PaddleClient:
    def __init__(self):
        # Default to sandbox if not specified
        self.is_sandbox = os.getenv("PADDLE_SANDBOX", "true").lower() == "true"
        self.api_key = os.getenv("PADDLE_API_KEY")
        self.base_url = "https://sandbox-api.paddle.com" if self.is_sandbox else "https://api.paddle.com"
        
        if not self.api_key:
            logger.warning("PADDLE_API_KEY not set. Paddle integration will be disabled or fail.")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Paddle API Key is missing. Cannot make requests.")

        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(method, url, headers=self._get_headers(), json=data)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Paddle API error: {e.response.text}")
                raise e
            except Exception as e:
                logger.error(f"Paddle connection error: {str(e)}")
                raise e

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        return await self._request("GET", f"/subscriptions/{subscription_id}")

    async def get_transaction(self, transaction_id: str) -> Dict[str, Any]:
        return await self._request("GET", f"/transactions/{transaction_id}")

    async def cancel_subscription(self, subscription_id: str, effective_from: str = "next_billing_period") -> Dict[str, Any]:
        """
        Cancel a subscription.
        effective_from: 'next_billing_period' or 'immediately'
        """
        data = {"effective_from": effective_from}
        return await self._request("POST", f"/subscriptions/{subscription_id}/cancel", data)

    async def update_subscription_items(self, subscription_id: str, items: list) -> Dict[str, Any]:
        """
        Update items (plan) of a subscription.
        items: List of dicts, e.g. [{"price_id": "...", "quantity": 1}]
        """
        data = {
            "items": items,
            "proration_billing_mode": "prorated_immediately"
        }
        return await self._request("PATCH", f"/subscriptions/{subscription_id}", data)

    @staticmethod
    def verify_webhook_signature(signature_header: str, raw_body: bytes, secret_key: str) -> bool:
        """
        Verify the Paddle webhook signature.
        Format: ts=...;h1=...
        """
        if not signature_header or not secret_key:
            return False

        try:
            # Parse header
            parts = {}
            for part in signature_header.split(";"):
                k, v = part.split("=")
                parts[k] = v
            
            ts = parts.get("ts")
            h1 = parts.get("h1")

            if not ts or not h1:
                return False

            # Create signed payload: ts:raw_body
            signed_payload = f"{ts}:".encode("utf-8") + raw_body
            
            # Calculate HMAC SHA256
            computed_signature = hmac.new(
                secret_key.encode("utf-8"),
                signed_payload,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(computed_signature, h1)
            
        except Exception as e:
            logger.error(f"Webhook verification failed: {str(e)}")
            return False

# Singleton instance
paddle_client = PaddleClient()
