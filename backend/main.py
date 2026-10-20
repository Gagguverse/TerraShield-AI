"""TerraShield AI - FastAPI Application Server."""

import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes FIRST so all /api/* endpoints take priority
app.include_router(api_router)

# Frontend distribution directory for combined single-service deployment
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# Mount static asset subdirectories if present
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists() and assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    guide_dir = FRONTEND_DIST / "guide"
    if guide_dir.exists() and guide_dir.is_dir():
        app.mount("/guide", StaticFiles(directory=guide_dir), name="guide")


@app.get("/")
def root():
    """Serve frontend index.html if built, otherwise return API status."""
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "service": "TerraShield AI API",
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "current_mode": settings.DATA_MODE,
        "note": "Frontend build not detected in frontend/dist. Run 'npm run build' inside frontend/.",
    }


@app.get("/{full_path:path}")
async def serve_spa_fallback(full_path: str):
    """Serve static files or fallback to index.html for client-side routing.

    Explicitly does NOT intercept API routes, OpenAPI documentation, or schema endpoints.
    """
    # Guard: Never intercept API or documentation paths
    if (
        full_path.startswith("api/")
        or full_path == "api"
        or full_path.startswith("docs")
        or full_path == "docs"
        or full_path.startswith("redoc")
        or full_path == "redoc"
        or full_path == "openapi.json"
    ):
        raise HTTPException(status_code=404, detail="Not Found")

    if FRONTEND_DIST.exists():
        # Check if direct file exists in frontend/dist (e.g., favicon.svg, hero_satellite.jpg)
        static_file = FRONTEND_DIST / full_path
        if static_file.is_file():
            return FileResponse(static_file)

        # Fallback to SPA index.html for client-side routing
        index_file = FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Not Found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.APP_ENV == "development"),
    )
