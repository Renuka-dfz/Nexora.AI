import asyncio
import subprocess
import sys
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import crawl4ai
import httpx
from fastapi.testclient import TestClient
from httpx import Headers
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.modules.company_knowledge.models import (
    CrawledPage,
    DimCategory,
    DimSource,
    FactCompanyIntelligence,
    WebsiteCrawlJob,
)
from app.modules.company_knowledge.services.content_cleaning import (
    clean_and_split_page,
)
from app.modules.company_knowledge.services.website_crawler import (
    discover_and_extract,
)
from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
    ExtractedPage,
    ExtractedSection,
)
from app.modules.company_knowledge.services.persistence import (
    persist_crawl_output,
)
from app.modules.company_knowledge.services.output_validation import (
    validate_and_deduplicate,
)
from app.modules.company_knowledge.services import website_validation
from app.modules.company_knowledge.services.website_validation import (
    FetchedResponse,
    ValidatedWebsite,
    WebsiteValidationError,
)


engine = create_engine(
    "sqlite+pysqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(connection, _record):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def setup_function():
    Base.metadata.create_all(bind=engine)
    with TestingSessionLocal() as db:
        if db.get(DimCategory, 1) is None:
            db.add(DimCategory(category_id=1, category_name="Company Overview"))
            db.commit()


def teardown_function():
    Base.metadata.drop_all(bind=engine)


def test_crawl_worker_loads_and_updates_job_with_identity_metadata():
    worker_script = """
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.company_knowledge import tasks
assert "app_user" in Base.metadata.tables
from app.modules.company_knowledge.models import (
    DimCompany,
    DimCategory,
    DimSource,
    WebsiteCrawlJob,
)
from app.modules.identity.models import User
from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
    ExtractedPage,
    ExtractedSection,
)
from app.modules.company_knowledge.services.website_validation import (
    ValidatedWebsite,
)

assert User.__table__.metadata is Base.metadata
assert WebsiteCrawlJob.__table__.metadata is Base.metadata
assert Base.metadata.tables["app_user"] is User.__table__
Base.metadata.sorted_tables

engine = create_engine("sqlite+pysqlite:///:memory:")
Base.metadata.create_all(bind=engine)
WorkerSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
tasks.SessionLocal = WorkerSession

with WorkerSession() as db:
    company = DimCompany(company_name="Worker metadata regression")
    db.add(company)
    db.flush()
    user = User(
        company_id=company.company_id,
        email="worker-metadata@example.com",
        password_hash="test-hash",
        role="admin",
    )
    db.add(user)
    db.flush()
    source = DimSource(
        company_id=company.company_id,
        source_url="https://example.com/",
        source_type="website",
    )
    db.add(source)
    db.flush()
    db.add(DimCategory(category_name="Company Overview"))
    db.flush()
    job = WebsiteCrawlJob(
        company_id=company.company_id,
        source_id=source.source_id,
        requested_by=user.user_id,
        website_url="https://example.com/",
    )
    db.add(job)
    db.commit()
    job_id = job.job_id

async def validate(_url):
    return ValidatedWebsite(
        website_url="https://example.com/",
        host="example.com",
        sitemap_available=False,
        sitemap_urls=[],
        robots_text="",
    )

async def extract(_website):
    return CrawlPipelineOutput(
        pages=[
            ExtractedPage(
                page_url="https://example.com/about",
                title="About",
                raw_html="<h1>About</h1>",
                markdown_content="# About",
                sections=[
                    ExtractedSection(
                        category="Company Overview",
                        title="About",
                        content="Company details.",
                        source_url="https://example.com/about",
                        heading_path="About",
                        section_order=0,
                    )
                ],
            )
        ]
    )

tasks.validate_website = validate
tasks.discover_and_extract = extract
result = tasks.crawl_website_task.run(str(job_id))
assert result == {"job_id": str(job_id), "status": "completed"}
with WorkerSession() as db:
    job = db.get(WebsiteCrawlJob, job_id)
    assert job is not None
    assert job.status == "completed"
    assert job.pages_discovered == 1
    assert job.pages_processed == 1
    assert job.sections_saved == 1
"""
    backend_dir = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "-c", worker_script],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )

    assert result.returncode == 0, result.stdout + result.stderr


def auth_headers():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": f"{uuid4().hex}@example.com", "password": "valid-password-123"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_company_create_read_and_update():
    headers = auth_headers()
    response = client.post(
        "/api/v1/companies",
        json={
            "company_name": "Nexora",
            "website_url": "https://example.com",
            "industry": "Technology",
        },
        headers=headers,
    )
    assert response.status_code == 201
    company = response.json()

    read_response = client.get(
        f"/api/v1/companies/{company['company_id']}", headers=headers
    )
    assert read_response.status_code == 200
    assert read_response.json()["company_name"] == "Nexora"

    update_response = client.patch(
        f"/api/v1/companies/{company['company_id']}",
        json={"headquarters": "Seattle"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["headquarters"] == "Seattle"


def test_knowledge_crud_and_category_filter():
    headers = auth_headers()
    company_response = client.post(
        "/api/v1/companies",
        json={"company_name": "Nexora"},
        headers=headers,
    )
    company_id = company_response.json()["company_id"]

    categories = client.get(
        f"/api/v1/companies/{company_id}/knowledge/categories", headers=headers
    )
    assert categories.status_code == 200
    assert categories.json()["items"] == [
        {"category_id": 1, "category_name": "Company Overview"}
    ]
    assert categories.json()["total"] == 1

    source = client.post(
        f"/api/v1/companies/{company_id}/sources",
        json={"source_url": "https://example.com/about"},
        headers=headers,
    )
    assert source.status_code == 201

    created = client.post(
        f"/api/v1/companies/{company_id}/knowledge",
        json={
            "category_id": 1,
            "source_id": source.json()["source_id"],
            "title": "About us",
            "description": "Original description",
        },
        headers=headers,
    )
    assert created.status_code == 201
    fact_id = created.json()["fact_id"]
    assert created.json()["verification_status"] == "pending"

    listed = client.get(
        f"/api/v1/companies/{company_id}/knowledge?category_id=1",
        headers=headers,
    )
    assert listed.status_code == 200
    assert [fact["fact_id"] for fact in listed.json()["items"]] == [fact_id]
    assert listed.json()["total"] == 1

    updated = client.patch(
        f"/api/v1/companies/{company_id}/knowledge/{fact_id}",
        json={"description": None},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["description"] is None

    deleted = client.delete(
        f"/api/v1/companies/{company_id}/knowledge/{fact_id}", headers=headers
    )
    assert deleted.status_code == 204
    assert client.get(
        f"/api/v1/companies/{company_id}/knowledge", headers=headers
    ).json()["items"] == []


def test_unknown_company_and_category_errors():
    headers = auth_headers()
    missing_company = "3f0e226f-8307-40f7-821d-9e9375672ac5"
    assert client.get(
        f"/api/v1/companies/{missing_company}", headers=headers
    ).status_code == 404

    company_response = client.post(
        "/api/v1/companies",
        json={"company_name": "Nexora"},
        headers=headers,
    )
    company_id = company_response.json()["company_id"]
    unknown_category = client.post(
        f"/api/v1/companies/{company_id}/knowledge",
        json={
            "category_id": 999,
            "source_id": str(uuid4()),
            "title": "Unknown category",
        },
        headers=headers,
    )
    assert unknown_category.status_code == 422


def test_authentication_and_company_isolation():
    owner_headers = auth_headers()
    other_headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Owner company"},
        headers=owner_headers,
    ).json()

    assert client.get("/api/v1/auth/me", headers=owner_headers).status_code == 200
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": client.get("/api/v1/auth/me", headers=owner_headers).json()["email"],
            "password": "valid-password-123",
        },
    )
    assert login.status_code == 200
    assert client.get(
        f"/api/v1/companies/{company['company_id']}", headers=other_headers
    ).status_code == 403
    assert client.get(
        "/api/v1/categories", headers=owner_headers
    ).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "valid-password-123"},
    ).status_code == 401


def test_source_and_knowledge_verification_endpoints():
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Knowledge company"},
        headers=headers,
    ).json()
    company_id = company["company_id"]
    source_response = client.post(
        f"/api/v1/companies/{company_id}/sources",
        json={
            "source_url": "https://example.com/about",
            "source_type": "website",
            "page_title": "About",
        },
        headers=headers,
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["source_id"]
    assert client.get(
        f"/api/v1/companies/{company_id}/sources/{source_id}",
        headers=headers,
    ).status_code == 200
    assert client.post(
        f"/api/v1/companies/{company_id}/sources",
        json={"source_url": "https://example.com/about"},
        headers=headers,
    ).status_code == 409

    fact = client.post(
        f"/api/v1/companies/{company_id}/knowledge",
        json={
            "category_id": 1,
            "source_id": source_id,
            "title": "Company details",
        },
        headers=headers,
    ).json()
    verified = client.patch(
        f"/api/v1/companies/{company_id}/knowledge/{fact['fact_id']}/verification",
        json={"verification_status": "verified"},
        headers=headers,
    )
    assert verified.status_code == 200
    assert verified.json()["verification_status"] == "verified"
    assert len(client.get(
        f"/api/v1/companies/{company_id}/knowledge?verification_status=verified",
        headers=headers,
    ).json()["items"]) == 1


def test_marketing_content_workflow_and_social_metadata():
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Marketing company"},
        headers=headers,
    ).json()
    company_id = company["company_id"]
    content = client.post(
        "/api/v1/marketing/content",
        json={
            "company_id": company_id,
            "content_title": "Launch",
            "content_type": "post",
            "platform_target": "linkedin",
            "content_text": "A product announcement",
            "generation_type": "manual",
            "topic": "Launches",
        },
        headers=headers,
    )
    assert content.status_code == 201
    content_id = content.json()["content_id"]
    assert client.get(
        f"/api/v1/marketing/content/{content_id}", headers=headers
    ).status_code == 200
    assert client.get(
        f"/api/v1/marketing/content?company_id={company_id}&status=draft&platform=linkedin",
        headers=headers,
    ).json()["total"] == 1
    assert client.patch(
        f"/api/v1/marketing/content/{content_id}",
        json={"topic": None},
        headers=headers,
    ).status_code == 200
    submitted = client.post(
        f"/api/v1/marketing/content/{content_id}/submit",
        headers=headers,
    )
    assert submitted.status_code == 200
    approved = client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers=headers,
    )
    assert approved.status_code == 200
    assert approved.json()["approval_status"] == "approved"
    assert client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers=headers,
    ).status_code == 409

    account = client.post(
        "/api/v1/marketing/social-accounts",
        json={
            "company_id": company_id,
            "platform": "linkedin",
            "external_account_id": "account-1",
            "account_name": "Nexora",
        },
        headers=headers,
    )
    assert account.status_code == 201
    assert client.get(
        f"/api/v1/marketing/social-accounts?company_id={company_id}",
        headers=headers,
    ).status_code == 200
    assert client.get(
        f"/api/v1/marketing/social-accounts/{account.json()['social_account_id']}",
        headers=headers,
    ).status_code == 200
    assert client.patch(
        f"/api/v1/marketing/social-accounts/{account.json()['social_account_id']}",
        json={"account_name": "Nexora Social"},
        headers=headers,
    ).status_code == 200
    post_id = str(uuid4())
    snapshot = client.post(
        "/api/v1/marketing/performance",
        json={
            "company_id": company_id,
            "content_id": content_id,
            "social_account_id": account.json()["social_account_id"],
            "published_post_id": post_id,
            "collected_at": "2026-11-12T10:00:00+00:00",
            "likes": 4,
            "impressions": 100,
        },
        headers=headers,
    )
    assert snapshot.status_code == 201
    performance_id = snapshot.json()["performance_id"]
    assert client.get(
        f"/api/v1/marketing/performance/{performance_id}",
        headers=headers,
    ).status_code == 200
    assert client.get(
        f"/api/v1/marketing/posts/{post_id}/performance/latest",
        headers=headers,
    ).json()["performance_id"] == performance_id
    assert len(client.get(
        f"/api/v1/marketing/performance?company_id={company_id}",
        headers=headers,
    ).json()["items"]) == 1
    assert client.delete(
        f"/api/v1/marketing/social-accounts/{account.json()['social_account_id']}",
        headers=headers,
    ).status_code == 409


def test_lead_crud_and_qualification_history():
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Sales company"},
        headers=headers,
    ).json()
    company_id = company["company_id"]
    lead = client.post(
        "/api/v1/leads",
        json={
            "company_id": company_id,
            "full_name": "Example Lead",
            "email": "lead@example.com",
            "industry": "Technology",
        },
        headers=headers,
    )
    assert lead.status_code == 201
    lead_id = lead.json()["lead_id"]
    assert client.get(f"/api/v1/leads/{lead_id}", headers=headers).status_code == 200
    assert client.get(
        f"/api/v1/leads?company_id={company_id}&lead_status=active",
        headers=headers,
    ).json()["total"] == 1
    assert client.patch(
        f"/api/v1/leads/{lead_id}",
        json={"job_title": "Director"},
        headers=headers,
    ).status_code == 200
    source = client.post(
        "/api/v1/lead-sources",
        json={
            "company_id": company_id,
            "source_name": "Website",
            "source_type": "web",
        },
        headers=headers,
    )
    assert source.status_code == 201
    source_id = source.json()["source_id"]
    assert client.get(
        f"/api/v1/lead-sources?company_id={company_id}",
        headers=headers,
    ).json()["total"] == 1
    assert client.patch(
        f"/api/v1/lead-sources/{source_id}",
        json={"source_name": "Website inquiry"},
        headers=headers,
    ).status_code == 200
    qualification = client.post(
        f"/api/v1/leads/{lead_id}/qualifications",
        json={
            "source_id": source.json()["source_id"],
            "lead_score": 82,
            "confidence_score": 0.9,
            "intent_level": "high",
            "qualification_status": "qualified",
        },
        headers=headers,
    )
    assert qualification.status_code == 201
    qualification_id = qualification.json()["qualification_id"]
    assert len(client.get(
        f"/api/v1/leads/{lead_id}/qualifications", headers=headers
    ).json()["items"]) == 1
    assert client.get(
        f"/api/v1/lead-qualifications/{qualification_id}",
        headers=headers,
    ).status_code == 200
    assert client.get(
        f"/api/v1/leads/{lead_id}/qualifications/latest",
        headers=headers,
    ).json()["qualification_id"] == qualification_id
    assert client.patch(
        f"/api/v1/lead-qualifications/{qualification_id}",
        json={"recommended_action": "Call this week"},
        headers=headers,
    ).status_code == 200
    assert client.delete(
        f"/api/v1/leads/{lead_id}", headers=headers
    ).status_code == 409
    assert client.delete(
        f"/api/v1/lead-sources/{source_id}", headers=headers
    ).status_code == 409


def test_website_crawl_requires_admin_and_returns_job(monkeypatch):
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Crawl company"},
        headers=headers,
    ).json()
    company_id = company["company_id"]
    enqueued = []

    async def fake_validate(_website_url):
        return ValidatedWebsite(
            website_url="https://example.com/",
            host="example.com",
            sitemap_available=True,
            sitemap_urls=["https://example.com/about"],
            robots_text="User-agent: *\nAllow: /\n",
        )

    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.validate_website",
        fake_validate,
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.crawl_website_task.delay",
        lambda job_id: enqueued.append(job_id),
    )

    response = client.post(
        f"/api/v1/companies/{company_id}/website-crawls",
        json={"website_url": "https://example.com"},
        headers=headers,
    )
    assert response.status_code == 202
    job = response.json()
    assert job["status"] == "queued"
    assert job["sitemap_available"] is True
    assert enqueued == [job["job_id"]]

    status_response = client.get(
        f"/api/v1/companies/{company_id}/website-crawls/{job['job_id']}",
        headers=headers,
    )
    assert status_response.status_code == 200
    assert status_response.json()["job_id"] == job["job_id"]


def test_website_crawl_request_executes_worker_and_persists_results(
    monkeypatch,
    request,
):
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Worker integration company"},
        headers=headers,
    ).json()
    company_id = UUID(company["company_id"])
    enqueued = []
    validated = ValidatedWebsite(
        website_url="https://example.com/",
        host="example.com",
        sitemap_available=True,
        sitemap_urls=["https://example.com/about"],
        robots_text="User-agent: *\nAllow: /\n",
    )
    extracted = CrawlPipelineOutput(
        pages=[
            ExtractedPage(
                page_url="https://example.com/about",
                title="About Us",
                meta_description="What the company does",
                raw_html="<h1>About Us</h1><p>We build software.</p>",
                markdown_content="# About Us\n\nWe build software.",
                metadata={"content_hash": "b" * 64, "depth": 0},
                sections=[
                    ExtractedSection(
                        category="Company Overview",
                        title="About Us",
                        content="We build software.",
                        source_url="https://example.com/about",
                        heading_path="About Us",
                        section_order=0,
                    )
                ],
            )
        ]
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.validate_website",
        lambda _url: _async_return(validated),
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.tasks.validate_website",
        lambda _url: _async_return(validated),
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.tasks.discover_and_extract",
        lambda _website: _async_return(extracted),
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.tasks.SessionLocal",
        TestingSessionLocal,
    )
    temporary_output = tempfile.TemporaryDirectory(
        prefix="crawl-json-test-",
        dir=Path(__file__).parent,
    )
    request.addfinalizer(temporary_output.cleanup)
    artifact_dir = Path(temporary_output.name) / "crawl-json"
    monkeypatch.setattr(
        "app.modules.company_knowledge.tasks.settings.CRAWL_JSON_OUTPUT_DIR",
        artifact_dir,
    )
    persist_output = persist_crawl_output

    def persist_after_json_artifact(db, job, output):
        artifact_path = artifact_dir / f"{job.job_id}.json"
        assert artifact_path.is_file()
        return persist_output(db, job, output)

    monkeypatch.setattr(
        "app.modules.company_knowledge.tasks.persist_crawl_output",
        persist_after_json_artifact,
    )
    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.crawl_website_task.delay",
        lambda task_job_id: enqueued.append(task_job_id),
    )

    response = client.post(
        f"/api/v1/companies/{company_id}/website-crawls",
        json={"website_url": "https://example.com"},
        headers=headers,
    )
    assert response.status_code == 202
    job_id = UUID(response.json()["job_id"])
    assert enqueued == [str(job_id)]

    with TestingSessionLocal() as db:
        queued_job = db.get(WebsiteCrawlJob, job_id)
        assert queued_job is not None
        assert queued_job.status == "queued"

    from app.modules.company_knowledge.tasks import crawl_website_task

    result = crawl_website_task.run(str(job_id))
    assert result == {"job_id": str(job_id), "status": "completed"}
    artifact_path = artifact_dir / f"{job_id}.json"
    artifact = CrawlPipelineOutput.model_validate_json(
        artifact_path.read_text(encoding="utf-8")
    )
    assert artifact.pages[0].page_url == "https://example.com/about"
    assert artifact.pages[0].sections[0].content == "We build software."

    with TestingSessionLocal() as db:
        job = db.get(WebsiteCrawlJob, job_id)
        assert job is not None
        assert job.status == "completed"
        assert job.pages_discovered == 1
        assert job.pages_processed == 1
        assert job.sections_saved == 1
        assert job.started_at is not None
        assert job.finished_at is not None

        page = db.scalar(
            select(CrawledPage).where(
                CrawledPage.company_id == company_id,
                CrawledPage.page_url == "https://example.com/about",
            )
        )
        assert page is not None
        assert page.crawl_status == "success"
        assert page.raw_html.startswith("<h1>")
        assert page.markdown_content.startswith("# About Us")

        fact = db.scalar(
            select(FactCompanyIntelligence).where(
                FactCompanyIntelligence.page_id == page.page_id,
                FactCompanyIntelligence.is_current.is_(True),
            )
        )
        assert fact is not None
        assert fact.title == "About Us"
        assert fact.description == "We build software."
        assert fact.verification_status == "pending"


def test_website_crawl_checks_permissions_before_network(monkeypatch):
    owner_headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Private crawl company"},
        headers=owner_headers,
    ).json()
    other_user = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{uuid4().hex}@example.com",
            "password": "valid-password-123",
        },
    )
    other_headers = {
        "Authorization": f"Bearer {other_user.json()['access_token']}"
    }
    validation_called = []

    async def fake_validate(_website_url):
        validation_called.append(True)
        raise AssertionError("URL validation must not run for unauthorized users")

    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.validate_website",
        fake_validate,
    )
    response = client.post(
        f"/api/v1/companies/{company['company_id']}/website-crawls",
        json={"website_url": "https://example.com"},
        headers=other_headers,
    )
    assert response.status_code == 403
    assert validation_called == []


async def _async_return(value):
    return value


def test_website_validation_failure_does_not_create_job(monkeypatch):
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Restricted crawl company"},
        headers=headers,
    ).json()

    async def fake_validate(_website_url):
        raise WebsiteValidationError(
            "robots_disallowed",
            "Robots rules disallow all eligible pages.",
            403,
        )

    monkeypatch.setattr(
        "app.modules.company_knowledge.routes.validate_website",
        fake_validate,
    )
    response = client.post(
        f"/api/v1/companies/{company['company_id']}/website-crawls",
        json={"website_url": "https://example.com"},
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "robots_disallowed"
    with TestingSessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(WebsiteCrawlJob)) == 0


def test_cleaning_preserves_headings_and_classifies_sections():
    sections = clean_and_split_page(
        html=(
            "<html><head><title>Catalog</title></head><body>"
            "<script>secret()</script><h1>Products</h1>"
            "<p>Automation platform for teams.</p>"
            "<h2>Plans</h2><p>Pricing starts at ten dollars.</p>"
            "</body></html>"
        ),
        page_url="https://example.com/products",
        page_title="Catalog",
        meta_description="Product catalog",
    )
    assert len(sections) == 2
    assert sections[0].category == "Products"
    assert sections[0].heading_path == "Products"
    assert sections[1].category == "Pricing"
    assert "secret" not in " ".join(section.content for section in sections)


def test_website_validation_reads_robots_and_sitemap(monkeypatch):
    async def fake_ensure_public_url(url):
        return website_validation.canonicalize_url(url)

    async def fake_fetch(_client, url, **_kwargs):
        if url.endswith("/robots.txt"):
            return FetchedResponse(
                status_code=200,
                url=url,
                headers=Headers({"content-type": "text/plain"}),
                body=(
                    b"User-agent: *\nAllow: /\n"
                    b"Sitemap: https://example.com/sitemap.xml\n"
                ),
            )
        if url.endswith("/sitemap.xml"):
            return FetchedResponse(
                status_code=200,
                url=url,
                headers=Headers({"content-type": "application/xml"}),
                body=(
                    b"<urlset><url><loc>https://example.com/about</loc>"
                    b"</url></urlset>"
                ),
            )
        return FetchedResponse(
            status_code=200,
            url=url,
            headers=Headers({"content-type": "text/html"}),
            body=b"",
        )

    monkeypatch.setattr(
        website_validation,
        "ensure_public_url",
        fake_ensure_public_url,
    )
    monkeypatch.setattr(website_validation, "fetch_public_url", fake_fetch)

    result = asyncio.run(
        website_validation.validate_website("https://example.com")
    )
    assert result.sitemap_available is True
    assert result.sitemap_urls == ["https://example.com/about"]


def test_website_validation_rejects_robots_disallowed_site(monkeypatch):
    async def fake_ensure_public_url(url):
        return website_validation.canonicalize_url(url)

    async def fake_fetch(_client, url, **_kwargs):
        if url.endswith("/robots.txt"):
            return FetchedResponse(
                status_code=200,
                url=url,
                headers=Headers({"content-type": "text/plain"}),
                body=b"User-agent: *\nDisallow: /\n",
            )
        return FetchedResponse(
            status_code=404 if url.endswith("/sitemap.xml") else 200,
            url=url,
            headers=Headers({"content-type": "text/html"}),
            body=b"",
        )

    monkeypatch.setattr(
        website_validation,
        "ensure_public_url",
        fake_ensure_public_url,
    )
    monkeypatch.setattr(website_validation, "fetch_public_url", fake_fetch)

    with pytest.raises(WebsiteValidationError) as error:
        asyncio.run(website_validation.validate_website("https://example.com"))
    assert error.value.code == "no_eligible_pages"


def test_website_validation_reports_forbidden_homepage(monkeypatch):
    async def fake_ensure_public_url(url):
        return website_validation.canonicalize_url(url)

    async def fake_fetch(_client, url, **_kwargs):
        return FetchedResponse(
            status_code=403,
            url=url,
            headers=Headers({"content-type": "text/html"}),
            body=b"",
        )

    monkeypatch.setattr(
        website_validation,
        "ensure_public_url",
        fake_ensure_public_url,
    )
    monkeypatch.setattr(website_validation, "fetch_public_url", fake_fetch)

    with pytest.raises(WebsiteValidationError) as error:
        asyncio.run(website_validation.validate_website("https://example.com"))
    assert error.value.code == "website_forbidden"
    assert error.value.status_code == 403


def test_website_validation_rejects_private_ip():
    with pytest.raises(WebsiteValidationError) as error:
        asyncio.run(
            website_validation.ensure_public_url("http://127.0.0.1")
        )
    assert error.value.code == "unsafe_destination"


def test_http_validation_follows_only_same_site_redirects(monkeypatch):
    async def fake_ensure_public_url(url):
        return website_validation.canonicalize_url(url)

    monkeypatch.setattr(
        website_validation,
        "ensure_public_url",
        fake_ensure_public_url,
    )

    async def run_same_site_redirect():
        async def handler(request):
            if request.url.path == "/":
                return httpx.Response(302, headers={"location": "/home"})
            return httpx.Response(200, content=b"ok")

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            follow_redirects=False,
        ) as client:
            return await website_validation.fetch_public_url(
                client,
                "https://example.com",
                allowed_host="example.com",
            )

    same_site = asyncio.run(run_same_site_redirect())
    assert same_site.status_code == 200
    assert same_site.url == "https://example.com/home"

    async def run_cross_site_redirect():
        async def handler(_request):
            return httpx.Response(
                302,
                headers={"location": "https://other.example/home"},
            )

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            follow_redirects=False,
        ) as client:
            await website_validation.fetch_public_url(
                client,
                "https://example.com",
                allowed_host="example.com",
            )

    with pytest.raises(WebsiteValidationError) as error:
        asyncio.run(run_cross_site_redirect())
    assert error.value.code == "cross_site_redirect"


def test_crawl4ai_discovery_follows_only_internal_links(monkeypatch):
    class FakeCrawler:
        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback):
            return False

        async def arun(self, url, config):
            del config
            links = (
                {"internal": [{"href": "/about"}]}
                if url == "https://example.com/"
                else {"internal": [{"href": "https://outside.example/about"}]}
            )
            return type(
                "FakeCrawlResult",
                (),
                {
                    "url": url,
                    "redirected_url": None,
                    "success": True,
                    "status_code": 200,
                    "error_message": None,
                    "html": "<h1>About</h1><p>Company details.</p>",
                    "cleaned_html": "<h1>About</h1><p>Company details.</p>",
                    "markdown": "# About\n\nCompany details.",
                    "metadata": {"title": "About"},
                    "links": links,
                },
            )()

    async def fake_fetch_public_url(_client, url, **_kwargs):
        return FetchedResponse(
            status_code=200,
            url=url,
            headers=Headers({"content-type": "text/html"}),
            body=b"",
        )

    monkeypatch.setattr(crawl4ai, "AsyncWebCrawler", FakeCrawler)
    monkeypatch.setattr(
        "app.modules.company_knowledge.services.website_crawler.fetch_public_url",
        fake_fetch_public_url,
    )

    result = asyncio.run(
        discover_and_extract(
            ValidatedWebsite(
                website_url="https://example.com/",
                host="example.com",
                sitemap_available=False,
                sitemap_urls=[],
                robots_text="User-agent: *\nAllow: /\n",
            )
        )
    )
    assert [page.page_url for page in result.pages] == [
        "https://example.com/",
        "https://example.com/about",
    ]
    assert all(page.sections for page in result.pages)


def test_pipeline_output_deduplicates_pages_and_sections():
    section = ExtractedSection(
        category="Products",
        title="Products",
        content="Product details",
        source_url="https://example.com/products",
        heading_path="Products",
        section_order=0,
    )
    page = ExtractedPage(
        page_url="https://example.com/products#features",
        title="Products",
        sections=[section, section.model_copy()],
    )
    result = validate_and_deduplicate(
        CrawlPipelineOutput(pages=[page, page.model_copy(deep=True)]),
        allowed_host="example.com",
    )
    assert len(result.pages) == 1
    assert result.pages[0].page_url == "https://example.com/products"
    assert len(result.pages[0].sections) == 1


def test_crawl_persistence_upserts_sections_without_duplicates():
    headers = auth_headers()
    company = client.post(
        "/api/v1/companies",
        json={"company_name": "Persistence crawl company"},
        headers=headers,
    ).json()
    user = client.get("/api/v1/auth/me", headers=headers).json()
    company_id = UUID(company["company_id"])
    user_id = UUID(user["user_id"])

    with TestingSessionLocal() as db:
        category = db.scalar(
            select(DimCategory).where(
                DimCategory.category_name == "Products"
            )
        )
        if category is None:
            category = DimCategory(category_name="Products")
            db.add(category)
            db.flush()

        source = DimSource(
            company_id=company_id,
            source_url="https://example.com/",
            source_type="website",
        )
        db.add(source)
        db.flush()
        job = WebsiteCrawlJob(
            company_id=company_id,
            source_id=source.source_id,
            requested_by=user_id,
            website_url=source.source_url,
            status="running",
        )
        db.add(job)
        db.commit()

        def output(content):
            return CrawlPipelineOutput(
                pages=[
                    ExtractedPage(
                        page_url="https://example.com/products",
                        title="Products",
                        raw_html="<h1>Products</h1>",
                        markdown_content="# Products",
                        metadata={"content_hash": "a" * 64},
                        sections=[
                            ExtractedSection(
                                category="Products",
                                title="Products",
                                content=content,
                                source_url="https://example.com/products",
                                heading_path="Products",
                                section_order=0,
                            )
                        ],
                    )
                ]
            )

        persist_crawl_output(db, job, output("Original product details"))
        persist_crawl_output(db, job, output("Updated product details"))

        page = db.scalar(
            select(CrawledPage).where(
                CrawledPage.company_id == company_id,
                CrawledPage.page_url == "https://example.com/products",
            )
        )
        facts = db.scalars(
            select(FactCompanyIntelligence).where(
                FactCompanyIntelligence.page_id == page.page_id,
                FactCompanyIntelligence.is_current.is_(True),
            )
        ).all()
        assert len(facts) == 1
        assert facts[0].description == "Updated product details"
        assert job.status == "completed"
        assert job.sections_saved == 1
