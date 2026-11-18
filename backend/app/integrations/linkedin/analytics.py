"""
Nexora.AI - LinkedIn Analytics & Engagement Metrics Service.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import Any

import httpx

from app.integrations.linkedin.client import LINKEDIN_API_BASE, LinkedInAPIClient
from app.integrations.linkedin.schemas import LinkedInAnalyticsResponse

logger = logging.getLogger(__name__)


async def get_linkedin_post_analytics(
    client: LinkedInAPIClient,
    *,
    post_urn: str,
    organization_urn: str | None = None,
) -> LinkedInAnalyticsResponse:
    """
    Fetch engagement analytics for a specific published LinkedIn post.

    Uses the organizationalEntityShareStatistics endpoint when organization_urn is provided.
    """
    if not organization_urn:
        logger.info("Personal share analytics queried for post: %s", post_urn)
        return LinkedInAnalyticsResponse(post_urn=post_urn)

    encoded_org = urllib.parse.quote(organization_urn)
    encoded_share = urllib.parse.quote(post_urn)
    url = f"{LINKEDIN_API_BASE}/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity={encoded_org}&shares=List({encoded_share})"

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        response = await http_client.get(url, headers=client._headers())
        if response.status_code == 404:
            logger.info("No analytics records yet for post %s", post_urn)
            return LinkedInAnalyticsResponse(post_urn=post_urn)

        response.raise_for_status()
        data = response.json()

        elements = data.get("elements", [])
        if not elements:
            return LinkedInAnalyticsResponse(post_urn=post_urn)

        stats = elements[0].get("totalShareStatistics", {})
        impressions = stats.get("impressionCount", 0)
        clicks = stats.get("clickCount", 0)
        likes = stats.get("likeCount", 0)
        comments = stats.get("commentCount", 0)
        shares = stats.get("shareCount", 0)
        engagement = stats.get("engagement", 0.0)

        return LinkedInAnalyticsResponse(
            post_urn=post_urn,
            impressions=impressions,
            unique_impressions=stats.get("uniqueImpressionsCount", impressions),
            clicks=clicks,
            likes=likes,
            comments=comments,
            shares=shares,
            engagement_rate=round(float(engagement), 4),
        )
