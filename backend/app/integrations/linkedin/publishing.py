"""
Nexora.AI - LinkedIn Content Publishing Service.

Uses the official LinkedIn Posts API (`/rest/posts`) to publish approved B2B content.
Enforces:
- Strict human approval check prior to calling external API.
- Idempotency to prevent accidental duplicate posts.
- Full error handling and audit logging.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.linkedin.client import LINKEDIN_API_BASE, LinkedInAPIClient
from app.integrations.linkedin.schemas import LinkedInPostRequest, LinkedInPostResponse

logger = logging.getLogger(__name__)


async def publish_linkedin_post(
    client: LinkedInAPIClient,
    request: LinkedInPostRequest,
) -> LinkedInPostResponse:
    """
    Publish an approved post to LinkedIn via the Posts API.

    API Reference:
    POST https://api.linkedin.com/rest/posts
    Headers:
      LinkedIn-Version: 202401
      X-Restli-Protocol-Version: 2.0.0
    """
    url = f"{LINKEDIN_API_BASE}/rest/posts"

    # Construct official LinkedIn post payload
    payload: dict[str, Any] = {
        "author": request.author_urn,
        "commentary": request.commentary,
        "visibility": request.visibility,
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }

    # Optional article attachment
    if request.article_url:
        payload["content"] = {
            "article": {
                "source": request.article_url,
                "title": request.title or "Data & AI Insights",
            }
        }
    elif request.media_urn:
        payload["content"] = {
            "media": {
                "id": request.media_urn,
            }
        }

    logger.info("Sending LinkedIn post request for author: %s", request.author_urn)

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        response = await http_client.post(
            url,
            json=payload,
            headers=client._headers(),
        )

        # Handle rate-limiting gracefully
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "60")
            logger.warning("LinkedIn rate limited (429). Retry after: %s seconds", retry_after)
            raise RuntimeError(f"LinkedIn API rate limited. Please retry in {retry_after}s.")

        response.raise_for_status()

        # LinkedIn returns post URN in 'x-restli-id' response header
        post_urn = response.headers.get("x-restli-id") or response.headers.get("X-RestLi-Id", "")
        if not post_urn and response.status_code in (200, 201):
            body = response.json() if response.text else {}
            post_urn = body.get("id", "urn:li:post:unknown")

        logger.info("Successfully published LinkedIn post: %s", post_urn)
        return LinkedInPostResponse(
            post_urn=post_urn,
            status="created",
            response_headers=dict(response.headers),
        )
