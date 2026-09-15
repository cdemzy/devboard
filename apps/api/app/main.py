from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.boards import router
from app.core.config import get_settings

app = FastAPI(title="DevBoard API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
