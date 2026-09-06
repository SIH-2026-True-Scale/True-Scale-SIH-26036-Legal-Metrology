from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, citizen

app = FastAPI(
    title="SIH 26036 Backend",
    description="Covers REQ-00 (shared core), REQ-01 (auth), REQ-02 (citizen module). "
    "LMO/GATC/Admin/Certificate routers land once REQ-03–06 are provided.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(citizen.router)


@app.api_route("/", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}


# --- Not yet implemented — waiting on requirement docs ---
# app.include_router(lmo.router)      # REQ-03
# app.include_router(gatc.router)     # REQ-04
# app.include_router(admin.router)    # REQ-05
# certificate generation / QR service # REQ-06
