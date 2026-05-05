"""
股票資料 API 路由
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from app.services.data_service import (
    fetch_stock_list,
    fetch_price_data,
    fetch_institutional_data,
    fetch_income_statement,
    fetch_balance_sheet,
)
from app.services.technical_analysis import compute_indicators, compute_technical_score, _safe_float
from app.services.fundamental_analysis import (
    parse_income_statement,
    parse_balance_sheet,
    compute_valuation,
    compute_fundamental_score,
)
from app.services.institutional_analysis import compute_institutional_score

router = APIRouter()


@router.get("/list")
async def get_stock_list():
    """取得台股清單"""
    stocks = await fetch_stock_list()
    return {"data": stocks, "total": len(stocks)}


@router.get("/{stock_id}/price")
async def get_price(
    stock_id: str,
    days: int = Query(default=180, ge=30, le=1000),
):
    """取得股票K線資料 + 技術指標"""
    end = datetime.today()
    start = end - timedelta(days=days)
    df = await fetch_price_data(stock_id, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))

    if df.empty:
        raise HTTPException(status_code=404, detail=f"找不到股票 {stock_id} 的資料")

    df = compute_indicators(df)

    candles = []
    for _, row in df.iterrows():
        candles.append({
            "date": str(row["date"].date()),
            "open": _safe_float(row.get("Open")),
            "high": _safe_float(row.get("High")),
            "low": _safe_float(row.get("Low")),
            "close": _safe_float(row.get("Close")),
            "volume": _safe_float(row.get("Volume")),
            "ma5": _safe_float(row.get("ma5")),
            "ma20": _safe_float(row.get("ma20")),
            "ma60": _safe_float(row.get("ma60")),
            "rsi_14": _safe_float(row.get("rsi_14")),
            "macd": _safe_float(row.get("macd")),
            "macd_signal": _safe_float(row.get("macd_signal")),
            "macd_hist": _safe_float(row.get("macd_hist")),
            "kdj_k": _safe_float(row.get("kdj_k")),
            "kdj_d": _safe_float(row.get("kdj_d")),
            "bb_upper": _safe_float(row.get("bb_upper")),
            "bb_middle": _safe_float(row.get("bb_middle")),
            "bb_lower": _safe_float(row.get("bb_lower")),
        })

    tech_result = compute_technical_score(df)
    return {
        "stock_id": stock_id,
        "candles": candles,
        "indicators": tech_result["last"],
        "signal": tech_result["signal"],
        "score": tech_result["score"],
        "reasons": tech_result["reasons"],
    }


@router.get("/{stock_id}/fundamental")
async def get_fundamental(
    stock_id: str,
    years: int = Query(default=3, ge=1, le=5),
):
    """取得基本面資料（財報 + 估值）"""
    end = datetime.today()
    start = end - timedelta(days=years * 365 + 30)
    end_date = end.strftime("%Y-%m-%d")
    start_date = start.strftime("%Y-%m-%d")

    # 並行抓取
    import asyncio
    income_df, balance_df, price_df = await asyncio.gather(
        fetch_income_statement(stock_id, start_date, end_date),
        fetch_balance_sheet(stock_id, start_date, end_date),
        fetch_price_data(stock_id, (end - timedelta(days=5)).strftime("%Y-%m-%d"), end_date),
    )

    income_stmts = parse_income_statement(income_df)
    balance_sheets = parse_balance_sheet(balance_df)

    current_price = 0.0
    if not price_df.empty:
        current_price = float(price_df.iloc[-1]["Close"])

    valuation = compute_valuation(income_stmts, balance_sheets, current_price)
    score_result = compute_fundamental_score(income_stmts, balance_sheets, valuation)

    return {
        "stock_id": stock_id,
        "income_statements": income_stmts,
        "balance_sheets": balance_sheets,
        "valuation": valuation,
        "score": score_result["score"],
        "reasons": score_result["reasons"],
        "current_price": current_price,
    }


@router.get("/{stock_id}/institutional")
async def get_institutional(
    stock_id: str,
    days: int = Query(default=60, ge=10, le=365),
):
    """取得三大法人買賣超資料"""
    end = datetime.today()
    start = end - timedelta(days=days)
    df = await fetch_institutional_data(
        stock_id, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    )

    if df.empty:
        return {
            "stock_id": stock_id,
            "records": [],
            "score": 50.0,
            "reasons": [],
            "stats": {},
        }

    score_result = compute_institutional_score(df)

    records = []
    for _, row in df.iterrows():
        records.append({
            "date": str(row["date"].date()),
            "foreign_net": float(row.get("foreign_net", 0)),
            "trust_net": float(row.get("trust_net", 0)),
            "dealer_net": float(row.get("dealer_net", 0)),
            "total_net": float(row.get("total_net", 0)),
        })

    return {
        "stock_id": stock_id,
        "records": records,
        "score": score_result["score"],
        "reasons": score_result["reasons"],
        "stats": score_result["stats"],
    }
