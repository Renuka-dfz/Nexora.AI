import os, sys
from uuid import UUID
sys.path.insert(0, os.path.abspath('backend'))
from app.core.database import SessionLocal
from app.modules.company_knowledge.services.agent_integration import get_marketing_knowledge_context

COMPANY_ID = UUID('30a9e83f-9928-4fd5-8bac-78a2df8f32f6')
TOPIC = "Inside DataFactZ's AI Agents: Real-World Applications Across Insurance, Engineering, and Enterprise Operations"

with SessionLocal() as db:
    ctx = get_marketing_knowledge_context(db, company_id=COMPANY_ID, topic=TOPIC, platform='linkedin', content_type='article')
    print('CONTEXT_TEXT LENGTH:', len(ctx.context_text))
    print('--- CONTEXT TEXT SAMPLE ---')
    print(ctx.context_text[:3000])
    print('--- CHECKING KEYWORDS IN CONTEXT_TEXT ---')
    for kw in ['partner data intake', 'site intelligence', 'field records', 'incentive compensation', 'contract', 'registry']:
        print(f"'{kw}' in context_text: {kw in ctx.context_text.lower()}")
