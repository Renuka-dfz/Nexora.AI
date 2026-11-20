"""
Nexora.AI - Comprehensive End-to-End Workflow Logger.
Provides real-time terminal tracing, rotating file persistence, and structured agent telemetry.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOGS_DIR = PROJECT_ROOT / "logs"
LOG_FILE_PATH = LOGS_DIR / "nexora_workflow.log"
JSON_LOG_FILE_PATH = LOGS_DIR / "nexora_telemetry.jsonl"


# ANSI Color Codes for Terminal Output
class TerminalColors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    RED = "\033[31m"
    WHITE = "\033[37m"
    BG_DARK = "\033[40m"


class ConsoleWorkflowFormatter(logging.Formatter):
    """Clean, high-visibility human-readable console formatter."""

    LEVEL_COLORS = {
        logging.DEBUG: TerminalColors.DIM + TerminalColors.WHITE,
        logging.INFO: TerminalColors.CYAN,
        logging.WARNING: TerminalColors.YELLOW,
        logging.ERROR: TerminalColors.RED + TerminalColors.BOLD,
        logging.CRITICAL: TerminalColors.RED + TerminalColors.BOLD,
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.LEVEL_COLORS.get(record.levelno, TerminalColors.WHITE)
        timestamp = datetime.fromtimestamp(record.created, timezone.utc).strftime("%H:%M:%S.%f")[:-3]
        level_label = f"[{record.levelname[:4]}]"

        # Special formatting for workflow events
        is_workflow = getattr(record, "is_workflow", False)
        prefix = f"{TerminalColors.DIM}{timestamp}{TerminalColors.RESET} {color}{level_label}{TerminalColors.RESET}"

        if is_workflow:
            return f"{prefix} {TerminalColors.BOLD}{record.getMessage()}{TerminalColors.RESET}"
        return f"{prefix} [{record.name}] {record.getMessage()}"


class JsonWorkflowFormatter(logging.Formatter):
    """Structured JSON formatter for telemetry, file loggers, and audit trails."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Include custom workflow metadata
        for key in ("workflow_id", "stage", "topic", "platform", "duration_ms", "status", "company_id"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = str(val)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class FlushingStreamHandler(logging.StreamHandler):
    """Ensures each log record is instantly flushed to the terminal stream."""
    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()


def setup_workflow_logging(log_level: int = logging.INFO) -> logging.Logger:
    """Initialize dedicated workflow logger with high-visibility terminal and file handlers."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    wf_logger = logging.getLogger("nexora.workflow")
    wf_logger.setLevel(log_level)
    wf_logger.propagate = False  # Avoid duplicates while guaranteeing direct terminal streaming

    # Check existing handlers on wf_logger to avoid duplicates on hot-reload
    has_console = any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler)
        for h in wf_logger.handlers
    )
    if not has_console:
        # 1. Console Handler (Colorized Live Terminal View)
        console_handler = FlushingStreamHandler(sys.stdout)
        console_handler.setFormatter(ConsoleWorkflowFormatter())
        console_handler.setLevel(log_level)
        wf_logger.addHandler(console_handler)

    has_file = any(
        isinstance(h, RotatingFileHandler) and "nexora_workflow.log" in str(getattr(h, "baseFilename", ""))
        for h in wf_logger.handlers
    )
    if not has_file:
        # 2. Rotating Text File Handler (logs/nexora_workflow.log)
        file_handler = RotatingFileHandler(
            LOG_FILE_PATH,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_formatter = logging.Formatter(
            "%(asctime)s.%(msecs)03d [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(logging.DEBUG)
        wf_logger.addHandler(file_handler)

    has_json = any(
        isinstance(h, RotatingFileHandler) and "nexora_telemetry.jsonl" in str(getattr(h, "baseFilename", ""))
        for h in wf_logger.handlers
    )
    if not has_json:
        # 3. Rotating JSONL Handler (logs/nexora_telemetry.jsonl)
        json_handler = RotatingFileHandler(
            JSON_LOG_FILE_PATH,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        json_handler.setFormatter(JsonWorkflowFormatter())
        json_handler.setLevel(logging.INFO)
        wf_logger.addHandler(json_handler)

    return wf_logger


class WorkflowLogger:
    """High-level structured logger for tracing agent executions end-to-end."""

    def __init__(self, logger_name: str = "nexora.workflow") -> None:
        self.logger = setup_workflow_logging()

    def banner(self, title: str, character: str = "=") -> None:
        border = character * 78
        self.logger.info(border, extra={"is_workflow": True})
        self.logger.info(f"  {title.upper()}", extra={"is_workflow": True})
        self.logger.info(border, extra={"is_workflow": True})

    def start_pipeline(
        self,
        *,
        workflow_name: str,
        topic: str,
        platform: str,
        format_type: str,
        company_id: Optional[Any] = None,
    ) -> float:
        """Log pipeline start and return initial timestamp."""
        start_time = time.perf_counter()
        self.banner(f"STARTING {workflow_name.upper()} WORKFLOW")
        self.logger.info(
            f"🎯 Target: '{topic}' | Platform: {platform.upper()} | Format: {format_type.upper()} | Company: {company_id or 'DataFactZ'}",
            extra={"is_workflow": True, "topic": topic, "platform": platform},
        )
        return start_time

    def stage(self, stage_number: int, stage_name: str, details: str, status: str = "IN_PROGRESS") -> None:
        """Log distinct workflow stage progress."""
        icon = {
            1: "🔍",
            2: "📚",
            3: "🧠",
            4: "🛡️",
            5: "💾",
            6: "🚀",
        }.get(stage_number, "⚙️")

        self.logger.info(
            f"{icon} [STAGE {stage_number}: {stage_name.upper()}] Status: {status}\n   ↳ {details}",
            extra={"is_workflow": True, "stage": stage_name},
        )

    def rag_retrieval(
        self,
        *,
        mode: str,
        facts_count: int,
        chunks_count: int,
        sources: list[str],
    ) -> None:
        """Log pgvector and structured knowledge grounding metrics."""
        source_summary = ", ".join(sources[:3]) if sources else "Default Grounded Index"
        self.logger.info(
            f"📚 [RAG KNOWLEDGE RETRIEVAL]\n"
            f"   • Mode: {mode.upper()} Grounding\n"
            f"   • Verified Facts Retrieved: {facts_count}\n"
            f"   • Semantic pgvector Chunks: {chunks_count}\n"
            f"   • Primary Sources: {source_summary}",
            extra={"is_workflow": True},
        )

    def safeguardrail_audit(
        self,
        *,
        passed: bool,
        grounding_score: float,
        findings_count: int,
        warnings: list[str],
    ) -> None:
        """Log deterministic safety and factual grounding audit results."""
        status_text = "PASSED" if passed else "WARNINGS NOTED"
        color_prefix = "✅" if passed else "⚠️"
        warn_text = f" ({len(warnings)} non-blocking warnings)" if warnings else " (Zero critical issues)"

        self.logger.info(
            f"{color_prefix} [SAFEGUARDRAILS & AUDIT] Validation {status_text}{warn_text}\n"
            f"   • Grounding Score: {grounding_score * 100:.1f}%\n"
            f"   • Checks Executed: {findings_count}",
            extra={"is_workflow": True},
        )

    def complete_pipeline(
        self,
        *,
        workflow_name: str,
        start_time: float,
        content_id: Optional[Any],
        status: str = "DRAFT_SAVED",
    ) -> None:
        """Log pipeline completion and duration."""
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        self.logger.info(
            f"✨ [WORKFLOW COMPLETE] {workflow_name.upper()} finished in {elapsed_ms:,.1f}ms\n"
            f"   • Output Content ID: {content_id}\n"
            f"   • Final Status: {status}\n"
            f"   • Persistent Logs Saved: {LOG_FILE_PATH}",
            extra={"is_workflow": True, "duration_ms": elapsed_ms, "status": status},
        )
        self.banner("WORKFLOW SUCCEEDED", character="-")

    def error_pipeline(
        self,
        *,
        workflow_name: str,
        start_time: float,
        error_message: str,
        stage: str,
    ) -> None:
        """Log pipeline failure with stage context."""
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        self.logger.error(
            f"❌ [WORKFLOW FAILED] {workflow_name.upper()} halted at Stage: '{stage}' ({elapsed_ms:,.1f}ms)\n"
            f"   • Error Detail: {error_message}",
            extra={"is_workflow": True, "stage": stage, "status": "FAILED"},
        )
        self.banner("WORKFLOW HALTED ON ERROR", character="!")


# Global singleton workflow logger
workflow_logger = WorkflowLogger()


def get_logger(name: str = "nexora") -> logging.Logger:
    """Standard logger factory function."""
    return logging.getLogger(name)
