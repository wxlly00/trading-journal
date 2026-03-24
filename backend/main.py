import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.config import settings
from routers import accounts, alerts, calculator, export, notes, playbook, stats, trades

app = FastAPI(title="TradeLog API", version="1.0.0")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "trace": traceback.format_exc()[-1000:]})

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
