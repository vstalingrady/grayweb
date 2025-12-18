import pytest
import os
from unittest.mock import patch, MagicMock, AsyncMock

@pytest.mark.asyncio
async def test_handle_gumroad_sale_logic():
    from backend.gumroad_routes import handle_gumroad_sale
    
    # Setup mocks
    mock_db = AsyncMock()
    
    # Dynamic mock for fetch_one
    async def side_effect_fetch_one(query, values=None):
        sql = str(query)
        if "FROM users" in sql:
            return {"id": 123, "email": "test@example.com"}
        if "FROM transactions" in sql:
            return None
        return None

    mock_db.fetch_one.side_effect = side_effect_fetch_one
    mock_db.execute.return_value = None
    
    # Mock environment variables for product mapping
    with patch.dict(os.environ, {
        "GUMROAD_PRODUCT_ID_VOYAGER_MONTHLY": "prod_1",
    }):
        # Mock payload from Gumroad
        payload = {
            "seller_id": "seller_1",
            "product_id": "prod_1",
            "product_name": "Voyager Monthly",
            "permalink": "voyager",
            "short_url": "https://gum.co/voyager",
            "email": "test@example.com",
            "price": "1700",
            "currency": "usd",
            "sale_id": "sale_1",
            "is_subscription": "true",
            "custom_fields[user_id]": "123",
            "license_key": "lic_123"
        }
        
        # Call the logic directly
        with patch("backend.gumroad_routes.database", mock_db):
            await handle_gumroad_sale(payload, db=mock_db)
            
            # Verify DB updates
            # 1. User update
            # 2. Transaction insert
            assert mock_db.execute.call_count >= 2

@pytest.mark.asyncio
async def test_verify_gumroad_license_manual_logic():
    from backend.gumroad_routes import verify_gumroad_license_manual
    
    mock_user = {"id": 123, "email": "test@example.com"}
    mock_db = AsyncMock()
    # Mock user row from DB
    mock_db.fetch_one.return_value = {"gumroad_license_key": "lic_123"}
    
    with patch("backend.gumroad_routes.gumroad_client.verify_license") as mock_verify:
        mock_verify.return_value = {
            "success": True, 
            "uses": 1,
            "purchase": {
                "subscription_id": "sub_123",
                "subscription_ended_at": None
            }
        }
        
        # Mock product IDs
        with patch.dict(os.environ, {
            "GUMROAD_PRODUCT_ID_VOYAGER_MONTHLY": "prod_1",
        }):
            with patch("backend.gumroad_routes.database", mock_db):
                res = await verify_gumroad_license_manual(mock_user, db=mock_db)
                assert res["success"] is True
                assert "voyager" in res["message"].lower()
                assert res["tier"] == "voyager"
