"""
Nexora.AI - Marketing Agent Workflow State & Checkpointing Memory.

Manages conversational state and draft revision tracking using LangGraph checkpointing
and structured PostgreSQL metadata, avoiding an unnecessary separate vector memory system.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)

# In-memory LangGraph checkpointer for conversation & thread execution
_checkpointer = MemorySaver()


def get_agent_checkpointer() -> MemorySaver:
    """Return reusable LangGraph checkpointer for workflow execution."""
    return _checkpointer


class MarketingMemoryManager:
    """Lightweight session context manager for Marketing Agent runs."""

    def __init__(self, company_id: UUID, thread_id: str | None = None) -> None:
        self.company_id = company_id
        self.thread_id = thread_id or f"marketing-{company_id}"

    def build_config(self) -> dict[str, Any]:
        """Build LangGraph runtime invocation config containing thread identifier."""
        return {
            "configurable": {
                "thread_id": self.thread_id,
                "company_id": str(self.company_id),
            }
        }
