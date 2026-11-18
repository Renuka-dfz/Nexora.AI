"""
Nexora.AI - Instagram Content Publishing Service.

Implements the official Meta 2-step Content Publishing flow:
Step 1: POST /{ig-user-id}/media -> creates Media Container.
Step 2: GET /{container-id}?fields=status_code -> verifies container processing.
Step 3: POST /{ig-user-id}/media_publish?creation_id={container-id} -> publishes to feed.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.integrations.instagram.client import META_GRAPH_BASE, InstagramAPIClient
from app.integrations.instagram.schemas import (
    InstagramContainerResponse,
    InstagramPublishRequest,
    InstagramPublishResponse,
)

logger = logging.getLogger(__name__)


async def create_instagram_media_container(
    client: InstagramAPIClient,
    request: InstagramPublishRequest,
) -> InstagramContainerResponse:
    """
    Step 1: Upload media URL and caption to create an IG media container.
    Endpoint: POST /{ig-user-id}/media
    """
    url = f"{META_GRAPH_BASE}/{request.instagram_user_id}/media"
    params = {
        "image_url": request.image_url,
        "caption": request.caption,
        "access_token": client.access_token,
    }

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        resp = await http_client.post(url, data=params)
        resp.raise_for_status()
        data = resp.json()
        container_id = data.get("id")
        if not container_id:
            raise RuntimeError(f"Instagram did not return a valid container ID: {data}")

        logger.info("Created Instagram media container: %s", container_id)
        return InstagramContainerResponse(container_id=container_id, status="created")


async def check_container_status(
    client: InstagramAPIClient,
    container_id: str,
) -> str:
    """
    Step 2: Check processing status of the created media container.
    Endpoint: GET /{container-id}?fields=status_code
    """
    url = f"{META_GRAPH_BASE}/{container_id}"
    params = {
        "fields": "status_code",
        "access_token": client.access_token,
    }

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        resp = await http_client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("status_code", "FINISHED")


async def publish_instagram_container(
    client: InstagramAPIClient,
    *,
    instagram_user_id: str,
    container_id: str,
) -> InstagramPublishResponse:
    """
    Step 3: Publish the processed container to the live Instagram feed.
    Endpoint: POST /{ig-user-id}/media_publish?creation_id={container_id}
    """
    url = f"{META_GRAPH_BASE}/{instagram_user_id}/media_publish"
    params = {
        "creation_id": container_id,
        "access_token": client.access_token,
    }

    async with httpx.AsyncClient(timeout=client.timeout) as http_client:
        resp = await http_client.post(url, data=params)
        resp.raise_for_status()
        data = resp.json()
        media_id = data.get("id")
        if not media_id:
            raise RuntimeError(f"Instagram did not return media ID on publish: {data}")

        logger.info("Published Instagram media ID: %s", media_id)
        return InstagramPublishResponse(media_id=media_id, status="published")


async def execute_full_instagram_publish(
    client: InstagramAPIClient,
    request: InstagramPublishRequest,
    max_wait_seconds: int = 45,
) -> InstagramPublishResponse:
    """
    Convenience orchestrator executing Container Creation -> Status Poll -> Publish.
    """
    # 1. Create container
    container_res = await create_instagram_media_container(client, request)
    container_id = container_res.container_id

    # 2. Poll until container status is FINISHED
    start_time = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start_time < max_wait_seconds:
        status_code = await check_container_status(client, container_id)
        if status_code in ("FINISHED", ""):
            break
        elif status_code == "ERROR":
            raise RuntimeError(f"Instagram media processing failed for container {container_id}")
        await asyncio.sleep(3.0)

    # 3. Publish container to live feed
    return await publish_instagram_container(
        client,
        instagram_user_id=request.instagram_user_id,
        container_id=container_id,
    )
