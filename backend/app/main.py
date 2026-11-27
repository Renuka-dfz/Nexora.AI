
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine
from app.core.logging import configure_logging

from app.modules.company_knowledge.routes import (
    router as company_knowledge_router,
)

from app.modules.identity.routes import (
    router as identity_router,
    user_router,
)

from app.modules.lead_management.routes import (
    router as lead_management_router,
)

from app.modules.marketing.routes import (
    router as marketing_router,
)

from app.integrations.instagram.routes import (
    router as instagram_router,
)

from app.integrations.recraft.routes import (
    router as recraft_router,
)

from app.integrations.openrouter.routes import (
    router as openrouter_router,
)

from app.integrations.linkedin.routes import (
    router as linkedin_router,
)

from app.core.logger import setup_workflow_logging

configure_logging()
setup_workflow_logging()


# =====================================================
# FASTAPI APPLICATION
# =====================================================

app = FastAPI(
    title="Nexora.AI API",
    version="1.0.0",
)

# =====================================================
# CORS CONFIGURATION
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://172.20.64.1:5173",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist for serving generated images to Meta Graph API
_static_images_dir = os.path.join(os.getcwd(), "static", "generated_images")
os.makedirs(_static_images_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# =====================================================
# REGISTER API ROUTERS
# =====================================================

app.include_router(
    company_knowledge_router,
    prefix="/api/v1",
)

app.include_router(
    identity_router,
    prefix="/api/v1",
)

app.include_router(
    user_router,
    prefix="/api/v1",
)

app.include_router(
    marketing_router,
    prefix="/api/v1",
)

app.include_router(
    lead_management_router,
    prefix="/api/v1",
)

app.include_router(
    instagram_router,
    prefix="/api/v1",
)

app.include_router(
    recraft_router,
    prefix="/api/v1",
)

app.include_router(
    openrouter_router,
    prefix="/api/v1",
)

app.include_router(
    linkedin_router,
    prefix="/api/v1",
)


# =====================================================
# SYSTEM HEALTH
# =====================================================

@app.get(
    "/api/v1/health",
    tags=["System"],
)
def health():
    return {"status": "ok"}


# =====================================================
# DATABASE HEALTH
# =====================================================

@app.get(
    "/api/v1/health/db",
    tags=["System"],
)
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc

    return {
        "status": "ok",
        "database": "ready",
    }
