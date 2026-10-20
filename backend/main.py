"""TerraShield AI - FastAPI Application Server."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import router as api_router
from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("terrashield.main")

app = FastAPI(
    title="TerraShield AI - Wildfire Intelligence & Verification API",
    description=(
        "Evidence-driven wildfire intelligence platform integrating NASA FIRMS satellite "
        "detections with TinyFish public report discovery and deterministic incident corroboration."
    ),
    version="1.0.0",
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "service": "TerraShield AI API",
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "current_mode": settings.DATA_MODE,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.APP_ENV == "development"),
    )
