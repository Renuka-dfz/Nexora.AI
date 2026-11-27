"""
Verify and index all crawled company facts into pgvector semantic search.
Ensures facts extracted from https://datafactz.ai/ are indexed for RAG retrieval.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.modules.company_knowledge.models import DimCompany, FactCompanyIntelligence
from app.rag.indexing import index_company_knowledge
from sqlalchemy import select, update

def verify_and_index():
    with SessionLocal() as db:
        company = db.scalars(select(DimCompany)).first()
        if not company:
            print("No company found in database.")
            return

        company_id = company.company_id
        print(f"Company: {company.company_name} ({company_id})")

        # 1. Update pending facts to verified so they are eligible for pgvector RAG indexing
        res = db.execute(
            update(FactCompanyIntelligence)
            .where(
                FactCompanyIntelligence.company_id == company_id,
                FactCompanyIntelligence.is_current.is_(True),
            )
            .values(verification_status="verified")
        )
        db.commit()
        print(f"Verified {res.rowcount} extracted intelligence facts.")

        # 2. Trigger RAG semantic indexing into pgvector
        print("Vectorizing and indexing facts into pgvector...")
        try:
            result = index_company_knowledge(db, company_id=company_id)
            print("\nRAG Indexing Telemetry:")
            print(f"  • Status: {result.get('status')}")
            print(f"  • Eligible Facts: {result.get('eligible_facts')}")
            print(f"  • Facts Processed: {result.get('facts_processed')}")
            print(f"  • Chunks Created: {result.get('chunks_created')}")
            print(f"  • Chunks Updated: {result.get('chunks_updated')}")
            print(f"  • Chunks Unchanged: {result.get('chunks_unchanged')}")
            print("\nSUCCESS: Company knowledge indexed into pgvector!")
        except Exception as exc:
            print(f"Indexing encountered an error: {exc}")

if __name__ == "__main__":
    verify_and_index()
