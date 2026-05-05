"""
選股篩選 API 路由
整合三大面向評分，篩選優質股票
"""
from fastapi import APIRouter
from datetime import datetime, timedelta
from app.models.schemas import ScreenerFilter, ScreenerResult, DayTradeFilter, DayTradeCandidate
from app.services.data_service import (
    fetch_stock_list,
    fetch_price_data_fast,
    fetch_market_day_all,
    fetch_ma_volume_batch,
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
    MAX_STOCKS = 30
    target_stocks = all_stocks[:MAX_STOCKS]

    results = []
    semaphore = asyncio.Semaphore(3)  # 限制並發，保護 API 額度

    async def analyze_stock(stock_info: dict) -> ScreenerResult | None:
        stock_id = stock_info["stock_id"]
        async with semaphore:
            try:
                price_df, income_df, balance_df, inst_df = await asyncio.gather(
                    fetch_price_data_fast(stock_id, price_start, end_date),
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
    """確認是否通過所有篩選條件（資料取不到時略過該條件）"""
    # 基本面篩選（FinMind 額度不足時 valuation 可能為空，略過而非剔除）
    if filters.min_roe is not None:
        roe = valuation.get("roe")
        if roe is not None and roe < filters.min_roe:
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
        if rg is not None and rg < filters.min_revenue_growth:
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
        if macd_hist is not None and macd_hist <= 0:
            return False

    # 籌碼面篩選（資料取不到時略過）
    inst_stats = inst.get("stats", {})
    if filters.min_foreign_consecutive_buy is not None:
        fc = inst_stats.get("foreign_consecutive")
        if fc is not None and fc < filters.min_foreign_consecutive_buy:
            return False

    if filters.require_institutional_net_buy:
        total_5d = inst_stats.get("total_net_5d")
        if total_5d is not None and total_5d <= 0:
            return False

    return True


@router.post("/day-trade", response_model=list[DayTradeCandidate])
async def run_day_trade_screener(filters: DayTradeFilter):
    """
    本日強勢股篩選（當沖選股）
    從 TWSE 全市場行情一次抓取，依量能、振幅、漲跌幅三指標排名
    技術評分使用與個股分析相同的計算路徑（fetch_price_data_fast + compute_technical_score）
    """
    all_data = await fetch_market_day_all()
    if not all_data:
        return []

    # ── 初篩：不需歷史資料的條件 ──
    candidates = []
    for row in all_data:
        if row["volume_lots"] < filters.min_volume_lots:
            continue
        if row["amplitude"] < filters.min_amplitude:
            continue
        if row["close"] < filters.min_price:
            continue
        abs_chg = abs(row["change_pct"])
        if abs_chg < filters.min_change_abs:
            continue
        if filters.max_change_abs is not None and abs_chg > filters.max_change_abs:
            continue
        candidates.append(row)

    if not candidates:
        return []

    # ── 抓取歷史 K 線：計算 MA / 爆量篩選 + 技術評分 ──
    end_date = datetime.today().strftime("%Y-%m-%d")
    price_start = (datetime.today() - timedelta(days=120)).strftime("%Y-%m-%d")
    semaphore = asyncio.Semaphore(3)

    async def _enrich(c: dict) -> dict | None:
        """抓歷史資料、套用 MA/爆量篩選、計算技術評分。回傳 None 表示不通過篩選。"""
        sid = c["stock_id"]
        async with semaphore:
            try:
                price_df = await fetch_price_data_fast(sid, price_start, end_date)
            except Exception as e:
                logger.debug(f"fetch_price_data_fast 失敗 {sid}: {e}")
                price_df = None

        if price_df is None or price_df.empty:
            # 無歷史資料：MA/爆量篩選嚴格排除，技術分留空
            if filters.require_above_ma or filters.require_volume_surge:
                return None
            c["ma5"] = None
            c["ma20"] = None
            c["prev_volume_lots"] = None
            c["above_ma5"] = None
            c["above_ma20"] = None
            c["volume_surge"] = None
            c["_tech_score"] = None
            return c

        closes = price_df["Close"].values.astype(float)
        # Volume 欄：yfinance 為股數，TWSE STOCK_DAY 也是股數；統一 ÷1000 得張數
        volumes_shares = price_df["Volume"].values.astype(float)
        n = len(closes)

        # MA
        ma5  = round(float(closes[-5:].mean()),  2) if n >= 5  else None
        ma20 = round(float(closes[-20:].mean()), 2) if n >= 20 else None

        # 前一日成交量（張）— 取最後一根（yfinance end=today 為排他）
        close_val = c["close"]
        from datetime import date as _date
        today_d = _date.today()
        try:
            last_idx = price_df["date"].values[-1] if "date" in price_df.columns else price_df.index[-1]
            import pandas as _pd
            last_d = _pd.Timestamp(last_idx).date()
            vol_idx = -2 if (last_d == today_d and n >= 2) else -1
        except Exception:
            vol_idx = -1
        prev_volume_lots = int(volumes_shares[vol_idx]) // 1000 if n >= 1 else None

        # MA 篩選
        if filters.require_above_ma:
            if ma5 is None or ma20 is None or close_val < ma5 or close_val < ma20:
                return None

        # 爆量篩選
        if filters.require_volume_surge:
            if prev_volume_lots is None or prev_volume_lots <= 0:
                return None
            if c["volume_lots"] < prev_volume_lots * 2:
                return None

        # 技術評分（與個股分析完全相同路徑）
        try:
            df_ind = compute_indicators(price_df.copy())
            tech = compute_technical_score(df_ind)
            tech_score = round(tech["score"], 1)
        except Exception as e:
            logger.debug(f"技術評分失敗 {sid}: {e}")
            tech_score = None

        c["ma5"] = ma5
        c["ma20"] = ma20
        c["prev_volume_lots"] = prev_volume_lots
        c["above_ma5"]  = (ma5  is not None and close_val >= ma5)
        c["above_ma20"] = (ma20 is not None and close_val >= ma20)
        c["volume_surge"] = (
            prev_volume_lots is not None and prev_volume_lots > 0
            and c["volume_lots"] >= prev_volume_lots * 2
        )
        c["_tech_score"] = tech_score
        return c

    enriched_raw = await asyncio.gather(*[_enrich(c) for c in candidates])
    candidates = [c for c in enriched_raw if c is not None]

    if not candidates:
        return []

    # ── 評分：優先技術分；取不到時 fallback 量能複合分 ──
    volumes    = [c["volume_lots"]       for c in candidates]
    amplitudes = [c["amplitude"]         for c in candidates]
    abs_chgs   = [abs(c["change_pct"])   for c in candidates]

    def pct_score(val, vals):
        lo, hi = min(vals), max(vals)
        return (val - lo) / (hi - lo) * 100 if hi > lo else 50.0

    for c in candidates:
        ts = c.pop("_tech_score", None)
        if ts is not None:
            c["score"] = ts
        else:
            vol_s = pct_score(c["volume_lots"], volumes)
            amp_s = pct_score(c["amplitude"],   amplitudes)
            chg_s = pct_score(abs(c["change_pct"]), abs_chgs)
            c["score"] = round(0.40 * vol_s + 0.35 * amp_s + 0.25 * chg_s, 1)

    candidates.sort(key=lambda x: x["score"], reverse=True)

    return [DayTradeCandidate(**c) for c in candidates[: filters.limit]]

