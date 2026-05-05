"""
股票自動選股系統 - Backend Entry Point
整合基本面、技術面、籌碼面分析
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import stocks, screener, backtest

app = FastAPI(
    title="智能選股系統 API",
    description="整合基本面、技術面、籌碼面的自動選股系統",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api/stocks", tags=["股票資料"])
app.include_router(screener.router, prefix="/api/screener", tags=["選股篩選"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["策略回測"])


@app.get("/")
async def root():
    return {"message": "智能選股系統 API 運行中", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
