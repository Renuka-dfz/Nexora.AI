from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.modules.company_knowledge.models import DimCategory


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
