"""
Nexora.AI - LinkedIn Versioned REST API Client.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.linkedin.schemas import LinkedInOrganization, LinkedInProfile

logger = logging.getLogger(__name__)

LINKEDIN_API_BASE = "https://api.linkedin.com"
LINKEDIN_VERSION = "202401"


class LinkedInAPIClient:
    """Official LinkedIn Versioned REST Client with rate-limit and header handling."""

    def __init__(self, access_token: str, timeout: float = 30.0) -> None:
        self.access_token = access_token
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "LinkedIn-Version": LINKEDIN_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def get_current_user_profile(self) -> LinkedInProfile:
        """Fetch current authenticated member profile via OIDC userinfo."""
        url = f"{LINKEDIN_API_BASE}/v2/userinfo"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {self.access_token}"})
            resp.raise_for_status()
            data = resp.json()
            return LinkedInProfile(
                sub=f"urn:li:person:{data.get('sub')}",
                name=data.get("name", ""),
                given_name=data.get("given_name"),
                family_name=data.get("family_name"),
                picture=data.get("picture"),
                email=data.get("email"),
            )

    async def get_administered_organizations(self) -> list[LinkedInOrganization]:
        """Fetch organizations where the authenticated user has ADMINISTRATOR role."""
        url = f"{LINKEDIN_API_BASE}/rest/organizationalEntityAcls?q=roleAssignee"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

            elements = data.get("elements", [])
            orgs: list[LinkedInOrganization] = []
            for el in elements:
                org_urn = el.get("organizationalTarget", "")
                role = el.get("role", "")
                if role == "ADMINISTRATOR" and org_urn:
                    org_id = org_urn.split(":")[-1]
                    orgs.append(
                        LinkedInOrganization(
                            id=org_id,
                            localized_name=f"Organization {org_id}",
                            urn=org_urn,
                        )
                    )
            return orgs
