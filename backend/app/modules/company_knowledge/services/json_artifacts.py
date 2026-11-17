from pathlib import Path
from uuid import UUID, uuid4

from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
)


def save_validated_crawl_json(
    output: CrawlPipelineOutput,
    *,
    job_id: UUID,
    output_dir: Path,
) -> tuple[CrawlPipelineOutput, Path]:
    serialized = output.model_dump_json(indent=2)
    validated = CrawlPipelineOutput.model_validate_json(serialized)

    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / f"{job_id}.json"
    temporary_path = output_dir / f".{job_id}.{uuid4().hex}.tmp"
    try:
        with temporary_path.open("x", encoding="utf-8", newline="\n") as artifact:
            artifact.write(serialized)
            artifact.write("\n")
        temporary_path.replace(artifact_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    return validated, artifact_path
