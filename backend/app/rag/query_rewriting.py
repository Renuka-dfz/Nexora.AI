
"""Query processing for Nexora.AI RAG.

Supports:
- Query normalization
- Multi-topic decomposition
- Optional LLM-based rewriting via local Ollama
- Strict output validation and safe fallback

Rewritten queries are search hypotheses, not facts.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

MAX_QUERY_LENGTH = 500
MAX_SEARCH_QUERIES = 3

# Decompose only clear multiple requests.
SPLIT_PATTERN = re.compile(
    r"\s*(?:;|\n+|\b(?:and also|as well as)\b)\s*",
    flags=re.IGNORECASE,
)


@dataclass(frozen=True)
class ProcessedQuery:
    original_query: str
    normalized_query: str
    search_queries: tuple[str, ...]
    method: str


class RewrittenQueries(BaseModel):
    queries: list[str] = Field(
        min_length=1,
        max_length=MAX_SEARCH_QUERIES,
    )


def normalize_query(query: str) -> str:
    if not isinstance(query, str):
        raise TypeError("Query must be a string")

    text = " ".join(query.split()).strip()

    if not text:
        raise ValueError("Query cannot be empty")

    if len(text) > MAX_QUERY_LENGTH:
        raise ValueError("Query exceeds maximum length")

    return text


def _deduplicate(
    queries: list[str],
) -> tuple[str, ...]:
    seen: set[str] = set()
    output: list[str] = []

    for query in queries:
        text = " ".join(query.split()).strip()
        key = text.casefold()

        if not text or key in seen:
            continue

        seen.add(key)
        output.append(text)

        if len(output) >= MAX_SEARCH_QUERIES:
            break

    return tuple(output)


def deterministic_rewrite(
    query: str,
) -> ProcessedQuery:
    original = normalize_query(query)

    parts = [
        part.strip(" ,.;")
        for part in SPLIT_PATTERN.split(original)
        if part.strip(" ,.;")
    ]

    # Preserve original query first.
    candidates = [original]

    if len(parts) > 1:
        candidates.extend(parts)

    queries = _deduplicate(candidates)

    return ProcessedQuery(
        original_query=original,
        normalized_query=original,
        search_queries=queries,
        method="deterministic",
    )


def _preserves_explicit_terms(
    original: str,
    rewritten: str,
) -> bool:
    """Guard against dropping quoted terms or numbers."""

    # Preserve exact user-specified phrases.
    quoted = re.findall(
        r'["\']([^"\']+)["\']',
        original,
    )

    original_numbers = set(
        re.findall(r"\b\d+(?:\.\d+)?\b", original)
    )

    rewritten_lower = rewritten.casefold()

    if any(
        phrase.casefold() not in rewritten_lower
        for phrase in quoted
    ):
        return False

    rewritten_numbers = set(
        re.findall(
            r"\b\d+(?:\.\d+)?\b",
            rewritten,
        )
    )

    return original_numbers.issubset(
        rewritten_numbers
    )


def rewrite_with_ollama(
    query: str,
    *,
    model_name: str = "qwen3.5:4b",
    host: str = "http://127.0.0.1:11434",
) -> ProcessedQuery:
    """
    Use a local model for query reformulation.

    Falls back to the deterministic version if the
    model is unavailable or returns invalid output.

    Do not expose this function as a direct public
    URL/host-controlled API.
    """
    normalized = normalize_query(query)
    fallback = deterministic_rewrite(normalized)

    try:
        from ollama import Client

        client = Client(
            host=host,
            timeout=45,
        )

        response = client.chat(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You rewrite search questions for "
                        "a company knowledge retrieval system. "
                        "Return JSON matching the schema. "
                        "Create at most three concise queries. "
                        "Preserve the user's meaning, quoted "
                        "phrases, product names, and numbers. "
                        "Never assume the company provides a "
                        "service or has a customer. "
                        "Do not answer the question. "
                        "Do not invent facts, entities or dates."
                    ),
                },
                {
                    "role": "user",
                    "content": normalized,
                },
            ],
            format=RewrittenQueries.model_json_schema(),
            options={
                "temperature": 0,
            },
        )

        output = RewrittenQueries.model_validate_json(
            response.message.content
        )

        valid = []

        for candidate in output.queries:
            candidate = normalize_query(candidate)

            if _preserves_explicit_terms(
                normalized,
                candidate,
            ):
                valid.append(candidate)

        # Always retain the original query so the
        # rewriting step cannot erase user intent.
        queries = _deduplicate(
            [normalized, *valid]
        )

        if len(queries) <= 1:
            return fallback

        return ProcessedQuery(
            original_query=normalized,
            normalized_query=normalized,
            search_queries=queries,
            method="ollama",
        )

    except Exception:
        logger.warning(
            "LLM query rewriting unavailable; "
            "using deterministic fallback",
            exc_info=True,
        )
        return fallback


def process_query(
    query: str,
    *,
    use_llm: bool = False,
    model_name: str = "qwen3.5:4b",
) -> ProcessedQuery:
    if use_llm:
        return rewrite_with_ollama(
            query,
            model_name=model_name,
        )

    return deterministic_rewrite(query)
