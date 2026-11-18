
"""Improved embedding service for Nexora.AI.

Uses BGE Small EN v1.5 by default.

Provides:
- Separate document and query encoding
- Batch inference
- L2-normalized vectors
- Dimension checks
- Token-budget checks
- pgvector-compatible float arrays
"""

from __future__ import annotations

import logging
from typing import Sequence

import numpy as np

from app.rag.chunking import (
    MODEL_NAME,
    count_tokens,
    get_model,
)

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = MODEL_NAME
EMBEDDING_DIMENSIONS = 384
EMBEDDING_BATCH_SIZE = 32

# Intentionally matches the tokenizer capacity for all-MiniLM-L6-v2.
MAX_DOCUMENT_TOKENS = 256
MAX_QUERY_TOKENS = 256


class EmbeddingError(RuntimeError):
    pass


def _model():
    model = get_model()
    actual_dimensions = model.get_embedding_dimension()
    if actual_dimensions != EMBEDDING_DIMENSIONS:
        raise EmbeddingError(
            f"Expected {EMBEDDING_DIMENSIONS} dimensions, "
            f"got {actual_dimensions}"
        )

    if model.max_seq_length is None:
        raise EmbeddingError(
            "Model sequence limit is unavailable"
        )

    return model


def _prepare_texts(
    texts: Sequence[str],
    *,
    token_limit: int,
) -> list[str]:
    model = _model()

    if not isinstance(texts, (list, tuple)):
        raise TypeError(
            "Expected a list or tuple of text"
        )

    output: list[str] = []

    for index, text in enumerate(texts):
        if not isinstance(text, str):
            raise EmbeddingError(
                f"Input {index} is not a string"
            )

        cleaned = " ".join(text.split())

        if not cleaned:
            raise EmbeddingError(
                f"Input {index} is empty"
            )

        count = count_tokens(
            cleaned,
            model,
        )

        if count > token_limit:
            raise EmbeddingError(
                f"Input {index} contains {count} tokens. "
                f"Limit is {token_limit}."
            )

        if count > model.max_seq_length:
            raise EmbeddingError(
                "Model token limit exceeded"
            )

        output.append(cleaned)

    return output


def _validate_vectors(
    vectors: object,
    *,
    expected_count: int,
) -> list[list[float]]:
    matrix = np.asarray(
        vectors,
        dtype=np.float32,
    )

    expected_shape = (
        expected_count,
        EMBEDDING_DIMENSIONS,
    )

    if matrix.shape != expected_shape:
        raise EmbeddingError(
            f"Wrong vector shape: {matrix.shape}"
        )

    if not np.isfinite(matrix).all():
        raise EmbeddingError(
            "Embeddings contain non-finite values"
        )

    norms = np.linalg.norm(
        matrix,
        axis=1,
    )

    if not np.allclose(
        norms,
        1.0,
        atol=1e-3,
    ):
        raise EmbeddingError(
            "Vectors are not L2-normalized"
        )

    return matrix.tolist()


def embed_documents(
    texts: Sequence[str],
    *,
    batch_size: int = EMBEDDING_BATCH_SIZE,
) -> list[list[float]]:
    """Generate embeddings for RAG chunks."""

    if not texts:
        return []

    if batch_size < 1:
        raise ValueError(
            "Batch size must be positive"
        )

    model = _model()

    prepared = _prepare_texts(
        texts,
        token_limit=MAX_DOCUMENT_TOKENS,
    )

    try:
        if hasattr(model, "encode_document"):
            vectors = model.encode_document(
                prepared,
                batch_size=batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        else:
            vectors = model.encode(
                prepared,
                batch_size=batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )

        return _validate_vectors(
            vectors,
            expected_count=len(prepared),
        )

    except Exception as exc:
        logger.exception(
            "Document embedding failed"
        )

        if isinstance(exc, EmbeddingError):
            raise

        raise EmbeddingError(
            "Document embedding generation failed"
        ) from exc


def embed_query(query: str) -> list[float]:
    """Generate an embedding for a search query."""

    model = _model()

    prepared = _prepare_texts(
        [query],
        token_limit=MAX_QUERY_TOKENS,
    )

    try:
        if hasattr(model, "encode_query"):
            vectors = model.encode_query(
                prepared,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        else:
            vectors = model.encode(
                prepared,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )

        return _validate_vectors(
            vectors,
            expected_count=1,
        )[0]

    except Exception as exc:
        logger.exception(
            "Query embedding failed"
        )

        if isinstance(exc, EmbeddingError):
            raise

        raise EmbeddingError(
            "Query embedding generation failed"
        ) from exc


def validate_embedding(
    embedding: Sequence[float],
) -> bool:
    try:
        vector = np.asarray(
            embedding,
            dtype=np.float32,
        )

        if vector.shape != (
            EMBEDDING_DIMENSIONS,
        ):
            return False

        if not np.isfinite(vector).all():
            return False

        return bool(
            np.isclose(
                np.linalg.norm(vector),
                1.0,
                atol=1e-3,
            )
        )

    except (TypeError, ValueError):
        return False
