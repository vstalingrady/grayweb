import logging
import os
from functools import lru_cache

try:
    from dodopayments import DodoPayments
except ModuleNotFoundError as exc:
    DodoPayments = None  # type: ignore[assignment]
    _DODO_IMPORT_ERROR = exc

logger = logging.getLogger("backend.dodo_payments")


class DodoPaymentsUnavailable(RuntimeError):
    """Raised when Dodo Payments is not installed or configured."""


@lru_cache(maxsize=1)
def get_dodo_client() -> DodoPayments:
    if DodoPayments is None:
        raise DodoPaymentsUnavailable(
            "Dodo payments dependency is not installed; run `pip install dodopayments[webhooks]`."
        ) from _DODO_IMPORT_ERROR

    api_key = os.getenv("DODO_PAYMENTS_API_KEY")
    if not api_key:
        raise DodoPaymentsUnavailable("Dodo payments are not configured (missing DODO_PAYMENTS_API_KEY).")

    environment = os.getenv("DODO_PAYMENTS_ENVIRONMENT", "test_mode")
    webhook_key = os.getenv("DODO_PAYMENTS_WEBHOOK_KEY")

    return DodoPayments(
        bearer_token=api_key,
        environment=environment,
        webhook_key=webhook_key,
    )
