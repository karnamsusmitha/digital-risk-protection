from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Digital Risk Protection API"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./drp.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production-drp-2026"

    # Integration Settings (Teammate AI & Monitoring Modules)
    AI_MODULE_URL: Union[str, None] = None
    MONITORING_MODULE_URL: Union[str, None] = None
    AI_MODULE_API_KEY: Union[str, None] = None
    MONITORING_MODULE_API_KEY: Union[str, None] = None
    MODULE_REQUEST_TIMEOUT: float = 3.0
    
    # CORS: List of origins allowed to access the backend API
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:8080",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            # Parse comma-separated string if provided
            origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            origins = [str(origin).strip() for origin in v if str(origin).strip()]
        else:
            return v

        for preview_origin in ["http://localhost:4173", "http://127.0.0.1:4173"]:
            if preview_origin not in origins:
                origins.append(preview_origin)
        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
