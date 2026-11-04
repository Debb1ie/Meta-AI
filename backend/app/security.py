"""Request-level security controls.

- Admin key: every endpoint that changes data (alert levels, imports, demo data,
  manual syncs) requires the X-Admin-Token header to match ADMIN_TOKEN. With no
  ADMIN_TOKEN configured, those endpoints are disabled (secure by default).
- Rate limits: sliding windows per client and a global daily budget on the
  endpoints that spend Meta Model API credits or heavy CPU.
- Security headers on every response.

Client identity: Render sits behind Cloudflare, which sets CF-Connecting-IP and
overwrites any client-supplied value, so it cannot be spoofed. Locally we fall back
to the socket address. Global daily caps bound the damage even if identity is evaded."""

import hmac
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings


# ---------------------------------------------------------------- admin key


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    expected = get_settings().admin_token
    if not expected:
        raise HTTPException(403, "Admin actions are disabled on this deployment (no ADMIN_TOKEN configured).")
    if not x_admin_token or not hmac.compare_digest(x_admin_token.encode(), expected.encode()):
        raise HTTPException(401, "Admin key required for this action.")


# ---------------------------------------------------------------- rate limits


def client_id(request: Request) -> str:
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    return request.client.host if request.client else "unknown"


class _Limiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def check(self, bucket: str, who: str, per_minute: int, per_day: int, global_per_day: int) -> int | None:
        """Record a hit; return seconds to wait if a limit is exceeded, else None."""
        now = time.time()
        with self._lock:
            mine = self._hits[(bucket, who)]
            everyone = self._hits[(bucket, "*")]
            for q in (mine, everyone):
                while q and now - q[0] > 86400:
                    q.popleft()
            last_minute = sum(1 for t in mine if now - t < 60)
            if per_minute and last_minute >= per_minute:
                return 60
            if per_day and len(mine) >= per_day:
                return int(86400 - (now - mine[0])) + 1
            if global_per_day and len(everyone) >= global_per_day:
                return int(86400 - (now - everyone[0])) + 1
            mine.append(now)
            everyone.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = _Limiter()

# bucket: (per client per minute, per client per day, all clients per day)
LIMITS = {
    "analyst": (6, 60, 600),
    "agent": (2, 20, 120),
    "vision": (5, 20, 150),  # SAM 3.1 segmentation (one request may retry with fallback prompts)
    "image": (3, 15, 100),  # Muse Image generation
    "csv": (10, 100, 1000),  # CSV preview parsing
}


def rate_limit(bucket: str):
    per_minute, per_day, global_per_day = LIMITS[bucket]

    def dependency(request: Request) -> None:
        if not get_settings().rate_limits_enabled:
            return
        wait = limiter.check(bucket, client_id(request), per_minute, per_day, global_per_day)
        if wait is not None:
            raise HTTPException(429, f"Too many requests for this feature. Try again in {wait} seconds.", headers={"Retry-After": str(wait)})

    return dependency


# ---------------------------------------------------------------- headers


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
        # The interactive API docs load Swagger UI from a CDN; everything else is JSON or CSV.
        if not request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
            h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        if request.url.path.startswith("/api/ai/"):
            h.setdefault("Cache-Control", "no-store")
        return response
