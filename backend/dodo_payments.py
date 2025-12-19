import logging
import os
from functools import lru_cache

from dodopayments import DodoPayments

logger = logging.getLogger("backend.dodo_payments")


@lru_cache(maxsize=1)
def get_dodo_client() -> DodoPayments:
    api_key = os.getenv("DODO_PAYMENTS_API_KEY")
    if not api_key:
        raise RuntimeError("DODO_PAYMENTS_API_KEY is not set")

    environment = os.getenv("DODO_PAYMENTS_ENVIRONMENT", "test_mode")
    webhook_key = os.getenv("DODO_PAYMENTS_WEBHOOK_KEY")

    return DodoPayments(
        bearer_token=api_key,
        environment=environment,
        webhook_key=webhook_key,
    )
