import os
import logging
import hashlib
import midtransclient
from datetime import datetime
from dotenv import load_dotenv

logger = logging.getLogger("backend.payment_utils")

load_dotenv()

# Initialize Core API Client
core_api = midtransclient.CoreApi(
    is_production=os.getenv("MIDTRANS_IS_PRODUCTION", "false").lower() == "true",
    server_key=os.getenv("MIDTRANS_SERVER_KEY", ""),
    client_key=os.getenv("MIDTRANS_CLIENT_KEY", "")
)

def create_core_api_transaction(
    order_id: str,
    amount: int,
    item_details: list,
    customer_details: dict,
    payment_type: str = "gopay",
    bank_transfer_args: dict = None,
    token_id: str = None
):
    """
    Create a transaction using Midtrans Core API.
    
    :param order_id: Unique order ID
    :param amount: Total amount
    :param item_details: List of items (id, price, quantity, name)
    :param customer_details: Dict with first_name, last_name, email, phone
    :param payment_type: 'gopay', 'bank_transfer', 'credit_card'
    :param bank_transfer_args: Dict for bank transfer specifics (e.g. 'bank': 'bca')
    :param token_id: Token ID for credit card payments
    """
    
    transaction_details = {
        "order_id": order_id,
        "gross_amount": amount
    }
    
    payload = {
        "payment_type": payment_type,
        "transaction_details": transaction_details,
        "item_details": item_details,
        "customer_details": customer_details
    }

    # Add specific payment type details
    if payment_type == "gopay":
        payload["gopay"] = {
            "enable_callback": True,
            "callback_url": "https://gray.alignment.id" + "/payment/finish"
        }
    elif payment_type == "bank_transfer" and bank_transfer_args:
        payload["bank_transfer"] = bank_transfer_args
    elif payment_type == "credit_card" and token_id:
        payload["credit_card"] = {
            "token_id": token_id,
            "authentication": True
        }

    try:
        response = core_api.charge(payload)
        return response
    except Exception as e:
        logger.error("Midtrans Core API Error: %s", e)
        raise e

def verify_notification_signature(order_id: str, status_code: str, gross_amount: str, signature_key: str) -> bool:
    """
    Verify the signature key from a Midtrans notification.
    Signature = SHA512(order_id + status_code + gross_amount + server_key)
    """
    server_key = os.getenv("MIDTRANS_SERVER_KEY", "")
    
    # Ensure gross_amount is a string without .00 if it's an integer amount, 
    # but Midtrans sends it as a string usually. 
    # If it has .00, keep it. Just ensure strict string concatenation.
    
    raw_string = f"{order_id}{status_code}{gross_amount}{server_key}"
    sha512 = hashlib.sha512(raw_string.encode('utf-8')).hexdigest()
    
    return sha512 == signature_key
