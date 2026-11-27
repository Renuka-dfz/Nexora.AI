
"""Heading-aware semantic chunking for Nexora.AI RAG.

Strategy:
1. Preserve source section boundaries.
2. Split text into sentences.
3. Detect semantic topic changes using MiniLM.
4. Enforce embedding model token limits.
5. Preserve source metadata and content hashes.

No LLM or external inference API is required.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, replace
from functools import lru_cache
from typing import Sequence

import numpy as np
from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

CHUNKING_VERSION = "semantic-heading-v2"

CHUNK_SIZE_TOKENS = 200
CHUNK_OVERLAP_TOKENS = 30

MAX_TOKENS = CHUNK_SIZE_TOKENS
MIN_TOKENS = 25

SIMILARITY_THRESHOLD = 0.72

# Strong topic changes may override minimum chunk size.
STRONG_BOUNDARY_THRESHOLD = 0.55


@dataclass(frozen=True)
class SemanticChunk:
    chunk_index: int
    content: str
    heading_path: str
    source_url: str
    token_count: int
    content_hash: str


@dataclass(frozen=True)
class SourceSection:
    content: str
    heading_path: str
    source_url: str


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """Load and reuse the local MiniLM model."""

    return SentenceTransformer(
        MODEL_NAME,
        device="cpu",
    )


def normalize_text(text: str) -> str:
    """Normalize Unicode whitespace."""

    if not isinstance(text, str):
        raise TypeError("Content must be a string")

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def split_sentences(text: str) -> list[str]:
    """Basic English sentence segmentation."""

    normalized = normalize_text(text)

    if not normalized:
        return []

    return [
        sentence.strip()
        for sentence in re.split(
            r"(?<=[.!?])\s+",
            normalized,
        )
        if sentence.strip()
    ]


def count_tokens(
    text: str,
    model: SentenceTransformer,
) -> int:
    """Count tokens without truncation."""

    return len(
        model.tokenizer.encode(
            text,
            add_special_tokens=True,
            truncation=False,
        )
    )


def split_oversized_sentence(
    sentence: str,
    model: SentenceTransformer,
    max_tokens: int,
) -> list[str]:
    """Split long sentences into token-bounded units."""

    words = sentence.split()
    pieces: list[str] = []
    current = ""

    for word in words:
        candidate = (
            f"{current} {word}".strip()
        )

        if count_tokens(
            candidate,
            model,
        ) <= max_tokens:
            current = candidate
            continue

        if current:
            pieces.append(current)
            current = ""

        if count_tokens(
            word,
            model,
        ) <= max_tokens:
            current = word
            continue

        # Handle an unusually long unbroken token.
        # Character fragments may affect word spacing,
        # so preserve their original positions in metadata
        # if exact reconstruction is needed.
        fragment = ""

        for character in word:
            candidate = fragment + character

            if (
                fragment
                and count_tokens(
                    candidate,
                    model,
                ) > max_tokens
            ):
                pieces.append(fragment)
                fragment = character
            else:
                fragment = candidate

        if fragment:
            current = fragment

    if current:
        pieces.append(current)

    return pieces


def prepare_sentences(
    content: str,
    model: SentenceTransformer,
    max_tokens: int,
) -> list[str]:
    """Prepare token-safe sentence units."""

    prepared: list[str] = []

    for sentence in split_sentences(content):
        if count_tokens(
            sentence,
            model,
        ) <= max_tokens:
            prepared.append(sentence)

        else:
            prepared.extend(
                split_oversized_sentence(
                    sentence,
                    model,
                    max_tokens,
                )
            )

    return prepared


def _calculate_similarities(
    sentences: list[str],
    model: SentenceTransformer,
) -> list[float]:
    """Compute similarities between adjacent units."""

    if len(sentences) < 2:
        return []

    vectors = model.encode(
        sentences,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    return [
        float(
            np.dot(
                vectors[index - 1],
                vectors[index],
            )
        )
        for index in range(1, len(sentences))
    ]


def _validate_settings(
    model: SentenceTransformer,
    max_tokens: int,
    min_tokens: int,
    similarity_threshold: float,
) -> int:
    """Validate settings and return effective max tokens bounded by tokenizer limit."""
    if max_tokens <= 2:
        raise ValueError(
            "max_tokens must be greater than 2"
        )

    if min_tokens <= 0:
        raise ValueError(
            "min_tokens must be positive"
        )

    if not 0 <= similarity_threshold <= 1:
        raise ValueError(
            "Similarity threshold must be between 0 and 1"
        )

    model_limit = model.max_seq_length or 256

    # Prevent silent tokenizer truncation by clamping to model_limit - 2
    effective_max = min(max_tokens, model_limit - 2)
    return effective_max


def semantic_chunk_section(
    *,
    content: str,
    heading_path: str,
    source_url: str,
    max_tokens: int = MAX_TOKENS,
    min_tokens: int = MIN_TOKENS,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[SemanticChunk]:
    """
    Semantically chunk exactly one source section.

    This function preserves original section boundaries, title/heading hierarchy,
    keeps FAQ pairs together, avoids splitting short cohesive records,
    and prevents silent tokenizer truncation.
    """

    text = normalize_text(content)

    if not text:
        return []

    # Avoid treating isolated short fragments (e.g. standalone numbers, lone buttons) as useful chunks
    if len(text.split()) < 3 and len(text) < 20:
        return []

    model = get_model()

    effective_max = _validate_settings(
        model,
        max_tokens,
        min_tokens,
        similarity_threshold,
    )

    # If the entire section is already self-contained and fits within the token limit,
    # keep it as a single atomic chunk to preserve semantic unity.
    total_tokens = count_tokens(text, model)
    if total_tokens <= effective_max:
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return [
            SemanticChunk(
                chunk_index=0,
                content=text,
                heading_path=heading_path,
                source_url=source_url,
                token_count=total_tokens,
                content_hash=content_hash,
            )
        ]

    sentences = prepare_sentences(
        text,
        model,
        effective_max,
    )

    if not sentences:
        return []

    # A single sentence unit needs no semantic inference.
    if len(sentences) == 1:
        groups = sentences

    else:
        similarities = _calculate_similarities(
            sentences,
            model,
        )

        groups: list[str] = []
        current = sentences[0]

        for index in range(1, len(sentences)):
            sentence = sentences[index]

            candidate = (
                f"{current} {sentence}"
            )

            similarity = similarities[index - 1]

            exceeds_limit = (
                count_tokens(
                    candidate,
                    model,
                ) > effective_max
            )

            normal_topic_change = (
                similarity < similarity_threshold
                and count_tokens(
                    current,
                    model,
                ) >= min_tokens
            )

            strong_topic_change = (
                similarity < min(
                    STRONG_BOUNDARY_THRESHOLD,
                    similarity_threshold,
                )
            )

            if (
                exceeds_limit
                or normal_topic_change
                or strong_topic_change
            ):
                groups.append(current)
                current = sentence
            else:
                current = candidate

        if current:
            groups.append(current)

    result: list[SemanticChunk] = []

    for index, chunk_text in enumerate(groups):
        chunk_text = normalize_text(chunk_text)

        token_count = count_tokens(
            chunk_text,
            model,
        )

        if token_count > effective_max:
            raise ValueError(
                "Generated chunk exceeds token budget"
            )

        content_hash = hashlib.sha256(
            chunk_text.encode("utf-8")
        ).hexdigest()

        result.append(
            SemanticChunk(
                chunk_index=index,
                content=chunk_text,
                heading_path=heading_path,
                source_url=source_url,
                token_count=token_count,
                content_hash=content_hash,
            )
        )

    return result


def semantic_chunk_sections(
    sections: Sequence[SourceSection],
    *,
    max_tokens: int = MAX_TOKENS,
    min_tokens: int = MIN_TOKENS,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[SemanticChunk]:
    """
    Chunk multiple source sections without merging them.

    Assign unique sequential chunk indexes across
    the supplied sections.
    """

    all_chunks: list[SemanticChunk] = []

    for section in sections:
        chunks = semantic_chunk_section(
            content=section.content,
            heading_path=section.heading_path,
            source_url=section.source_url,
            max_tokens=max_tokens,
            min_tokens=min_tokens,
            similarity_threshold=similarity_threshold,
        )

        for chunk in chunks:
            all_chunks.append(
                replace(
                    chunk,
                    chunk_index=len(all_chunks),
                )
            )

    return all_chunks
