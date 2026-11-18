"""
Nexora.AI - Instagram / Meta Graph OAuth 2.0 Authorization Flow.
"""

from __future__ import annotations

import logging
import urllib.parse

import httpx

from app.core.config import settings
from app.integrations.instagram.schemas import InstagramOAuthToken

logger = logging.getLogger(__name__)

META_AUTH_DIALOG_URL = "https://www.facebook.com/v20.0/dialog/oauth"
META_GRAPH_TOKEN_URL = "https://graph.facebook.com/v20.0/oauth/access_token"

INSTAGRAM_REQUIRED_SCOPES = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
]


def get_instagram_authorization_url(
    *,
    state: str,
    redirect_uri: str | None = None,
) -> str:
    """Generate official Meta OAuth authorization URL for Instagram Professional accounts."""
    params = {
        "client_id": settings.INSTAGRAM_CLIENT_ID,
        "redirect_uri": redirect_uri or settings.INSTAGRAM_REDIRECT_URI,
        "state": state,
        "scope": ",".join(INSTAGRAM_REQUIRED_SCOPES),
        "response_type": "code",
    }
    return f"{META_AUTH_DIALOG_URL}?{urllib.parse.urlencode(params)}"


async def exchange_instagram_code_for_token(
    *,
    code: str,
    redirect_uri: str | None = None,
) -> InstagramOAuthToken:
    """Exchange authorization code for a short-lived user access token."""
    params = {
        "client_id": settings.INSTAGRAM_CLIENT_ID,
        "client_secret": settings.INSTAGRAM_CLIENT_SECRET,
        "redirect_uri": redirect_uri or settings.INSTAGRAM_REDIRECT_URI,
        "code": code,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(META_GRAPH_TOKEN_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        return InstagramOAuthToken.model_validate(data)


async def exchange_for_long_lived_token(
    *,
    short_lived_token: str,
) -> InstagramOAuthToken:
    """Exchange short-lived token for a long-lived 60-day access token."""
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": settings.INSTAGRAM_CLIENT_ID,
        "client_secret": settings.INSTAGRAM_CLIENT_SECRET,
        "fb_exchange_token": short_lived_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(META_GRAPH_TOKEN_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        return InstagramOAuthToken.model_validate(data)
