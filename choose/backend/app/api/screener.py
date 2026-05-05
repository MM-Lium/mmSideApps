"""
選股篩選 API 路由
整合三大面向評分，篩選優質股票
"""
from fastapi import APIRouter
from datetime import datetime, timedelta
from app.models.schemas import ScreenerFilter, ScreenerResult
from app.services.data_service import (
    fetch_stock_list,
    fetch_price_data,
    fetch_institutional_data,
    fetch_income_statement,
    fetch_balance_sheet,
)
from app.services.technical_analysis import compute_indicators, compute_technical_score
from app.services.fundamental_analysis import (
    parse_income_statement,
    parse_balance_sheet,
    compute_valuation,
    compute_fundamental_score,
)
from app.services.institutional_analysis import compute_institutional_score
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/run", response_model=list[ScreenerResult])
async def run_screener(filters: ScreenerFilter):
    """
    執行選股篩選
    根據基本面、技術面、籌碼面條件篩選並評分
    """
    end = datetime.today()
    price_start = (end - timedelta(days=120)).strftime("%Y-%m-%d")
    fund_start = (end - timedelta(days=365 * 2)).strftime("%Y-%m-%d")
    inst_start = (end - timedelta(days=60)).strftime("%Y-%m-%d")
    end_date = end.strftime("%Y-%m-%d")

    # 取得股票清單
    all_stocks = await fetch_stock_list()

    # 篩選市場
    if filters.market and filters.market != "ALL":
        all_stocks = [s for s in all_stocks if s.get("market") == filters.market]

    # 限制分析數量（避免過慢）
    MAX_STOCKS = 50
    target_stocks = all_stocks[:MAX_STOCKS]

    results = []
    semaphore = asyncio.Semaphore(5)  # 限制並發

    async def analyze_stock(stock_info: dict) -> ScreenerResult | None:
        stock_id = stock_info["stock_id"]
        async with semaphore:
            try:
                price_df, income_df, balance_df, inst_df = await asyncio.gather(
                    fetch_price_data(stock_id, price_start, end_date),
                    fetch_income_statement(stock_id, fund_start, end_date),
                    fetch_balance_sheet(stock_id, fund_start, end_date),
                    fetch_institutional_data(stock_id, inst_start, end_date),
                )

                if price_df.empty:
                    return None

                close = float(price_df.iloc[-1]["Close"])
                prev_close = float(price_df.iloc[-2]["Close"]) if len(price_df) > 1 else close
                change_pct = (close - prev_close) / prev_close * 100 if prev_close != 0 else 0

                # 技術面
                price_df_ind = compute_indicators(price_df)
                tech = compute_technical_score(price_df_ind)
                tech_score = tech["score"]

                # 基本面
                income_stmts = parse_income_statement(income_df)
                balance_sheets = parse_balance_sheet(balance_df)
                valuation = compute_valuation(income_stmts, balance_sheets, close)
                fund = compute_fundamental_score(income_stmts, balance_sheets, valuation)
                fund_score = fund["score"]

                # 籌碼面
                inst = compute_institutional_score(inst_df)
                inst_score = inst["score"]

                # 篩選條件過濾
                if not _pass_filters(filters, valuation, tech, inst):
                    return None

                # 加權總分
                fw = filters.fundamental_weight
                tw = filters.technical_weight
                iw = filters.institutional_weight
                total = fw * fund_score + tw * tech_score + iw * inst_score

                last_ind = tech.get("last", {})
                inst_stats = inst.get("stats", {})

                return ScreenerResult(
                    stock_id=stock_id,
                    stock_name=stock_info.get("stock_name", stock_id),
                    industry=stock_info.get("industry"),
                    close=close,
                    change_pct=round(change_pct, 2),
                    fundamental_score=fund_score,
                    technical_score=tech_score,
                    institutional_score=inst_score,
                    total_score=round(total, 1),
                    signal=tech["signal"],
                    pe_ratio=valuation.get("pe_ratio"),
                    roe=valuation.get("roe"),
                    rsi_14=last_ind.get("rsi_14"),
                    foreign_net_3d=inst_stats.get("foreign_net_3d"),
                )
            except Exception as e:
                logger.warning(f"分析 {stock_id} 失敗: {e}")
                return None

    tasks = [analyze_stock(s) for s in target_stocks]
    raw_results = await asyncio.gather(*tasks)

    results = [r for r in raw_results if r is not None]
    results.sort(key=lambda x: x.total_score, reverse=True)

    return results[: filters.limit]


def _pass_filters(
    filters: ScreenerFilter,
    valuation: dict,
    tech: dict,
    inst: dict,
) -> bool:
    """確認是否通過所有篩選條件"""
    # 基本面篩選
    if filters.min_roe is not None:
        roe = valuation.get("roe")
        if roe is None or roe < filters.min_roe:
            return False

    if filters.max_pe is not None:
        pe = valuation.get("pe_ratio")
        if pe is not None and pe > filters.max_pe:
            return False

    if filters.max_pb is not None:
        pb = valuation.get("pb_ratio")
        if pb is not None and pb > filters.max_pb:
            return False

    if filters.min_revenue_growth is not None:
        rg = valuation.get("revenue_growth_yoy")
        if rg is None or rg < filters.min_revenue_growth:
            return False

    # 技術面篩選
    last_ind = tech.get("last", {})
    rsi = last_ind.get("rsi_14")
    if filters.rsi_min is not None and rsi is not None:
        if rsi < filters.rsi_min:
            return False
    if filters.rsi_max is not None and rsi is not None:
        if rsi > filters.rsi_max:
            return False

    if filters.require_macd_bullish:
        macd_hist = last_ind.get("macd_hist")
        if macd_hist is None or macd_hist <= 0:
            return False

    # 籌碼面篩選
    inst_stats = inst.get("stats", {})
    if filters.min_foreign_consecutive_buy is not None:
        fc = inst_stats.get("foreign_consecutive", 0)
        if fc < filters.min_foreign_consecutive_buy:
            return False

    if filters.require_institutional_net_buy:
        total_5d = inst_stats.get("total_net_5d", 0)
        if total_5d <= 0:
            return False

    return True
