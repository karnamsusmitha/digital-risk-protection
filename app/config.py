import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Digital Risk Protection API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    DATABASE_URL: str = "sqlite:///./digital_risk_protection.db"
    DETECTION_ENGINE_MODE: str = "rule_based"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        origins: List[str] = []
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        origins = [str(i).strip() for i in parsed if str(i).strip()]
                except Exception:
                    origins = [i.strip() for i in v_stripped.strip("[]").split(",") if i.strip()]
            else:
                origins = [i.strip() for i in v_stripped.split(",") if i.strip()]
        elif isinstance(v, (list, tuple, set)):
            origins = [str(i).strip() for i in v if str(i).strip()]
        else:
            origins = [
                "http://localhost:4200",
                "http://127.0.0.1:4200",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]

        # Security rule: Never allow wildcard '*' in production
        env = os.getenv("APP_ENV", "development").lower()
        if env == "production":
            origins = [o for o in origins if o != "*"]

        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
