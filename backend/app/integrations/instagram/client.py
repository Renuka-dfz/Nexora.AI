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


class InstagramAPIClient:
    """Official Meta Graph API Client for Instagram Professional Publishing & Insights."""

    def __init__(self, access_token: str, timeout: float = 30.0) -> None:
        self.access_token = access_token
        self.timeout = timeout

    async def get_instagram_business_accounts(self) -> list[InstagramAccount]:
        """
        Discover connected Instagram Professional Accounts via user's Facebook Pages:
        GET /me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url}
        """
        url = f"{META_GRAPH_BASE}/me/accounts"
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
