from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine
from app.modules.company_knowledge.routes import router as company_knowledge_router
from app.modules.identity.routes import router as identity_router
from app.modules.lead_management.routes import router as lead_management_router
from app.modules.marketing.routes import router as marketing_router

app = FastAPI(title="Nexora.AI API", version="1.0.0")
app.include_router(company_knowledge_router, prefix="/api/v1")
app.include_router(identity_router, prefix="/api/v1")
app.include_router(marketing_router, prefix="/api/v1")
app.include_router(lead_management_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["System"])
def health():
    return {"status": "ok"}


@app.get("/api/v1/health/db", tags=["System"])
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "database": "ready"}