"""
基本面分析服務
解析財務報表並計算評分
"""
import pandas as pd
import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def parse_income_statement(df: pd.DataFrame) -> list[dict]:
    """將 FinMind 綜合損益表解析成標準格式"""
    if df.empty:
        return []

    results = []
    for date, group in df.groupby("date"):
        row = {"date": str(date.date())}
        values = dict(zip(group["type"], group["value"]))

        row["revenue"] = _get_val(values, ["營業收入合計", "收入合計", "net_revenue"])
        row["gross_profit"] = _get_val(values, ["營業毛利（毛損）", "gross_profit"])
        row["operating_income"] = _get_val(values, ["營業利益（損失）", "operating_income"])
        row["net_income"] = _get_val(values, ["本期淨利（淨損）", "net_income"])
        row["eps"] = _get_val(values, ["基本每股盈餘（元）", "eps"])

        # 計算利潤率
        if row["revenue"] and row["revenue"] != 0:
            if row["gross_profit"] is not None:
                row["gross_margin"] = round(row["gross_profit"] / row["revenue"] * 100, 2)
            if row["operating_income"] is not None:
                row["operating_margin"] = round(row["operating_income"] / row["revenue"] * 100, 2)
            if row["net_income"] is not None:
                row["net_margin"] = round(row["net_income"] / row["revenue"] * 100, 2)

        results.append(row)

    return sorted(results, key=lambda x: x["date"])


def parse_balance_sheet(df: pd.DataFrame) -> list[dict]:
    """解析資產負債表"""
    if df.empty:
        return []

    results = []
    for date, group in df.groupby("date"):
        row = {"date": str(date.date())}
        values = dict(zip(group["type"], group["value"]))

        total_assets = _get_val(values, ["資產總計", "total_assets"])
        total_liabilities = _get_val(values, ["負債總計", "total_liabilities"])
        equity = _get_val(values, ["權益總計", "equity"])

        row["total_assets"] = total_assets
        row["total_liabilities"] = total_liabilities
        row["equity"] = equity

        if total_assets and total_assets != 0 and total_liabilities is not None:
            row["debt_ratio"] = round(total_liabilities / total_assets * 100, 2)

        results.append(row)

    return sorted(results, key=lambda x: x["date"])


def compute_valuation(
    income_stmts: list[dict],
    balance_sheets: list[dict],
    current_price: float,
) -> dict:
    """計算估值指標（P/E, P/B, ROE, ROA）"""
    valuation = {}

    if not income_stmts:
        return valuation

    latest_income = income_stmts[-1]
    eps = latest_income.get("eps")
    net_income = latest_income.get("net_income")

    if eps and eps > 0 and current_price > 0:
        valuation["pe_ratio"] = round(current_price / eps, 2)

    if balance_sheets:
        latest_bs = balance_sheets[-1]
        equity = latest_bs.get("equity")
        total_assets = latest_bs.get("total_assets")

        if equity and equity > 0:
            # P/B（需要每股淨值，這裡用總股本估算）
            # P/B ≈ 市值 / 淨值  → 用 EPS * PE / (淨值/EPS) 估算
            # 簡化：若有 EPS 和 equity 可用近似值
            if eps and eps > 0:
                estimated_bvps = equity / (net_income / eps) if net_income and net_income != 0 else None
                if estimated_bvps and estimated_bvps > 0:
                    valuation["pb_ratio"] = round(current_price / estimated_bvps, 2)

            if net_income:
                valuation["roe"] = round(net_income / equity * 100, 2)

            if total_assets and total_assets > 0 and net_income:
                valuation["roa"] = round(net_income / total_assets * 100, 2)

    # YoY 成長率（比較最近兩期）
    if len(income_stmts) >= 2:
        curr = income_stmts[-1]
        prev = income_stmts[-5] if len(income_stmts) >= 5 else income_stmts[0]

        if curr.get("revenue") and prev.get("revenue") and prev["revenue"] != 0:
            valuation["revenue_growth_yoy"] = round(
                (curr["revenue"] - prev["revenue"]) / abs(prev["revenue"]) * 100, 2
            )

        if curr.get("eps") and prev.get("eps") and prev["eps"] != 0:
            valuation["eps_growth_yoy"] = round(
                (curr["eps"] - prev["eps"]) / abs(prev["eps"]) * 100, 2
            )

    return valuation


def compute_fundamental_score(
    income_stmts: list[dict],
    balance_sheets: list[dict],
    valuation: dict,
) -> dict:
    """
    計算基本面評分（0~100）
    """
    score = 50.0
    reasons = []

    # ---- 獲利能力 ----
    if income_stmts:
        latest = income_stmts[-1]

        gross_margin = latest.get("gross_margin")
        if gross_margin is not None:
            if gross_margin > 50:
                score += 15
                reasons.append(f"毛利率高達 {gross_margin:.1f}%（>50%）")
            elif gross_margin > 30:
                score += 8
                reasons.append(f"毛利率 {gross_margin:.1f}%（>30%）")
            elif gross_margin < 10:
                score -= 10
                reasons.append(f"毛利率偏低 {gross_margin:.1f}%（<10%）")

        net_margin = latest.get("net_margin")
        if net_margin is not None:
            if net_margin > 20:
                score += 10
            elif net_margin > 10:
                score += 5
            elif net_margin < 0:
                score -= 15
                reasons.append("淨利率為負（虧損）")

    # ---- ROE ----
    roe = valuation.get("roe")
    if roe is not None:
        if roe > 20:
            score += 15
            reasons.append(f"ROE {roe:.1f}%（>20%，優秀）")
        elif roe > 15:
            score += 8
            reasons.append(f"ROE {roe:.1f}%（>15%）")
        elif roe > 8:
            score += 3
        elif roe < 0:
            score -= 15
            reasons.append(f"ROE 為負 {roe:.1f}%")

    # ---- P/E 估值 ----
    pe = valuation.get("pe_ratio")
    if pe is not None and pe > 0:
        if pe < 12:
            score += 10
            reasons.append(f"本益比低估（P/E={pe:.1f}）")
        elif pe < 20:
            score += 5
        elif pe > 40:
            score -= 10
            reasons.append(f"本益比偏高（P/E={pe:.1f}）")

    # ---- 成長性 ----
    rev_growth = valuation.get("revenue_growth_yoy")
    if rev_growth is not None:
        if rev_growth > 20:
            score += 10
            reasons.append(f"營收年增率 {rev_growth:.1f}%（>20%，高成長）")
        elif rev_growth > 10:
            score += 5
        elif rev_growth < -10:
            score -= 10
            reasons.append(f"營收年衰退 {rev_growth:.1f}%")

    eps_growth = valuation.get("eps_growth_yoy")
    if eps_growth is not None:
        if eps_growth > 20:
            score += 8
            reasons.append(f"EPS 年增率 {eps_growth:.1f}%（高成長）")
        elif eps_growth < -10:
            score -= 8

    # ---- 財務結構 ----
    if balance_sheets:
        latest_bs = balance_sheets[-1]
        debt_ratio = latest_bs.get("debt_ratio")
        if debt_ratio is not None:
            if debt_ratio < 30:
                score += 8
                reasons.append(f"負債比率低 {debt_ratio:.1f}%（財務穩健）")
            elif debt_ratio > 70:
                score -= 10
                reasons.append(f"負債比率高 {debt_ratio:.1f}%（財務風險）")

    score = max(0.0, min(100.0, score))
    return {"score": round(score, 1), "reasons": reasons}


def _get_val(d: dict, keys: list) -> Optional[float]:
    """從字典中按候選鍵名查值"""
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return float(d[k])
            except (ValueError, TypeError):
                continue
    return None
