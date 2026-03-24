from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    resend_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    finnhub_api_key: str = ""
    anthropic_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
