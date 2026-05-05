"""
技術面分析服務
計算技術指標並給出評分
"""
import pandas as pd
import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """計算所有技術指標（RSI、MACD、均線、KD、布林通道）"""
    if df.empty or len(df) < 20:
        return df

    try:
        import ta

        # 移動平均線
        df["ma5"] = ta.trend.sma_indicator(df["Close"], window=5)
        df["ma10"] = ta.trend.sma_indicator(df["Close"], window=10)
        df["ma20"] = ta.trend.sma_indicator(df["Close"], window=20)
        df["ma60"] = ta.trend.sma_indicator(df["Close"], window=60)

        # RSI(14)
        df["rsi_14"] = ta.momentum.rsi(df["Close"], window=14)

        # MACD
        macd = ta.trend.MACD(df["Close"])
        df["macd"] = macd.macd()
        df["macd_signal"] = macd.macd_signal()
        df["macd_hist"] = macd.macd_diff()

        # KD（隨機指標）
        stoch = ta.momentum.StochasticOscillator(
            df["High"], df["Low"], df["Close"], window=9, smooth_window=3
        )
        df["kdj_k"] = stoch.stoch()
        df["kdj_d"] = stoch.stoch_signal()

        # 布林通道
        bb = ta.volatility.BollingerBands(df["Close"], window=20, window_dev=2)
        df["bb_upper"] = bb.bollinger_hband()
        df["bb_middle"] = bb.bollinger_mavg()
        df["bb_lower"] = bb.bollinger_lband()

        # 成交量均線
        df["vol_ma5"] = df["Volume"].rolling(window=5).mean()
        df["vol_ma20"] = df["Volume"].rolling(window=20).mean()

    except Exception as e:
        logger.error(f"計算技術指標失敗: {e}")

    return df


def compute_technical_score(df: pd.DataFrame) -> dict:
    """
    計算技術面評分（0~100）
    並產生買賣訊號
    """
    if df.empty or len(df) < 2:
        return {"score": 50.0, "signal": "HOLD", "reasons": []}

    df = compute_indicators(df)
    last = df.iloc[-1]
    prev = df.iloc[-2]
    score = 50.0
    reasons = []

    # ---- RSI 判斷 ----
    rsi = last.get("rsi_14")
    if pd.notna(rsi):
        if rsi < 30:
            score += 20
            reasons.append("RSI 超賣（低於30）")
        elif rsi < 45:
            score += 10
            reasons.append("RSI 偏低，具備反彈空間")
        elif rsi > 70:
            score -= 20
            reasons.append("RSI 超買（高於70）")
        elif rsi > 60:
            score -= 5

    # ---- MACD 判斷 ----
    macd_hist = last.get("macd_hist")
    prev_macd_hist = prev.get("macd_hist")
    if pd.notna(macd_hist) and pd.notna(prev_macd_hist):
        if macd_hist > 0 and prev_macd_hist <= 0:
            score += 20
            reasons.append("MACD 黃金交叉（死叉翻多）")
        elif macd_hist > 0:
            score += 8
            reasons.append("MACD 柱狀體為正（多頭趨勢）")
        elif macd_hist < 0 and prev_macd_hist >= 0:
            score -= 20
            reasons.append("MACD 死亡交叉（多叉翻空）")
        elif macd_hist < 0:
            score -= 8

    # ---- 均線多頭排列 ----
    ma5 = last.get("ma5")
    ma20 = last.get("ma20")
    ma60 = last.get("ma60")
    close = last.get("Close")
    if pd.notna(ma5) and pd.notna(ma20) and pd.notna(ma60):
        if ma5 > ma20 > ma60:
            score += 15
            reasons.append("均線多頭排列（5>20>60）")
        elif ma5 < ma20 < ma60:
            score -= 15
            reasons.append("均線空頭排列（5<20<60）")

    # ---- 股價相對均線位置 ----
    if pd.notna(close) and pd.notna(ma5) and pd.notna(ma20):
        prev_ma5 = prev.get("ma5")
        prev_ma20 = prev.get("ma20")
        if pd.notna(prev_ma5) and pd.notna(prev_ma20):
            # 短期均線剛突破中期均線（黃金交叉）
            if ma5 > ma20 and prev_ma5 <= prev_ma20:
                score += 15
                reasons.append("5日均線突破20日均線（黃金交叉）")
            elif ma5 < ma20 and prev_ma5 >= prev_ma20:
                score -= 15
                reasons.append("5日均線跌破20日均線（死亡交叉）")

    # ---- KD 判斷 ----
    k = last.get("kdj_k")
    d = last.get("kdj_d")
    if pd.notna(k) and pd.notna(d):
        if k < 20 and d < 20:
            score += 10
            reasons.append("KD 超賣區（低於20）")
        elif k > 80 and d > 80:
            score -= 10
            reasons.append("KD 超買區（高於80）")

    # ---- 布林通道 ----
    bb_lower = last.get("bb_lower")
    bb_upper = last.get("bb_upper")
    if pd.notna(bb_lower) and pd.notna(bb_upper) and pd.notna(close):
        if close < bb_lower:
            score += 8
            reasons.append("股價觸及布林通道下緣（超賣）")
        elif close > bb_upper:
            score -= 8
            reasons.append("股價觸及布林通道上緣（超買）")

    score = max(0.0, min(100.0, score))

    # 決定訊號
    if score >= 70:
        signal = "BUY"
    elif score <= 35:
        signal = "SELL"
    else:
        signal = "HOLD"

    return {
        "score": round(score, 1),
        "signal": signal,
        "reasons": reasons,
        "last": {
            "rsi_14": _safe_float(last.get("rsi_14")),
            "macd": _safe_float(last.get("macd")),
            "macd_signal": _safe_float(last.get("macd_signal")),
            "macd_hist": _safe_float(last.get("macd_hist")),
            "ma5": _safe_float(last.get("ma5")),
            "ma20": _safe_float(last.get("ma20")),
            "ma60": _safe_float(last.get("ma60")),
            "bb_upper": _safe_float(last.get("bb_upper")),
            "bb_middle": _safe_float(last.get("bb_middle")),
            "bb_lower": _safe_float(last.get("bb_lower")),
            "kdj_k": _safe_float(last.get("kdj_k")),
            "kdj_d": _safe_float(last.get("kdj_d")),
        },
    }


def _safe_float(val) -> Optional[float]:
    """安全轉換 float，NaN 轉 None"""
    try:
        f = float(val)
        return None if np.isnan(f) else round(f, 4)
    except Exception:
        return None
