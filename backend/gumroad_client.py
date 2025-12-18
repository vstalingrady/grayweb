import os
import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("backend.gumroad_client")

class GumroadClient:
    def __init__(self):
        self.access_token = os.getenv("GUMROAD_ACCESS_TOKEN")
        self.client_id = os.getenv("GUMROAD_CLIENT_ID")
        self.client_secret = os.getenv("GUMROAD_CLIENT_SECRET")
        self.api_base_url = "https://api.gumroad.com/v2"
        self.oauth_base_url = "https://gumroad.com/oauth"
        
        if not self.access_token:
            logger.warning("GUMROAD_ACCESS_TOKEN not set. Gumroad integration will be limited.")

    async def verify_license(self, product_id: str, license_key: str) -> Dict[str, Any]:
        """
        Verify a license key for a given product.
        https://api.gumroad.com/v2/licenses/verify
        """
        url = f"{self.api_base_url}/licenses/verify"
        data = {
            "product_id": product_id,
            "license_key": license_key,
            "increment_uses_count": "false" # Default to false for verification checks
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # Use form data for verify
                response = await client.post(url, data=data)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Gumroad license verification error: {e.response.text}")
                return {"success": False, "message": e.response.text}
            except Exception as e:
                logger.error(f"Gumroad connection error: {str(e)}")
                return {"success": False, "message": str(e)}

    async def get_sale(self, sale_id: str) -> Dict[str, Any]:
        """
        Retrieve details of a specific sale.
        https://api.gumroad.com/v2/sales/:id
        """
        if not self.access_token:
            raise RuntimeError("GUMROAD_ACCESS_TOKEN is missing.")

        url = f"{self.api_base_url}/sales/{sale_id}"
        params = {"access_token": self.access_token}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching Gumroad sale {sale_id}: {str(e)}")
                raise e

    async def exchange_authorization_code(
        self, 
        code: str, 
        redirect_uri: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.
        https://api.gumroad.com/oauth/token
        """
        if not self.client_id or not self.client_secret:
            raise RuntimeError("GUMROAD_CLIENT_ID or GUMROAD_CLIENT_SECRET not set")

        url = "https://api.gumroad.com/oauth/token"
        data = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=data)
                response.raise_for_status()
                result = response.json()
                logger.info("Successfully exchanged authorization code for access token")
                return result
            except httpx.HTTPStatusError as e:
                logger.error(f"Gumroad OAuth token exchange error: {e.response.text}")
                return {"success": False, "message": e.response.text}
            except Exception as e:
                logger.error(f"Gumroad OAuth connection error: {str(e)}")
                return {"success": False, "message": str(e)}

    async def get_user_info(self, user_access_token: str) -> Dict[str, Any]:
        """
        Get user information using their OAuth access token.
        https://api.gumroad.com/v2/user
        """
        url = f"{self.api_base_url}/user"
        params = {"access_token": user_access_token}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching Gumroad user info: {str(e)}")
                raise e

    async def get_user_sales(self, user_access_token: str) -> Dict[str, Any]:
        """
        List sales for the authenticated user.
        https://api.gumroad.com/v2/sales
        """
        url = f"{self.api_base_url}/sales"
        params = {"access_token": user_access_token}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching Gumroad sales: {str(e)}")
                raise e

# Singleton instance
gumroad_client = GumroadClient()
