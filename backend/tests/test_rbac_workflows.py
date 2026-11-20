import uuid
from datetime import datetime, timedelta, timezone
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.modules.company_knowledge.models import DimCategory, DimCompany
from app.modules.identity.models import User
from app.modules.marketing.models import DimContent

# Use an in-memory SQLite database for deterministic, isolated security testing
test_engine = create_engine(
    "sqlite+pysqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def enable_sqlite_foreign_keys(connection, _record):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    with TestingSessionLocal() as db:
        if db.get(DimCategory, 1) is None:
            db.add(DimCategory(category_id=1, category_name="Company Overview"))
            db.commit()
    yield
    Base.metadata.drop_all(bind=test_engine)


# ============================================================
# 1. USER REGISTRATION & LOGIN
# ============================================================
def test_user_registration_and_login_success():
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "founder@example.com", "password": "SecurePassword123!"},
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "founder@example.com"
    assert reg_data["user"]["role"] == "user"
    assert reg_data["user"]["company_id"] is None

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "founder@example.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


# ============================================================
# 2. INVALID PASSWORDS & EXPIRED JWTS
# ============================================================
def test_invalid_password_returns_401():
    client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "CorrectPassword123!"},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "WrongPassword123!"},
    )
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_expired_jwt_returns_401():
    now = datetime.now(timezone.utc) - timedelta(hours=2)
    expired_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "iat": now, "exp": now + timedelta(minutes=10)},
        settings.JWT_SECRET_KEY,
        algorithm="HS256",
    )
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401


# ============================================================
# 3. ONBOARDING & ADMIN ASSIGNMENT
# ============================================================
def test_company_onboarding_assigns_admin_role():
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "founder@startup.com", "password": "Password123!"},
    )
    token = reg_res.json()["access_token"]

    onboard_res = client.post(
        "/api/v1/companies",
        json={"company_name": "Acme Innovations", "website_url": "https://acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert onboard_res.status_code == 201
    company_id = onboard_res.json()["company_id"]

    # Verify user is now Admin of that company
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me = me_res.json()
    assert me["role"] == "admin"
    assert me["company_id"] == company_id


# ============================================================
# 4. PREVENT MULTIPLE ONBOARDINGS & UNAUTHORIZED ADMIN ASSIGNMENT
# ============================================================
def test_cannot_onboard_multiple_companies():
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "founder@startup.com", "password": "Password123!"},
    )
    token = reg_res.json()["access_token"]

    client.post(
        "/api/v1/companies",
        json={"company_name": "Company One", "website_url": "https://c1.com"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Attempt second company creation
    res2 = client.post(
        "/api/v1/companies",
        json={"company_name": "Company Two", "website_url": "https://c2.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code in (403, 409)


# ============================================================
# 5. TENANT ISOLATION (COMPANY A ACCESSING COMPANY B)
# ============================================================
def test_company_a_cannot_access_company_b():
    # Setup Company A
    reg_a = client.post(
        "/api/v1/auth/register",
        json={"email": "admin_a@companya.com", "password": "Password123!"},
    ).json()
    onboard_a = client.post(
        "/api/v1/companies",
        json={"company_name": "Company A"},
        headers={"Authorization": f"Bearer {reg_a['access_token']}"},
    ).json()
    comp_a_id = onboard_a["company_id"]

    # Setup Company B
    reg_b = client.post(
        "/api/v1/auth/register",
        json={"email": "admin_b@companyb.com", "password": "Password123!"},
    ).json()
    onboard_b = client.post(
        "/api/v1/companies",
        json={"company_name": "Company B"},
        headers={"Authorization": f"Bearer {reg_b['access_token']}"},
    ).json()
    comp_b_id = onboard_b["company_id"]

    # Admin A attempts to access Company B details
    res = client.get(
        f"/api/v1/companies/{comp_b_id}",
        headers={"Authorization": f"Bearer {reg_a['access_token']}"},
    )
    assert res.status_code == 403


# ============================================================
# 6. ROLE PERMISSIONS: CREATOR CANNOT APPROVE CONTENT
# ============================================================
def test_creator_cannot_approve_content():
    # Setup Admin and Creator in same company
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@team.com", "password": "Password123!"},
    ).json()
    onboard = client.post(
        "/api/v1/companies",
        json={"company_name": "Team Co"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()
    company_id = onboard["company_id"]

    # Create Creator via invite
    inv_res = client.post(
        "/api/v1/users/invite",
        json={"email": "creator@team.com", "role": "user"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )
    assert inv_res.status_code == 201
    token = inv_res.json()["invitation_token"]

    acc_res = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": token, "password": "CreatorPass123!"},
    )
    assert acc_res.status_code == 201
    creator_token = acc_res.json()["access_token"]

    # Creator creates draft and submits it
    draft_res = client.post(
        "/api/v1/marketing/content",
        json={
            "company_id": company_id,
            "content_title": "AI in Finance",
            "content_type": "post",
            "platform_target": "linkedin",
            "content_text": "Great insights on AI...",
            "generation_type": "manual",
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert draft_res.status_code == 201
    content_id = draft_res.json()["content_id"]

    # Creator submits draft
    sub_res = client.post(
        f"/api/v1/marketing/content/{content_id}/submit",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["approval_status"] == "pending"

    # Creator attempts to approve draft -> MUST RETURN 403
    app_res = client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert app_res.status_code == 403


# ============================================================
# 7. ROLE PERMISSIONS: REVIEWER CAN APPROVE BUT NOT GENERATE AI
# ============================================================
def test_reviewer_can_approve_but_cannot_generate_content():
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@revteam.com", "password": "Password123!"},
    ).json()
    onboard = client.post(
        "/api/v1/companies",
        json={"company_name": "Reviewer Co"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()
    company_id = onboard["company_id"]

    # Invite Reviewer
    inv_res = client.post(
        "/api/v1/users/invite",
        json={"email": "reviewer@revteam.com", "role": "reviewer"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )
    rev_acc = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv_res.json()["invitation_token"], "password": "ReviewerPass123!"},
    )
    rev_token = rev_acc.json()["access_token"]

    # Reviewer attempts AI content generation -> MUST RETURN 403
    gen_res = client.post(
        "/api/v1/marketing/content/generate",
        json={"topic": "Deep Learning Trends", "platform": "linkedin"},
        headers={"Authorization": f"Bearer {rev_token}"},
    )
    assert gen_res.status_code == 403

    # Admin creates and submits a draft
    draft_res = client.post(
        "/api/v1/marketing/content",
        json={
            "company_id": company_id,
            "content_title": "Enterprise Cloud",
            "content_type": "post",
            "platform_target": "linkedin",
            "content_text": "Cloud architectures for scale.",
            "generation_type": "manual",
        },
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )
    content_id = draft_res.json()["content_id"]
    client.post(
        f"/api/v1/marketing/content/{content_id}/submit",
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )

    # Reviewer approves pending content -> MUST SUCCEED
    app_res = client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers={"Authorization": f"Bearer {rev_token}"},
    )
    assert app_res.status_code == 200
    assert app_res.json()["approval_status"] == "approved"


# ============================================================
# 8. DEACTIVATED USER API ACCESS
# ============================================================
def test_deactivated_user_cannot_authenticate():
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "lead@corp.com", "password": "Password123!"},
    ).json()
    client.post(
        "/api/v1/companies",
        json={"company_name": "Corp"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )

    inv = client.post(
        "/api/v1/users/invite",
        json={"email": "member@corp.com", "role": "user"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()

    acc = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv["invitation_token"], "password": "Password123!"},
    ).json()
    user_id = acc["user"]["user_id"]
    user_token = acc["access_token"]

    # Admin deactivates the user
    deact_res = client.patch(
        f"/api/v1/users/{user_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )
    assert deact_res.status_code == 200

    # Deactivated user attempts access -> MUST RETURN 401
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert me_res.status_code == 401


# ============================================================
# 9. INVITATION EXPIRATION & REPLAY ATTACK PREVENTION
# ============================================================
def test_invitation_single_use_and_expiration():
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@invtest.com", "password": "Password123!"},
    ).json()
    client.post(
        "/api/v1/companies",
        json={"company_name": "InvTest"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    )

    inv = client.post(
        "/api/v1/users/invite",
        json={"email": "newbie@invtest.com", "role": "user"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()

    # First accept works
    acc1 = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv["invitation_token"], "password": "FirstPassword123!"},
    )
    assert acc1.status_code == 201

    # Second accept replay -> MUST RETURN 409
    acc2 = client.post(
        "/api/v1/auth/invitations/accept",
        json={"token": inv["invitation_token"], "password": "SecondPassword123!"},
    )
    assert acc2.status_code == 409


# ============================================================
# 10. APPROVAL WORKFLOW: DRAFT -> PENDING -> APPROVED
# ============================================================
def test_content_state_transitions_and_rejection_feedback():
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@workflow.com", "password": "Password123!"},
    ).json()
    onboard = client.post(
        "/api/v1/companies",
        json={"company_name": "Workflow Co"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()
    company_id = onboard["company_id"]
    token = admin_reg["access_token"]

    draft = client.post(
        "/api/v1/marketing/content",
        json={
            "company_id": company_id,
            "content_title": "Workflow Post",
            "content_type": "post",
            "platform_target": "linkedin",
            "content_text": "Testing transitions",
            "generation_type": "manual",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    content_id = draft["content_id"]

    # Direct approval from draft -> MUST FAIL (409)
    bad_app = client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_app.status_code == 409

    # Submit to pending -> SUCCEEDS
    sub = client.post(
        f"/api/v1/marketing/content/{content_id}/submit",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sub.status_code == 200
    assert sub.json()["approval_status"] == "pending"

    # Rejection without feedback -> MUST FAIL (422)
    bad_rej = client.post(
        f"/api/v1/marketing/content/{content_id}/reject",
        json={"feedback": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_rej.status_code == 422

    # Rejection with valid feedback -> SUCCEEDS
    good_rej = client.post(
        f"/api/v1/marketing/content/{content_id}/reject",
        json={"feedback": "Tone is too casual. Please refine."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert good_rej.status_code == 200
    assert good_rej.json()["approval_status"] == "rejected"


# ============================================================
# 11. EDITING APPROVED CONTENT INVALIDATES APPROVAL -> DRAFT
# ============================================================
def test_editing_approved_content_resets_to_draft():
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@invalidate.com", "password": "Password123!"},
    ).json()
    onboard = client.post(
        "/api/v1/companies",
        json={"company_name": "Invalidate Co"},
        headers={"Authorization": f"Bearer {admin_reg['access_token']}"},
    ).json()
    company_id = onboard["company_id"]
    token = admin_reg["access_token"]

    draft = client.post(
        "/api/v1/marketing/content",
        json={
            "company_id": company_id,
            "content_title": "Original Post",
            "content_type": "post",
            "platform_target": "linkedin",
            "content_text": "Original text.",
            "generation_type": "manual",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    content_id = draft["content_id"]

    # Submit & Approve
    client.post(
        f"/api/v1/marketing/content/{content_id}/submit",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        f"/api/v1/marketing/content/{content_id}/approve",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Edit approved content
    edit_res = client.patch(
        f"/api/v1/marketing/content/{content_id}",
        json={"content_text": "Revised updated text."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit_res.status_code == 200
    updated = edit_res.json()
    # Approval MUST BE INVALIDATED back to draft
    assert updated["approval_status"] == "draft"
    assert updated["content_text"] == "Revised updated text."
