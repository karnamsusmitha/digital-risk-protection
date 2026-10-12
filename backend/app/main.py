import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import init_db
from app.schemas import HealthResponse
from app.routers import (
    companies,
    assets,
    candidates,
    findings,
    analysis,
    dashboard,
    monitoring,
)

# ----------------------------------------------------------------------------
# Logging Configuration
# ----------------------------------------------------------------------------
log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
logging.basicConfig(
    level=logging.DEBUG if settings.APP_DEBUG else logging.INFO,
    format=log_format,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("drp.backend")


# ----------------------------------------------------------------------------
# Lifespan Management (Startup & Shutdown)
# ----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Handles application startup and shutdown lifecycle events.
    Initializes database tables on start.
    """
    logger.info("Initializing Digital Risk Protection backend...")
    logger.info("Database URL: %s", settings.DATABASE_URL)
    try:
        init_db()
        logger.info("Database tables initialized successfully.")
    except Exception as exc:
        logger.error("Failed to initialize database: %s", exc, exc_info=True)
        raise exc

    logger.info("Service started successfully. Allowed CORS origins: %s", settings.CORS_ORIGINS)
    yield
    logger.info("Shutting down Digital Risk Protection backend...")


# ----------------------------------------------------------------------------
# FastAPI Application Factory
# ----------------------------------------------------------------------------
TAGS_METADATA = [
    {
        "name": "Health",
        "description": "System health and status check endpoints.",
    },
    {
        "name": "Companies",
        "description": "Operations on monitored companies (create, list, get, update, delete).",
    },
    {
        "name": "Assets",
        "description": "Protected asset management for domains, brand names, social profiles, and mobile apps.",
    },
    {
        "name": "Candidates",
        "description": "Threat candidate signal ingestion, triage, and conversion to findings.",
    },
    {
        "name": "Findings",
        "description": "Security risk findings with severity scoring, evidence, status tracking, and pagination.",
    },
    {
        "name": "Analysis & Risk Scoring",
        "description": "Automated security signal evaluation and organizational risk posture scoring.",
    },
    {
        "name": "Dashboard",
        "description": "Executive dashboard summary metrics, asset counts, threat analysis totals, and recent findings.",
    },
    {
        "name": "Monitoring & Candidate Collection",
        "description": "URL normalization, candidate asset discovery, sample simulation, and external provider feeds.",
    },
]

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for Digital Risk Protection - Attack surface monitoring, candidate threat ingestion, and risk scoring.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
)


# ----------------------------------------------------------------------------
# CORS Middleware Configuration
# ----------------------------------------------------------------------------
cors_origins = (
    settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
)
allow_creds = "*" not in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page", "X-Limit", "X-Total-Pages", "Content-Range"],
)


# ----------------------------------------------------------------------------
# Exception Handlers
# ----------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning("HTTP %d error on %s %s: %s", exc.status_code, request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    errors = jsonable_encoder(exc.errors())
    missing_fields = []
    messages = []
    for err in errors:
        loc = err.get("loc", [])
        field_name = str(loc[-1]) if loc else "field"
        err_type = str(err.get("type", ""))
        msg = str(err.get("msg", "Invalid value"))
        if "missing" in err_type:
            missing_fields.append(field_name)
            messages.append(f"Field '{field_name}' is required")
        else:
            messages.append(f"Field '{field_name}': {msg}")

    if missing_fields:
        detail_msg = f"Missing required field(s): {', '.join(missing_fields)}"
    elif messages:
        detail_msg = "; ".join(messages)
    else:
        detail_msg = "Request validation failed"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": detail_msg,
            "message": detail_msg,
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    detail_msg = str(exc) if settings.APP_DEBUG else "An internal server error occurred. Please contact the administrator."
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail_msg},
    )


# ----------------------------------------------------------------------------
# Root & Health Check Endpoints
# ----------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """
    Health check endpoint for container orchestrators, load balancers, and monitoring.
    """
    return HealthResponse(
        status="healthy",
        service="digital-risk-protection-backend",
        version="1.0.0",
    )


@app.get("/", tags=["Root"])
def root():
    """Root entrypoint providing basic info and link to OpenAPI docs."""
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs",
        "api_v1": settings.API_V1_PREFIX,
    }


# ----------------------------------------------------------------------------
# Versioned API Routers (/api/v1)
# ----------------------------------------------------------------------------
app.include_router(companies.router, prefix=settings.API_V1_PREFIX)
app.include_router(assets.router, prefix=settings.API_V1_PREFIX)
app.include_router(candidates.router, prefix=settings.API_V1_PREFIX)
app.include_router(findings.router, prefix=settings.API_V1_PREFIX)
app.include_router(analysis.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(monitoring.router, prefix=settings.API_V1_PREFIX)

