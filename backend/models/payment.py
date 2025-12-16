"""Payment-related Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class PaymentRequest(BaseModel):
    """Payment request model."""
    plan_tier: str  # "voyager" or "pioneer"
    payment_type: str = "gopay"  # gopay, bank_transfer, credit_card, echannel
    bank: Optional[str] = None  # bca, bni, bri, permata (required if payment_type is bank_transfer)
    token_id: Optional[str] = None  # required if payment_type is credit_card
    billing_cycle: Optional[str] = "monthly"  # "monthly" or "annual"


class PaymentChargeResponse(BaseModel):
    """Payment charge response model."""
    order_id: str
    status: str
    actions: Optional[List[Dict[str, Any]]] = None
    qr_code_url: Optional[str] = None
    deeplink_url: Optional[str] = None
    va_numbers: Optional[List[Dict[str, Any]]] = None
    redirect_url: Optional[str] = None  # for 3DS
    bill_key: Optional[str] = None  # for Mandiri
    biller_code: Optional[str] = None  # for Mandiri


class MidtransNotification(BaseModel):
    """Midtrans webhook notification model."""
    transaction_time: str
    transaction_status: str
    transaction_id: str
    status_message: str
    status_code: str
    signature_key: str
    payment_type: str
    order_id: str
    merchant_id: str
    gross_amount: str
    fraud_status: str
    currency: str
    # Bank transfer specific
    va_numbers: Optional[List[Dict[str, Any]]] = None
    payment_amounts: Optional[List[Dict[str, Any]]] = None
