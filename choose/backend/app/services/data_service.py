"""
資料抓取服務
使用 FinMind API（台股免費資料源）
"""
import httpx
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data"

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
                return [
                    {
                        "stock_id": r["stock_id"],
                        "stock_name": r["stock_name"],
                        "industry": r.get("industry_category", ""),
                        "market": r.get("market", ""),
                    }
                    for r in records
                    if r.get("type") == "股票"
                ]
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                FINMIND_BASE,
                params={
                    "dataset": "TaiwanStockPrice",
                    "data_id": stock_id,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
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


async def _fetch_price_yfinance(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """備援：使用 yfinance 抓取"""
    try:
        import yfinance as yf

        ticker = f"{stock_id}.TW"
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if df.empty:
            ticker = f"{stock_id}.TWO"
            df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if not df.empty:
            df = df.reset_index()
            df["date"] = pd.to_datetime(df["Date"])
            df = df.rename(
                columns={
                    "Open": "Open",
                    "High": "High",
                    "Low": "Low",
                    "Close": "Close",
                    "Volume": "Volume",
                }
            )
            return df
    except Exception as e:
        logger.error(f"yfinance 也無法抓取 {stock_id}: {e}")
    return pd.DataFrame()


async def fetch_institutional_data(
    stock_id: str, start_date: str, end_date: str
) -> pd.DataFrame:
    """抓取三大法人買賣超資料"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                FINMIND_BASE,
                params={
                    "dataset": "TaiwanStockInstitutionalInvestors",
                    "data_id": stock_id,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                FINMIND_BASE,
                params={
                    "dataset": "TaiwanStockFinancialStatements",
                    "data_id": stock_id,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                FINMIND_BASE,
                params={
                    "dataset": "TaiwanStockBalanceSheet",
                    "data_id": stock_id,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 200 and data["data"]:
                df = pd.DataFrame(data["data"])
                df["date"] = pd.to_datetime(df["date"])
                return df.sort_values("date").reset_index(drop=True)
    except Exception as e:
        logger.error(f"抓取資產負債表失敗 {stock_id}: {e}")
    return pd.DataFrame()
