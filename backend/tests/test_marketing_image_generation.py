import base64
import io
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents.marketing_agent import graph as marketing_graph
from app.core.database import Base
from app.modules.company_knowledge.models import DimCompany
from app.modules.identity.models import User
from app.modules.marketing import tasks as marketing_tasks
from app.modules.marketing.models import DimContent, DimContentGenerationBatch
from app.modules.marketing.tasks import _save_branded_image


@pytest.mark.parametrize(
    ("platform", "expected_size"),
    [
        ("instagram", (1080, 1350)),
        ("linkedin", (1200, 627)),
    ],
)
def test_saved_marketing_image_has_platform_size_and_post_overlay(
    monkeypatch,
    tmp_path,
    platform,
    expected_size,
):
    source = Image.new("RGB", (4, 3), color=(30, 45, 55))
    encoded = io.BytesIO()
    source.save(encoded, format="JPEG")
    image_uri = "data:image/jpeg;base64," + base64.b64encode(encoded.getvalue()).decode("ascii")
    content_id = uuid4()
    monkeypatch.setattr("app.modules.marketing.tasks.os.getcwd", lambda: str(tmp_path))

    url = _save_branded_image(
        content_id,
        "Nexora",
        platform,
        {"image_data_uri": image_uri},
        "A clearer way to turn data into action",
        "Bring trusted insights into every decision.",
    )

    image_path = tmp_path / "static" / "generated_images" / f"{content_id}.jpg"
    assert url.endswith(f"/static/generated_images/{content_id}.jpg")
    assert image_path.is_file()
    with Image.open(image_path) as saved:
        assert saved.size == expected_size
        assert len(saved.convert("RGB").getcolors(maxcolors=expected_size[0] * expected_size[1])) > 1


def test_weekly_batch_generates_five_distinct_recraft_images(monkeypatch, tmp_path):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(marketing_tasks, "SessionLocal", test_sessions)
    monkeypatch.setattr(marketing_tasks.os, "getcwd", lambda: str(tmp_path))

    with test_sessions() as db:
        company = DimCompany(company_name="Nexora")
        db.add(company)
        db.flush()
        user = User(
            company_id=company.company_id,
            email="weekly-images@example.com",
            password_hash="test-hash",
            role="admin",
        )
        db.add(user)
        db.flush()
        batch = DimContentGenerationBatch(
            company_id=company.company_id,
            user_id=user.user_id,
            platform="instagram",
            mode="automatic",
            status="queued",
            total_requested=5,
            prompt=None,
        )
        db.add(batch)
        db.commit()
        batch_id = batch.batch_id
        company_id = company.company_id
        user_id = user.user_id

    generated_states = []

    class FakeGraph:
        def __init__(self, db):
            self.db = db

        def invoke(self, state):
            generated_states.append(state.copy())
            post = DimContent(
                company_id=company_id,
                content_title=f"Post {len(generated_states)}",
                content_type="post",
                platform_target=state["platform"],
                topic=state["topic"],
                content_text=f"Practical company insight {len(generated_states)}.",
                tone=state["tone"],
                generation_type="ai",
            )
            self.db.add(post)
            self.db.flush()
            return {"content_id": str(post.content_id)}

    monkeypatch.setattr(
        marketing_graph,
        "build_marketing_agent_graph",
        lambda db: FakeGraph(db),
    )

    source = Image.new("RGB", (4, 3), color=(30, 45, 55))
    encoded = io.BytesIO()
    source.save(encoded, format="JPEG")
    image_uri = "data:image/jpeg;base64," + base64.b64encode(encoded.getvalue()).decode("ascii")
    recraft_calls = []

    class ConfiguredRecraftClient:
        is_configured = True

        async def generate_branding_image(self, **kwargs):
            recraft_calls.append(kwargs)
            return {"image_data_uri": image_uri}

    monkeypatch.setattr(marketing_tasks, "RecraftImageClient", ConfiguredRecraftClient)

    result = marketing_tasks.generate_weekly_batch_task.run(str(batch_id))

    with test_sessions() as db:
        saved_batch = db.get(DimContentGenerationBatch, batch_id)
        posts = db.scalars(
            select(DimContent)
            .where(DimContent.generation_batch_id == batch_id)
            .order_by(DimContent.created_at.asc())
        ).all()
        assert saved_batch.status == "completed"
        assert saved_batch.total_created == 5
        assert len(posts) == 5
        assert all(post.image_url for post in posts)
        assert len({post.topic for post in posts}) == 5

    assert result == {"batch_id": str(batch_id), "status": "completed", "total_created": 5}
    assert len(generated_states) == len(recraft_calls) == 5
    assert all(state["company_id"] == company_id and state["user_id"] == user_id for state in generated_states)
