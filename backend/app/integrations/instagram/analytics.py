"""
Nexora.AI - Instagram Insights & Analytics Service.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.instagram.client import META_GRAPH_BASE, InstagramAPIClient
from app.integrations.instagram.schemas import InstagramInsightsResponse

logger = logging.getLogger(__name__)


async def get_instagram_media_insights(
    client: InstagramAPIClient,
    *,
    media_id: str,
) -> InstagramInsightsResponse:
    """
    Fetch engagement metrics for an individual Instagram published media item.
    Endpoint: GET /{media-id}/insights?metric=impressions,reach,saved,total_interactions
    """
    url = f"{META_GRAPH_BASE}/{media_id}/insights"
    params = {
        "metric": "impressions,reach,saved,total_interactions",
        "access_token": client.access_token,
    }

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        resp = await http_client.get(url, params=params)
        if resp.status_code in (400, 404):
            logger.info("Instagram insights not yet available for media %s", media_id)
            return InstagramInsightsResponse(media_id=media_id)

        resp.raise_for_status()
        data = resp.json()

        metrics_map: dict[str, int] = {}
        for item in data.get("data", []):
            name = item.get("name")
            values = item.get("values", [])
            val = values[0].get("value", 0) if values else 0
            metrics_map[name] = val

        return InstagramInsightsResponse(
            media_id=media_id,
            impressions=metrics_map.get("impressions", 0),
            reach=metrics_map.get("reach", 0),
            saved=metrics_map.get("saved", 0),
            engagement=metrics_map.get("total_interactions", 0),
        )
