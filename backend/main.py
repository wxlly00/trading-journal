from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers import accounts, alerts, calculator, export, notes, playbook, stats, trades

app = FastAPI(title="TradeLog API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(trades.router)
app.include_router(stats.router)
app.include_router(accounts.router)
app.include_router(notes.router)
app.include_router(alerts.router)
app.include_router(calculator.router)
app.include_router(export.router)
app.include_router(playbook.router)
