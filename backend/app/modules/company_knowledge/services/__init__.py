"""
Nexora.AI - Company Knowledge Processing & Access Services.

Includes:
- Structured PostgreSQL knowledge queries (structured_knowledge)
- Deterministic query routing & hybrid retrieval (knowledge_router)
- Prompt context preparation (knowledge_context)
- Agent integration interfaces (agent_integration)
- Website crawling and persistence (website_crawler, persistence)
"""

from app.modules.company_knowledge.services.agent_integration import (
    get_lead_knowledge_context,
    get_marketing_knowledge_context,
)
from app.modules.company_knowledge.services.knowledge_context import (
    prepare_knowledge_context,
)
from app.modules.company_knowledge.services.knowledge_router import (
    retrieve_company_knowledge,
    route_knowledge_query,
)
from app.modules.company_knowledge.services.structured_knowledge import (
    ALL_COMPANY_CATEGORIES,
    get_company_contact_info,
    get_company_overview,
    get_company_products,
    get_company_services,
    get_company_solutions,
    get_company_tech_stack,
    get_structured_facts,
)

__all__ = [
    "ALL_COMPANY_CATEGORIES",
    "get_company_contact_info",
    "get_company_overview",
    "get_company_products",
    "get_company_services",
    "get_company_solutions",
    "get_company_tech_stack",
    "get_lead_knowledge_context",
    "get_marketing_knowledge_context",
    "get_structured_facts",
    "prepare_knowledge_context",
    "retrieve_company_knowledge",
    "route_knowledge_query",
]
