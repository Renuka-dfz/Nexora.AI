"""
Nexora.AI - LinkedIn OAuth 2.0 Authorization & Token Flow.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import Sequence

import httpx

from app.core.config import settings
from app.integrations.linkedin.schemas import LinkedInOAuthToken

logger = logging.getLogger(__name__)

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

DEFAULT_LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
]

ORGANIZATION_LINKEDIN_SCOPES = [
    "r_organization_social",
    "w_organization_social",
]


def get_linkedin_authorization_url(
    *,
    state: str,
    include_organization: bool = True,
    redirect_uri: str | None = None,
) -> str:
    """Construct official LinkedIn OAuth 2.0 authorization URL."""
    scopes = list(DEFAULT_LINKEDIN_SCOPES)
    if include_organization:
        scopes.extend(ORGANIZATION_LINKEDIN_SCOPES)

    params = {
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": redirect_uri or settings.LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": " ".join(scopes),
    }
    query_string = urllib.parse.urlencode(params)
    return f"{LINKEDIN_AUTH_URL}?{query_string}"


async def exchange_linkedin_code_for_token(
    *,
    code: str,
    redirect_uri: str | None = None,
) -> LinkedInOAuthToken:
    """Exchange authorization code for an OAuth access token."""
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "client_secret": settings.LINKEDIN_CLIENT_SECRET,
        "redirect_uri": redirect_uri or settings.LINKEDIN_REDIRECT_URI,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            LINKEDIN_TOKEN_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        data = response.json()
        return LinkedInOAuthToken.model_validate(data)


async def refresh_linkedin_token(
    *,
    refresh_token: str,
) -> LinkedInOAuthToken:
    """Refresh an expiring LinkedIn OAuth 2.0 access token."""
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "client_secret": settings.LINKEDIN_CLIENT_SECRET,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            LINKEDIN_TOKEN_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        data = response.json()
        return LinkedInOAuthToken.model_validate(data)
