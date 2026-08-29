import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SUPABASE_URL: str = os.environ["SUPABASE_URL"]
    SUPABASE_ANON_KEY: str = os.environ["SUPABASE_ANON_KEY"]
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    SUPABASE_JWT_SECRET: str = os.environ["SUPABASE_JWT_SECRET"]
    CORS_ORIGINS: list[str] = os.environ.get("CORS_ORIGINS", "").split(",")


settings = Settings()
