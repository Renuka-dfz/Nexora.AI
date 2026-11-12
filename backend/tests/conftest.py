import os


os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-only-signing-key-with-at-least-thirty-two-bytes",
)
