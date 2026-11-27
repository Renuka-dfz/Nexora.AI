from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
 
PROJECT_ROOT = Path(__file__).resolve().parents[3]
 
 
class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str = Field(min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, gt=0)
    REDIS_URL: str = "redis://localhost:6379/0"
    CRAWL_MAX_PAGES: int = Field(default=50, ge=1, le=500)
    CRAWL_MAX_DEPTH: int = Field(default=2, ge=0, le=10)
    CRAWL_PAGE_TIMEOUT_MS: int = Field(default=30000, gt=0)
    CRAWL_HTTP_TIMEOUT_SECONDS: float = Field(default=10.0, gt=0)
    CRAWL_MAX_RESPONSE_BYTES: int = Field(default=2097152, gt=0)
    CRAWL_JSON_OUTPUT_DIR: Path = PROJECT_ROOT / "storage" / "crawl-json"

    # Ollama Local LLM Configuration (configured for qwen3.5:2b)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3.5:2b"
    OLLAMA_TEMPERATURE: float = 0.1
    OLLAMA_TIMEOUT_SECONDS: float = 90.0

    # External Market Research (Tavily)
    TAVILY_API_KEY: str | None = None

    # Social Integrations - LinkedIn API
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/linkedin/callback"
    LINKEDIN_ACCESS_TOKEN: str = ""
    LINKEDIN_ORGANIZATION_URN: str = ""

    # Social Integrations - Instagram Graph API (Meta)
    INSTAGRAM_CLIENT_ID: str = ""
    INSTAGRAM_CLIENT_SECRET: str = ""
    INSTAGRAM_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/instagram/callback"
    IG_ACCESS_TOKEN: str = ""
    IG_USER_ID: str = ""

    # Recraft V4.1 Flash V2 image generation
    RECRAFT_API_TOKEN: str = ""

    # OpenRouter Image Generation API (recraft/recraft-v3, flux, etc.)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_IMAGE_MODEL: str = "recraft/recraft-v3"

    # OpenAI API key is used by the text generation and evaluation integrations.
    OPENAI_API_KEY: str = ""

    # Public Application URL (used for serving public static assets to Meta / webhooks)
    # Set to your Cloudflare Tunnel or ngrok HTTPS domain when publishing to Instagram
    PUBLIC_APP_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
 
 
settings = Settings()
