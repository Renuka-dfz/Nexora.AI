"""
Trigger a fresh crawl for DataFactZ (https://datafactz.ai/) and verify extraction.
Can run synchronously in the terminal so you can observe live crawl progress.
"""
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.modules.company_knowledge.models import DimCompany, WebsiteCrawlJob, DimSource, DimCategory
from app.modules.company_knowledge.tasks import crawl_website_task
from sqlalchemy import select

def run_datafactz_crawl():
    CATEGORY_NAMES = (
        "Company Overview", "Services", "Products", "Technology Stack",
        "Projects", "Innovations and Research", "Brand Identities",
        "Knowledge Resources", "Case Studies", "Achievements",
        "Industry Expertise", "Customers",
    )

    with SessionLocal() as db:
        # 1. Ensure categories are seeded
        seeded_count = 0
        for name in CATEGORY_NAMES:
            cat = db.scalar(select(DimCategory).where(DimCategory.category_name == name))
            if not cat:
                db.add(DimCategory(category_name=name))
                seeded_count += 1
        if seeded_count > 0:
            db.commit()
            print(f"Seeded {seeded_count} standard knowledge categories in dim_category.")

        # 2. Get company
        company = db.scalars(select(DimCompany)).first()
        if not company:
            print("Error: No company found in DB.")
            return

        company_id = company.company_id
        website_url = company.website_url or "https://datafactz.ai/"
        company.website_url = website_url

        # 3. Ensure DimSource exists for this website
        source = db.scalar(
            select(DimSource).where(
                DimSource.company_id == company_id,
                DimSource.source_type == "website",
            )
        )
        if not source:
            source = DimSource(
                company_id=company_id,
                source_url=website_url,
                source_type="website",
            )
            db.add(source)
            db.commit()
            db.refresh(source)

        # 4. Create new crawl job with proper source_id
        job = WebsiteCrawlJob(
            company_id=company_id,
            source_id=source.source_id,
            website_url=website_url,
            status="queued",
            created_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = str(job.job_id)
        print(f"Created crawl job: {job_id} for {website_url} (Company: {company.company_name})")

    print("\nStarting crawl task execution (extracting pages & markdown via Crawl4AI)...")
    try:
        # Run directly to see progress and logs in real time
        result = crawl_website_task(job_id)
        print(f"\nCrawl finished with status: {result.get('status')}")
    except Exception as exc:
        print(f"\nCrawl encountered an error: {exc}")

if __name__ == "__main__":
    run_datafactz_crawl()
