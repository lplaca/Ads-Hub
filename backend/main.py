"""
Ads Hub - Backend API
FastAPI + SQLite - Serves frontend + API
"""
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import FRONTEND_DIR
from backend.core.db import init_db

# Import all routers
from backend.domains.auth_routes import router as auth_router
from backend.domains.bm import router as bm_router
from backend.domains.accounts import router as accounts_router
from backend.domains.campaigns import router as campaigns_router
from backend.domains.rules import router as rules_router
from backend.domains.alerts import router as alerts_router
from backend.domains.projects import router as projects_router
from backend.domains.sessions import router as sessions_router
from backend.domains.intel import router as intel_router
from backend.domains.reports import router as reports_router
from backend.domains.agent import router as agent_router
from backend.domains.launcher import router as launcher_router
from backend.domains.sheets import router as sheets_router
from backend.domains.connections import router as connections_router
from backend.domains.dashboard import router as dashboard_router
from backend.domains.knowledge import router as knowledge_router
from backend.domains.settings_routes import router as settings_router
from backend.domains.tasks import router as tasks_router

app = FastAPI(title="Ads Hub", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth_router)
app.include_router(bm_router)
app.include_router(accounts_router)
app.include_router(campaigns_router)
app.include_router(rules_router)
app.include_router(alerts_router)
app.include_router(projects_router)
app.include_router(sessions_router)
app.include_router(intel_router)
app.include_router(reports_router)
app.include_router(agent_router)
app.include_router(launcher_router)
app.include_router(sheets_router)
app.include_router(connections_router)
app.include_router(dashboard_router)
app.include_router(knowledge_router)
app.include_router(settings_router)
app.include_router(tasks_router)

# Static files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
@app.get("/{full_path:path}")
def serve_frontend(full_path: str = ""):
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"error": "Frontend not found"}


@app.on_event("startup")
def startup():
    init_db()
    print("\n" + "="*50)
    print("  Ads Hub v2.1")
    print("  http://localhost:8000")
    print("="*50 + "\n")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
