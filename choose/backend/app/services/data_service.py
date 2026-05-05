"""
資料抓取服務
使用 FinMind API（台股免費資料源）
"""
import httpx
import os
import asyncio as _aio
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data"
FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "")

# ---- 簡易 in-memory 快取，避免重複打 API ----
_market_day_cache: dict = {}   # {"data": [...], "ts": float}

# 常見台股清單（當 API 無法連線時使用）
FALLBACK_STOCKS = [
    {"stock_id": "2330", "stock_name": "台積電", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "2317", "stock_name": "鴻海", "industry": "電腦及周邊設備", "market": "TWSE"},
    {"stock_id": "2454", "stock_name": "聯發科", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "2412", "stock_name": "中華電", "industry": "通信網路", "market": "TWSE"},
    {"stock_id": "2882", "stock_name": "國泰金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "2881", "stock_name": "富邦金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "2886", "stock_name": "兆豐金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "1301", "stock_name": "台塑", "industry": "塑膠工業", "market": "TWSE"},
    {"stock_id": "1303", "stock_name": "南亞", "industry": "塑膠工業", "market": "TWSE"},
    {"stock_id": "2002", "stock_name": "中鋼", "industry": "鋼鐵工業", "market": "TWSE"},
    {"stock_id": "3008", "stock_name": "大立光", "industry": "光學器材", "market": "TWSE"},
    {"stock_id": "2308", "stock_name": "台達電", "industry": "電子零組件", "market": "TWSE"},
    {"stock_id": "2382", "stock_name": "廣達", "industry": "電腦及周邊設備", "market": "TWSE"},
    {"stock_id": "2357", "stock_name": "華碩", "industry": "電腦及周邊設備", "market": "TWSE"},
    {"stock_id": "2395", "stock_name": "研華", "industry": "電腦及周邊設備", "market": "TWSE"},
    {"stock_id": "6505", "stock_name": "台塑化", "industry": "油電燃氣", "market": "TWSE"},
    {"stock_id": "2303", "stock_name": "聯電", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "2891", "stock_name": "中信金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "5880", "stock_name": "合庫金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "2884", "stock_name": "玉山金", "industry": "金融保險", "market": "TWSE"},
    {"stock_id": "2379", "stock_name": "瑞昱", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "3711", "stock_name": "日月光投控", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "2408", "stock_name": "南亞科", "industry": "半導體", "market": "TWSE"},
    {"stock_id": "6669", "stock_name": "緯穎", "industry": "電腦及周邊設備", "market": "TWSE"},
    {"stock_id": "4938", "stock_name": "和碩", "industry": "電腦及周邊設備", "market": "TWSE"},
]


async def fetch_stock_list() -> list[dict]:
    """抓取台股清單"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                FINMIND_BASE,
                params={"dataset": "TaiwanStockInfo"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200:
                records = data["data"]
                results = [
                    {
                        "stock_id": r["stock_id"],
                        "stock_name": r["stock_name"],
                        "industry": r.get("industry_category", ""),
                        "market": r.get("type", "").upper(),
                    }
                    for r in records
                    if r.get("type") in ("twse", "tpex")
                ]
                if results:
                    return results
    except Exception as e:
        logger.warning(f"FinMind API 無法連線，使用預設清單: {e}")
    return FALLBACK_STOCKS


async def fetch_price_data(
    stock_id: str,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """抓取股票日K線資料（OHLCV）"""
    try:
        params = {
            "dataset": "TaiwanStockPrice",
            "data_id": stock_id,
            "start_date": start_date,
            "end_date": end_date,
        }
        if FINMIND_TOKEN:
            params["token"] = FINMIND_TOKEN
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINMIND_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200 and data["data"]:
                df = pd.DataFrame(data["data"])
                df["date"] = pd.to_datetime(df["date"])
                df = df.sort_values("date").reset_index(drop=True)
                df = df.rename(
                    columns={
                        "open": "Open",
                        "max": "High",
                        "min": "Low",
                        "close": "Close",
                        "Trading_Volume": "Volume",
                    }
                )
                return df
    except Exception as e:
        logger.error(f"抓取股價資料失敗 {stock_id}: {e}")

    # Fallback: 使用 yfinance 抓取
    return await _fetch_price_yfinance(stock_id, start_date, end_date)


async def fetch_price_data_fast(
    stock_id: str,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """選股用：TWSE > yfinance > FinMind（節省額度）"""
    df = await _fetch_price_twse(stock_id, start_date, end_date)
    if not df.empty:
        return df
    df = await _fetch_price_yfinance(stock_id, start_date, end_date)
    if not df.empty:
        return df
    return await fetch_price_data(stock_id, start_date, end_date)


async def _fetch_price_twse(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """使用台灣證交所官方開放資料抓取股價（免費、無額度限制）"""
    try:
        import asyncio
        from datetime import datetime

        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        current = start.replace(day=1)
        all_rows = []

        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
            while current <= end:
                date_str = current.strftime("%Y%m%d")
                try:
                    resp = await client.get(
                        "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY",
                        params={"date": date_str, "stockNo": stock_id, "response": "json"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("stat") == "OK" and data.get("data"):
                            for row in data["data"]:
                                try:
                                    # 日期格式：民國年/月/日，例如 "114/01/15"
                                    parts = row[0].split("/")
                                    year = int(parts[0]) + 1911
                                    month = int(parts[1])
                                    day = int(parts[2])
                                    dt = pd.Timestamp(year=year, month=month, day=day)

                                    def to_f(s: str) -> float:
                                        return float(s.replace(",", "")) if s.replace(",", "").replace(".", "").lstrip("-").isdigit() else 0.0

                                    all_rows.append({
                                        "date": dt,
                                        "Volume": to_f(row[1]),
                                        "Open": to_f(row[3]),
                                        "High": to_f(row[4]),
                                        "Low": to_f(row[5]),
                                        "Close": to_f(row[6]),
                                    })
                                except Exception:
                                    continue
                except Exception:
                    pass

                # 移到下個月
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)
                await asyncio.sleep(0.15)  # 避免請求過快

        if all_rows:
            df = pd.DataFrame(all_rows)
            df = df.sort_values("date").reset_index(drop=True)
            start_ts = pd.Timestamp(start_date)
            end_ts = pd.Timestamp(end_date)
            df = df[(df["date"] >= start_ts) & (df["date"] <= end_ts)]
            if not df.empty:
                return df
    except Exception as e:
        logger.error(f"TWSE API 抓取失敗 {stock_id}: {e}")
    return pd.DataFrame()


async def _fetch_price_yfinance(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """備援：使用 yfinance 抓取"""
    try:
        import yfinance as yf

        for suffix in (".TW", ".TWO"):
            ticker = f"{stock_id}{suffix}"
            try:
                df = yf.download(
                    ticker, start=start_date, end=end_date,
                    progress=False, auto_adjust=True
                )
            except Exception:
                continue
            if df.empty:
                continue
            # 新版 yfinance 回傳多層欄位 (MultiIndex)，需攤平
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            df = df.reset_index()
            # Date 欄位可能叫 "Date" 或 "Datetime"
            date_col = "Date" if "Date" in df.columns else df.columns[0]
            df["date"] = pd.to_datetime(df[date_col])
            # 確保必要欄位存在
            required = {"Open", "High", "Low", "Close", "Volume"}
            if not required.issubset(set(df.columns)):
                continue
            return df[["date", "Open", "High", "Low", "Close", "Volume"]].copy()
    except Exception as e:
        logger.error(f"yfinance 也無法抓取 {stock_id}: {e}")
    return pd.DataFrame()


async def fetch_institutional_data(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """抓取三大法人買賣超資料"""
    try:
        params = {
            "dataset": "TaiwanStockInstitutionalInvestors",
            "data_id": stock_id,
            "start_date": start_date,
            "end_date": end_date,
        }
        if FINMIND_TOKEN:
            params["token"] = FINMIND_TOKEN
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINMIND_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200 and data["data"]:
                df = pd.DataFrame(data["data"])
                df["date"] = pd.to_datetime(df["date"])
                # pivot: 將法人類型轉成欄位
                df_pivot = df.pivot_table(
                    index="date",
                    columns="name",
                    values="buy_sell",
                    aggfunc="sum",
                ).reset_index()
                # 統一欄位名稱
                col_map = {
                    "外陸資買賣超股數(不含外資自營商)": "foreign_net",
                    "外資": "foreign_net",
                    "投信": "trust_net",
                    "自營商": "dealer_net",
                }
                df_pivot = df_pivot.rename(
                    columns={k: v for k, v in col_map.items() if k in df_pivot.columns}
                )
                for col in ["foreign_net", "trust_net", "dealer_net"]:
                    if col not in df_pivot.columns:
                        df_pivot[col] = 0
                df_pivot["total_net"] = (
                    df_pivot["foreign_net"]
                    + df_pivot["trust_net"]
                    + df_pivot["dealer_net"]
                )
                return df_pivot.sort_values("date").reset_index(drop=True)
    except Exception as e:
        logger.error(f"抓取法人資料失敗 {stock_id}: {e}")
    return pd.DataFrame()


async def fetch_income_statement(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """抓取綜合損益表"""
    try:
        params = {
            "dataset": "TaiwanStockFinancialStatements",
            "data_id": stock_id,
            "start_date": start_date,
            "end_date": end_date,
        }
        if FINMIND_TOKEN:
            params["token"] = FINMIND_TOKEN
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINMIND_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200 and data["data"]:
                df = pd.DataFrame(data["data"])
                df["date"] = pd.to_datetime(df["date"])
                return df.sort_values("date").reset_index(drop=True)
    except Exception as e:
        logger.error(f"抓取財報失敗 {stock_id}: {e}")
    return pd.DataFrame()


async def fetch_balance_sheet(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """抓取資產負債表"""
    try:
        params = {
            "dataset": "TaiwanStockBalanceSheet",
            "data_id": stock_id,
            "start_date": start_date,
            "end_date": end_date,
        }
        if FINMIND_TOKEN:
            params["token"] = FINMIND_TOKEN
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINMIND_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200 and data["data"]:
                df = pd.DataFrame(data["data"])
                df["date"] = pd.to_datetime(df["date"])
                return df.sort_values("date").reset_index(drop=True)
    except Exception as e:
        logger.error(f"抓取資產負債表失敗 {stock_id}: {e}")
    return pd.DataFrame()


async def fetch_market_day_all() -> list[dict]:
    """
    抓取台股主要個股當日行情。
    資料源：TWSE MIS 盤中即時系統（mis.twse.com.tw），免費無需驗證，支援批量查詢。
    結果快取 10 分鐘。
    回傳欄位：stock_id, stock_name, open, high, low, close,
              change_pct, amplitude, volume_lots, volume_amount
    """
    import time
    if _market_day_cache.get("data") and (time.time() - _market_day_cache.get("ts", 0)) < 600:
        logger.info("使用快取的市場日行情資料")
        return _market_day_cache["data"]

    MAJOR_STOCKS = [
        "2330", "2317", "2454", "2412", "2882", "2881", "2886", "2891",
        "2884", "5880", "2892", "2883", "2887", "2880", "2885",
        "1301", "1303", "2002", "6505", "1326", "3008", "2308", "2382",
        "2357", "2395", "2303", "3711", "2408", "6669", "4938", "2379",
        "3034", "2345", "6770", "3443", "2327", "3231", "2353",
        "2376", "2344", "4904", "4903", "2354", "2474", "3481",
        "1402", "9910", "2337", "3035", "2409",
        "6176", "2207", "2105", "1216", "2371", "2610",
        "2615", "2603", "2609", "5871", "6278", "3023", "2049", "1590",
        "2201", "3706", "6271", "5274", "3105", "8046",
        "2633", "1101", "1102", "6415", "2498",
    ]

    BATCH_SIZE = 50  # MIS API 每次最多查 50 支（URL 長度限制）
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://mis.twse.com.tw/stock/fibest.html",
    }

    def _parse_float(s: str) -> float:
        try:
            return float(str(s).replace(",", "").strip())
        except Exception:
            return 0.0

    results = []
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        for i in range(0, len(MAJOR_STOCKS), BATCH_SIZE):
            batch = MAJOR_STOCKS[i: i + BATCH_SIZE]
            ex_ch = "|".join(f"tse_{sid}.tw" for sid in batch)
            try:
                resp = await client.get(
                    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp",
                    params={"ex_ch": ex_ch, "json": "1", "delay": "0"},
                )
                if resp.status_code != 200:
                    logger.warning(f"MIS API 批次 {i} 失敗，status={resp.status_code}")
                    continue

                j = resp.json()
                trade_date = ""
                for s in j.get("msgArray", []):
                    try:
                        raw_id = str(s.get("@", "")).replace(".tw", "")
                        stock_name = s.get("n", raw_id)
                        close = _parse_float(s.get("z") or s.get("pz") or "0")
                        open_p = _parse_float(s.get("o") or "0")
                        high = _parse_float(s.get("h") or "0")
                        low = _parse_float(s.get("l") or "0")
                        prev_close = _parse_float(s.get("y") or "0")
                        volume = _parse_float(s.get("v") or "0")   # 張數（MIS 已是張）
                        raw_date = str(s.get("^", "")).strip()
                        if raw_date and len(raw_date) == 8:
                            trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"

                        if close <= 0 or prev_close <= 0:
                            continue

                        change_pct = (close - prev_close) / prev_close * 100
                        amplitude = ((high - low) / prev_close * 100) if high > 0 and low > 0 else 0.0
                        volume_lots = int(volume)
                        volume_amount = round(volume_lots * close / 1e4, 2)  # 億元

                        results.append({
                            "stock_id": raw_id,
                            "stock_name": stock_name,
                            "date": trade_date,
                            "open": round(open_p, 2),
                            "high": round(high, 2),
                            "low": round(low, 2),
                            "close": round(close, 2),
                            "change_pct": round(change_pct, 2),
                            "amplitude": round(amplitude, 2),
                            "volume_lots": volume_lots,
                            "volume_amount": volume_amount,
                        })
                    except Exception as e:
                        logger.debug(f"MIS parse error: {e}")
                        continue

            except Exception as e:
                logger.warning(f"MIS API 批次 {i} 例外: {e}")
                continue

    logger.info(f"TWSE MIS 取得 {len(results)} 支台股當日行情")

    if results:
        import time as _time
        _market_day_cache["data"] = results
        _market_day_cache["ts"] = _time.time()

    return results


async def fetch_ma_volume_batch(stock_ids: list[str]) -> dict[str, dict]:
    """
    批量取得 MA5/MA20 及前一交易日成交量（張）。
    先試 yfinance 批量，若有缺失改用 TWSE STOCK_DAY 逐支補齊。
    """
    if not stock_ids:
        return {}

    from datetime import datetime, timedelta
    today = datetime.today()
    today_date = today.date()

    # Step 1: yfinance 批量
    result = await _fetch_ma_yfinance(stock_ids, today, today_date)
    logger.info(f"yfinance MA 批量: {len(result)}/{len(stock_ids)} 支")

    # Step 2: TWSE STOCK_DAY 補齊缺失
    missing = [sid for sid in stock_ids if sid not in result]
    if missing:
        logger.info(f"改用 TWSE STOCK_DAY 補齊 {len(missing)} 支: {missing}")
        twse_result = await _fetch_ma_twse(missing, today, today_date)
        result.update(twse_result)
        logger.info(f"TWSE 補齊後共 {len(result)}/{len(stock_ids)} 支")

    return result


def _extract_prev_volume_lots(volumes, index, today_date):
    """取前一交易日成交量（張）。若最後一根是今天則取 [-2]，否則取 [-1]。"""
    n = len(volumes)
    if n < 1:
        return None
    try:
        last = index[-1]
        if hasattr(last, "date"):
            last = last.date()
        elif hasattr(last, "item"):
            import numpy as np
            last = pd.Timestamp(last).date()
        is_today = (last == today_date)
        idx = -2 if (is_today and n >= 2) else -1
        return int(volumes[idx]) // 1000
    except Exception:
        return int(volumes[-1]) // 1000 if n >= 1 else None


async def _fetch_ma_yfinance(stock_ids: list[str], today, today_date) -> dict[str, dict]:
    from datetime import timedelta
    start = (today - timedelta(days=60)).strftime("%Y-%m-%d")
    end_str = today.strftime("%Y-%m-%d")
    tickers = [f"{sid}.TW" for sid in stock_ids]

    def _download_sync():
        import yfinance as yf
        return yf.download(tickers, start=start, end=end_str, progress=False, auto_adjust=True)

    try:
        loop = _aio.get_event_loop()
        df_all = await loop.run_in_executor(None, _download_sync)
    except Exception as e:
        logger.warning(f"yfinance 批量下載例外: {e}")
        return {}

    if df_all.empty:
        logger.warning("yfinance 批量下載回傳空 DataFrame")
        return {}

    is_multi = isinstance(df_all.columns, pd.MultiIndex)
    new_style = False
    if is_multi:
        lv0 = set(df_all.columns.get_level_values(0))
        FIELDS = {"Close", "Open", "High", "Low", "Volume", "Adj Close"}
        new_style = bool(lv0 & FIELDS)
    logger.info(f"yfinance shape={df_all.shape}, is_multi={is_multi}, new_style={new_style}")

    result: dict[str, dict] = {}
    single = len(tickers) == 1

    for sid, ticker in zip(stock_ids, tickers):
        try:
            if single:
                df = df_all.copy()
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                df = df.dropna(how="all")
            elif not is_multi:
                continue
            elif new_style:
                lv1 = df_all.columns.get_level_values(1)
                key = ticker if ticker in lv1 else (f"{sid}.TWO" if f"{sid}.TWO" in lv1 else None)
                if key is None:
                    continue
                df = df_all.xs(key, level=1, axis=1).dropna(how="all")
            else:
                lv0_vals = df_all.columns.get_level_values(0)
                if ticker not in lv0_vals:
                    continue
                df = df_all[ticker].dropna(how="all")

            if df.empty or "Close" not in df.columns or "Volume" not in df.columns:
                continue
            closes = df["Close"].values.astype(float)
            volumes = df["Volume"].values.astype(float)
            n = len(closes)
            if n < 1:
                continue
            ma5 = round(float(closes[-5:].mean()), 2) if n >= 5 else None
            ma20 = round(float(closes[-20:].mean()), 2) if n >= 20 else None
            prev_volume_lots = _extract_prev_volume_lots(volumes, df.index, today_date)
            # 順帶計算技術評分
            try:
                from app.services.technical_analysis import compute_indicators, compute_technical_score
                df_ind = compute_indicators(df.copy())
                tech = compute_technical_score(df_ind)
                tech_score = round(tech["score"], 1)
            except Exception:
                tech_score = None
            result[sid] = {"ma5": ma5, "ma20": ma20, "prev_volume_lots": prev_volume_lots, "tech_score": tech_score}
        except Exception as e:
            logger.debug(f"yfinance 解析 {sid}: {e}")
    return result


async def _fetch_ma_twse(stock_ids: list[str], today, today_date) -> dict[str, dict]:
    from datetime import timedelta
    start = (today - timedelta(days=70)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    sem = _aio.Semaphore(5)

    async def _one(sid: str):
        async with sem:
            try:
                from app.services.technical_analysis import compute_indicators, compute_technical_score
                df = await _fetch_price_twse(sid, start, end)
                if df.empty or len(df) < 1:
                    logger.debug(f"TWSE STOCK_DAY 無資料 {sid}")
                    return sid, None
                closes = df["Close"].values.astype(float)
                volumes = df["Volume"].values.astype(float)  # 股數
                n = len(closes)
                ma5 = round(float(closes[-5:].mean()), 2) if n >= 5 else None
                ma20 = round(float(closes[-20:].mean()), 2) if n >= 20 else None
                prev_volume_lots = _extract_prev_volume_lots(volumes, df["date"].values, today_date)
                # 順帶計算技術評分
                try:
                    df_ind = compute_indicators(df.copy())
                    tech = compute_technical_score(df_ind)
                    tech_score = round(tech["score"], 1)
                except Exception:
                    tech_score = None
                logger.info(f"TWSE {sid}: n={n}, prev_vol={prev_volume_lots}, ma5={ma5}, tech={tech_score}")
                return sid, {"ma5": ma5, "ma20": ma20, "prev_volume_lots": prev_volume_lots, "tech_score": tech_score}
            except Exception as e:
                logger.debug(f"TWSE MA 失敗 {sid}: {e}")
                return sid, None

    results = await _aio.gather(*[_one(sid) for sid in stock_ids])
    return {sid: data for sid, data in results if data is not None}
