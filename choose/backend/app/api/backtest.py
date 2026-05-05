"""
策略回測 API 路由
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import BacktestRequest, BacktestResult
from app.services.data_service import fetch_price_data, fetch_institutional_data
from app.services.backtester import Backtester
import asyncio

router = APIRouter()


@router.post("/run", response_model=BacktestResult)
async def run_backtest(request: BacktestRequest):
    """執行策略回測"""
    price_df, inst_df = await asyncio.gather(
        fetch_price_data(request.stock_id, request.start_date, request.end_date),
        fetch_institutional_data(request.stock_id, request.start_date, request.end_date),
    )

    if price_df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"找不到股票 {request.stock_id} 在 {request.start_date}~{request.end_date} 的資料",
        )

    backtester = Backtester(
        df_price=price_df,
        df_institutional=inst_df if not inst_df.empty else None,
        initial_capital=request.initial_capital,
        commission_rate=request.commission_rate,
        tax_rate=request.tax_rate,
    )

    metrics = backtester.run(
        strategy=request.strategy.value,
        short_ma=request.short_ma,
        long_ma=request.long_ma,
        rsi_oversold=request.rsi_oversold,
        rsi_overbought=request.rsi_overbought,
        score_threshold=request.score_threshold,
    )

    return BacktestResult(
        stock_id=request.stock_id,
        strategy=request.strategy.value,
        start_date=request.start_date,
        end_date=request.end_date,
        initial_capital=request.initial_capital,
        final_capital=metrics["final_capital"],
        total_return=metrics["total_return"],
        annual_return=metrics["annual_return"],
        max_drawdown=metrics["max_drawdown"],
        sharpe_ratio=metrics["sharpe_ratio"],
        win_rate=metrics["win_rate"],
        total_trades=metrics["total_trades"],
        profit_trades=metrics["profit_trades"],
        loss_trades=metrics["loss_trades"],
        avg_profit=metrics["avg_profit"],
        avg_loss=metrics["avg_loss"],
        profit_factor=metrics["profit_factor"],
        trades=metrics["trades"],
        equity_curve=metrics["equity_curve"],
        benchmark_return=metrics["benchmark_return"],
    )
