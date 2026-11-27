"""
Seed dim_category with the 12 standard company knowledge categories.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.modules.company_knowledge.models import DimCategory
from sqlalchemy import select

CATEGORY_NAMES = (
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Projects",
    "Innovations and Research",
    "Brand Identities",
    "Knowledge Resources",
    "Case Studies",
    "Achievements",
    "Industry Expertise",
    "Customers",
)

def seed_categories():
    with SessionLocal() as db:
        added = 0
        for name in CATEGORY_NAMES:
            cat = db.scalar(select(DimCategory).where(DimCategory.category_name == name))
            if not cat:
                db.add(DimCategory(category_name=name))
                print(f"  + Added category: {name}")
                added += 1
            else:
                print(f"  - Category exists: {name}")
        db.commit()
        print(f"\nSeeding complete! {added} categories added.")

if __name__ == "__main__":
    seed_categories()
