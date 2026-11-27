"""
Clean all previously crawled pages, crawl jobs, and extracted intelligence facts
for a fresh crawl of https://datafactz.ai/.
"""
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.modules.company_knowledge.models import CrawledPage, WebsiteCrawlJob, FactCompanyIntelligence, DimCompany
from sqlalchemy import select

def clean_website_data():
    with SessionLocal() as db:
        companies = db.scalars(select(DimCompany)).all()
        if not companies:
            print("No companies found in database.")
            return

        for comp in companies:
            p_deleted = db.query(CrawledPage).filter(CrawledPage.company_id == comp.company_id).delete()
            j_deleted = db.query(WebsiteCrawlJob).filter(WebsiteCrawlJob.company_id == comp.company_id).delete()
            f_deleted = db.query(FactCompanyIntelligence).filter(FactCompanyIntelligence.company_id == comp.company_id).delete()
            db.commit()
            print(f"Cleaned company: {comp.company_name} (ID: {comp.company_id})")
            print(f"  - Deleted {p_deleted} crawled pages")
            print(f"  - Deleted {j_deleted} crawl jobs")
            print(f"  - Deleted {f_deleted} company intelligence facts")
        print("\nWebsite crawl data cleaned successfully! Ready for fresh crawl.")

if __name__ == "__main__":
    clean_website_data()
