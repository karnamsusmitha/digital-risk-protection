import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.database import get_db, init_db
from app.api import brands, scans, dashboard
from app.schemas import HealthResponse
from app.services.detection.adapter import detection_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("digital_risk_protection")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook: initialize database schema on startup."""
    logger.info("Initializing database schema...")
    init_db()
    logger.info(f"Digital Risk Protection API started. Active engine: {detection_service.engine_name}")
    yield
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Digital Risk Protection Backend API.\n\n"
        "Helps organizations identify brand impersonation, deceptive lookalike domains, "
        "spoofed social-media accounts, and suspicious mobile-app listings with "
        "transparent and explainable risk indicators."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware for frontend integration (e.g. Angular on port 4200, React/Next on 3000)
cors_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else []
if settings.APP_ENV == "production":
    cors_origins = [o for o in cors_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


from fastapi.encoders import jsonable_encoder


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return friendly, structured validation errors for frontend consumption."""
    error_messages = []
    for err in exc.errors():
        field = " -> ".join(str(p) for p in err.get("loc", []) if p != "body")
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"{field}: {msg}" if field else msg)
    summary = "; ".join(error_messages) if error_messages else "Request validation failed."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": summary,
            "errors": jsonable_encoder(exc.errors())
        }
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Ensure standard HTTPException responses preserve status codes and messages."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


# Global safe error handler - prevents leaking internal stack traces or secrets
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please contact the administrator or check server logs."
        }
    )


# Health check endpoint
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """
    Service health check: verifies database connectivity and detection engine status.
    """
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.error(f"Health check database ping failed: {e}")

    return HealthResponse(
        status="healthy" if db_ok else "degraded",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database_connected=db_ok,
        detection_engine=detection_service.engine_name
    )


# Root endpoint
@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "brands": "/api/brands",
            "scans": "/api/scans",
            "dashboard": "/api/dashboard/summary"
        }
    }


# Include Routers
app.include_router(brands.router)
app.include_router(scans.router)
app.include_router(dashboard.router)
