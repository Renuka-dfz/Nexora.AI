
"""RAGAS evaluation for Nexora.AI.

Uses a local Ollama model as the evaluation judge.

Evaluation is offline and must not be used
as the sole production safety gate.
"""

from __future__ import annotations

import logging
import math
import os
from dataclasses import asdict, dataclass
from typing import Sequence

from openai import OpenAI
from ragas.llms import llm_factory
from ragas.metrics.collections import (
    ContextPrecision,
    ContextRecall,
    Faithfulness,
)


logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://localhost:11434/v1"

# Use the exact name returned by `ollama list`.
DEFAULT_JUDGE_MODEL = "qwen3.5:4b"


@dataclass(frozen=True)
class RagasEvalCase:
    question: str
    generated_answer: str
    retrieved_contexts: tuple[str, ...]
    reference_answer: str


@dataclass(frozen=True)
class RagasEvalResult:
    faithfulness: float
    context_precision: float
    context_recall: float
    judge_model: str
    passed: bool


def _validate_case(
    case: RagasEvalCase,
) -> None:
    if not case.question.strip():
        raise ValueError("Question cannot be empty")

    if not case.generated_answer.strip():
        raise ValueError(
            "Generated answer cannot be empty"
        )

    if not case.reference_answer.strip():
        raise ValueError(
            "Human-reviewed reference answer required"
        )

    if not case.retrieved_contexts:
        raise ValueError(
            "Retrieved contexts cannot be empty"
        )

    if any(
        not context.strip()
        for context in case.retrieved_contexts
    ):
        raise ValueError(
            "Retrieved contexts contain empty passages"
        )


def _validated_score(
    value: float,
    metric_name: str,
) -> float:
    score = float(value)

    if not math.isfinite(score):
        raise RuntimeError(
            f"{metric_name} returned a non-finite score"
        )

    if not 0.0 <= score <= 1.0:
        raise RuntimeError(
            f"{metric_name} returned an invalid score"
        )

    return score


def create_judge(
    *,
    model_name: str | None = None,
    base_url: str | None = None,
):
    """
    Create an explicitly local Ollama evaluation judge.

    Do not send private company documents to an
    external evaluator without authorization.
    """

    model = (
        model_name
        or os.getenv(
            "RAGAS_JUDGE_MODEL",
            DEFAULT_JUDGE_MODEL,
        )
    )

    url = (
        base_url
        or os.getenv(
            "OLLAMA_OPENAI_BASE_URL",
            DEFAULT_OLLAMA_URL,
        )
    )

    # Fail closed if the evaluator endpoint is
    # accidentally configured as a remote API.
    if not (
        url.startswith("http://localhost:")
        or url.startswith("http://127.0.0.1:")
    ):
        raise ValueError(
            "Only local Ollama endpoints are allowed "
            "by this evaluation configuration."
        )

    client = OpenAI(
        api_key="ollama",
        base_url=url,
        timeout=120.0,
        max_retries=1,
    )

    judge = llm_factory(
        model,
        provider="openai",
        client=client,
    )

    return judge, model


def evaluate_rag_answer(
    *,
    case: RagasEvalCase,
    min_faithfulness: float = 0.90,
    min_context_precision: float = 0.80,
    min_context_recall: float = 0.80,
    model_name: str | None = None,
) -> RagasEvalResult:
    """Evaluate one RAG question-answer interaction."""

    _validate_case(case)

    for threshold in (
        min_faithfulness,
        min_context_precision,
        min_context_recall,
    ):
        if not 0.0 <= threshold <= 1.0:
            raise ValueError(
                "Metric thresholds must be between 0 and 1"
            )

    judge, selected_model = create_judge(
        model_name=model_name
    )

    faithfulness_metric = Faithfulness(
        llm=judge
    )

    context_precision_metric = ContextPrecision(
        llm=judge
    )

    context_recall_metric = ContextRecall(
        llm=judge
    )

    contexts = list(case.retrieved_contexts)

    try:
        faithfulness_result = (
            faithfulness_metric.score(
                user_input=case.question,
                response=case.generated_answer,
                retrieved_contexts=contexts,
            )
        )

        precision_result = (
            context_precision_metric.score(
                user_input=case.question,
                reference=case.reference_answer,
                retrieved_contexts=contexts,
            )
        )

        recall_result = (
            context_recall_metric.score(
                user_input=case.question,
                reference=case.reference_answer,
                retrieved_contexts=contexts,
            )
        )

        faithfulness = _validated_score(
            faithfulness_result.value,
            "faithfulness",
        )

        precision = _validated_score(
            precision_result.value,
            "context_precision",
        )

        recall = _validated_score(
            recall_result.value,
            "context_recall",
        )

    except Exception:
        logger.exception(
            "RAGAS evaluation failed"
        )
        raise

    passed = (
        faithfulness >= min_faithfulness
        and precision >= min_context_precision
        and recall >= min_context_recall
    )

    return RagasEvalResult(
        faithfulness=faithfulness,
        context_precision=precision,
        context_recall=recall,
        judge_model=selected_model,
        passed=passed,
    )


def evaluate_rag_dataset(
    cases: Sequence[RagasEvalCase],
    *,
    model_name: str | None = None,
) -> list[dict]:
    """Evaluate a small offline benchmark dataset."""

    if not cases:
        raise ValueError(
            "Evaluation cases cannot be empty"
        )

    reports = []

    for index, case in enumerate(cases):
        result = evaluate_rag_answer(
            case=case,
            model_name=model_name,
        )

        reports.append(
            {
                "case_index": index,
                "question": case.question,
                **asdict(result),
            }
        )

    return reports
