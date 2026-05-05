"""
籌碼面分析服務
計算三大法人買賣超評分
"""
import pandas as pd
import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def compute_institutional_score(df: pd.DataFrame) -> dict:
    """
    計算籌碼面評分（0~100）
    分析外資、投信、自營商買賣超
    """
    if df.empty:
        return {"score": 50.0, "reasons": [], "stats": {}}

    score = 50.0
    reasons = []

    # 取最近30天資料
    df_recent = df.tail(30).copy()

    # ---- 外資分析 ----
    foreign = df_recent["foreign_net"].values if "foreign_net" in df_recent.columns else []
    if len(foreign) > 0:
        foreign_sum_3d = sum(foreign[-3:])
        foreign_sum_10d = sum(foreign[-10:])
        consecutive_buy = _consecutive_days(foreign)

        if foreign_sum_3d > 0:
            score += 10
            reasons.append(f"外資近3日買超 {foreign_sum_3d/1000:.0f}千股")
        elif foreign_sum_3d < 0:
            score -= 10
            reasons.append(f"外資近3日賣超 {abs(foreign_sum_3d)/1000:.0f}千股")

        if foreign_sum_10d > 0:
            score += 8
        elif foreign_sum_10d < 0:
            score -= 8

        if consecutive_buy >= 5:
            score += 15
            reasons.append(f"外資連續買超 {consecutive_buy} 天")
        elif consecutive_buy >= 3:
            score += 8
            reasons.append(f"外資連續買超 {consecutive_buy} 天")
        elif consecutive_buy <= -5:
            score -= 15
            reasons.append(f"外資連續賣超 {abs(consecutive_buy)} 天")
        elif consecutive_buy <= -3:
            score -= 8

    # ---- 投信分析 ----
    trust = df_recent["trust_net"].values if "trust_net" in df_recent.columns else []
    if len(trust) > 0:
        trust_sum_3d = sum(trust[-3:])
        trust_consecutive = _consecutive_days(trust)

        if trust_sum_3d > 0:
            score += 8
            reasons.append(f"投信近3日買超")
        elif trust_sum_3d < 0:
            score -= 5

        if trust_consecutive >= 3:
            score += 10
            reasons.append(f"投信連續買超 {trust_consecutive} 天")
        elif trust_consecutive <= -3:
            score -= 8

    # ---- 自營商分析 ----
    dealer = df_recent["dealer_net"].values if "dealer_net" in df_recent.columns else []
    if len(dealer) > 0:
        dealer_sum_3d = sum(dealer[-3:])
        if dealer_sum_3d > 0:
            score += 5

    # ---- 三大法人合計 ----
    total = df_recent["total_net"].values if "total_net" in df_recent.columns else []
    if len(total) > 0:
        total_sum_5d = sum(total[-5:])
        if total_sum_5d > 0:
            score += 5
            reasons.append(f"三大法人近5日合計買超")
        elif total_sum_5d < 0:
            score -= 5

    score = max(0.0, min(100.0, score))

    # 統計資訊
    stats = {}
    if len(foreign) > 0:
        stats["foreign_net_3d"] = float(sum(foreign[-3:]))
        stats["foreign_net_10d"] = float(sum(foreign[-10:]))
        stats["foreign_consecutive"] = int(_consecutive_days(foreign))
    if len(trust) > 0:
        stats["trust_net_3d"] = float(sum(trust[-3:]))
        stats["trust_consecutive"] = int(_consecutive_days(trust))
    if len(total) > 0:
        stats["total_net_5d"] = float(sum(total[-5:]))

    return {
        "score": round(score, 1),
        "reasons": reasons,
        "stats": stats,
    }


def _consecutive_days(arr) -> int:
    """
    計算最近連續買超（正）或賣超（負）天數
    返回正數 = 連買天數，負數 = 連賣天數
    """
    if len(arr) == 0:
        return 0
    latest_sign = 1 if arr[-1] > 0 else -1
    count = 0
    for v in reversed(arr):
        sign = 1 if v > 0 else -1
        if sign == latest_sign:
            count += 1
        else:
            break
    return count * latest_sign
