"""Health check endpoint for monitoring and load balancers.

Provides a /health endpoint that checks Redis, database, and other services.
"""

import time
import logging
from typing import Dict, Any
from fastapi import APIRouter, Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


async def check_redis() -> Dict[str, Any]:
    """Check Redis connectivity."""
    try:
        try:
            from backend.redis_client import get_redis_client
        except ImportError:
            from redis_client import get_redis_client
            
        client = get_redis_client()
        if not client.available:
            return {"status": "unavailable", "message": "Redis not configured"}
        
        if not client._client:
            await client.connect()
        
        start = time.time()
        await client._client.ping()
        latency = (time.time() - start) * 1000
        
        return {"status": "healthy", "latency_ms": round(latency, 2)}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


async def check_database() -> Dict[str, Any]:
    """Check database connectivity."""
    try:
        try:
            from backend.database import database
        except ImportError:
            from database import database
        
        if not database.is_connected:
            return {"status": "disconnected"}
        
        start = time.time()
        result = await database.fetch_one("SELECT 1 as test")
        latency = (time.time() - start) * 1000
        
        if result:
            return {"status": "healthy", "latency_ms": round(latency, 2)}
        return {"status": "unhealthy", "error": "Query returned no result"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.get("/health")
async def health_check(response: Response) -> Dict[str, Any]:
    """
    Health check endpoint for load balancers and monitoring.
    
    Returns:
        - status: "healthy", "degraded", or "unhealthy"
        - services: Status of individual services
        - timestamp: Current server time
    """
    redis_status = await check_redis()
    db_status = await check_database()
    
    services = {
        "redis": redis_status,
        "database": db_status,
    }
    
    # Determine overall status
    unhealthy_count = sum(
        1 for s in services.values() 
        if s.get("status") in ("unhealthy", "disconnected")
    )
    
    if unhealthy_count == 0:
        overall = "healthy"
        response.status_code = 200
    elif unhealthy_count < len(services):
        overall = "degraded"
        response.status_code = 200  # Still operational
    else:
        overall = "unhealthy"
        response.status_code = 503
    
    return {
        "status": overall,
        "services": services,
        "timestamp": time.time(),
    }


@router.get("/health/live")
async def liveness_check() -> Dict[str, str]:
    """Simple liveness probe - just returns OK."""
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness_check(response: Response) -> Dict[str, Any]:
    """Readiness probe - checks if app is ready to serve traffic."""
    db_status = await check_database()
    
    if db_status.get("status") == "healthy":
        return {"status": "ready"}
    else:
        response.status_code = 503
        return {"status": "not_ready", "reason": db_status}
