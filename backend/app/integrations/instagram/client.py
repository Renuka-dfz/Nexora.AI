"""
Nexora.AI - Instagram Graph API Client.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.instagram.schemas import InstagramAccount

logger = logging.getLogger(__name__)

META_GRAPH_BASE = "https://graph.facebook.com/v20.0"
INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com/v20.0"


def get_instagram_base_url(token: str) -> str:
    """
    Select correct Meta endpoint based on token type:
    - Tokens starting with 'IGAA' or 'IGQ' use Instagram's dedicated domain: graph.instagram.com
    - Tokens starting with 'EAA' use Facebook Graph: graph.facebook.com
    """
    token_str = (token or "").strip()
    if token_str.startswith("IGAA") or token_str.startswith("IGQ"):
        return INSTAGRAM_GRAPH_BASE
    return META_GRAPH_BASE


class InstagramAPIClient:
    """Official Meta Graph API Client for Instagram Professional Publishing & Insights."""

    def __init__(self, access_token: str, timeout: float = 30.0) -> None:
        self.access_token = access_token
        self.timeout = timeout
        self.base_url = get_instagram_base_url(access_token)

    async def get_instagram_business_accounts(self) -> list[InstagramAccount]:
        """
        Discover connected Instagram Professional Accounts via user's Facebook Pages:
        GET /me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url}
        """
        url = f"{self.base_url}/me/accounts"
        params = {
            "fields": "instagram_business_account{id,username,name,profile_picture_url,followers_count}",
            "access_token": self.access_token,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            pages = data.get("data", [])
            accounts: list[InstagramAccount] = []
            for page in pages:
                ig_data = page.get("instagram_business_account")
                if ig_data and "id" in ig_data:
                    accounts.append(
                        InstagramAccount(
                            id=ig_data["id"],
                            username=ig_data.get("username", "unnamed"),
                            name=ig_data.get("name"),
                            profile_picture_url=ig_data.get("profile_picture_url"),
                            followers_count=ig_data.get("followers_count"),
                        )
                    )
            return accounts
