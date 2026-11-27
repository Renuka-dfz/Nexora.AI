from celery import Celery
from celery.schedules import crontab

from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()

celery_app = Celery(
    "nexora",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.modules.company_knowledge.tasks",
        "app.modules.marketing.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    beat_schedule={
        "publish-approved-scheduled-posts": {
            "task": "marketing.publish_scheduled_posts",
            "schedule": 60.0,
        },
        "weekly-website-crawl-sync": {
            "task": "company_knowledge.auto_crawl_all_companies",
            "schedule": crontab(hour=2, minute=0, day_of_week=1),
        },
        "weekly-batch-post-generation": {
            "task": "marketing.auto_generate_weekly_campaigns",
            "schedule": crontab(hour=4, minute=0, day_of_week=1),
        },
    },
)
