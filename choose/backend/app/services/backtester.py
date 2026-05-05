"""
策略回測引擎
支援：均線交叉、MACD、RSI、籌碼、綜合評分策略
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional
import logging

from app.services.technical_analysis import compute_indicators, compute_technical_score

logger = logging.getLogger(__name__)


class Backtester:
    """輕量級回測引擎（無槓桿、純做多）"""

    def __init__(
        self,
        df_price: pd.DataFrame,
        df_institutional: Optional[pd.DataFrame] = None,
        initial_capital: float = 1_000_000,
        commission_rate: float = 0.001425,
        tax_rate: float = 0.003,
    ):
        self.df = df_price.copy()
        self.df_inst = df_institutional
        self.capital = initial_capital
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate
        self.tax_rate = tax_rate

        # 計算技術指標
        self.df = compute_indicators(self.df)
        self.df = self.df.reset_index(drop=True)

        self.position = 0        # 持股數量
        self.avg_cost = 0.0      # 平均成本
        self.trades = []
        self.equity_curve = []

    def run(
        self,
        strategy: str = "combined",
        short_ma: int = 5,
        long_ma: int = 20,
        rsi_oversold: float = 30,
        rsi_overbought: float = 70,
        score_threshold: float = 60,
    ) -> dict:
        """執行回測，返回績效報告"""
        for i in range(long_ma, len(self.df)):
            row = self.df.iloc[i]
            date = str(row["date"].date())
            close = float(row["Close"])

            signal = self._get_signal(
                i, strategy, short_ma, long_ma,
                rsi_oversold, rsi_overbought, score_threshold
            )

            if signal == "BUY" and self.position == 0 and self.capital > close:
                shares = int(self.capital * 0.95 / close / 1000) * 1000
                if shares >= 1000:
                    cost = shares * close
                    commission = cost * self.commission_rate
                    total_cost = cost + commission
                    if total_cost <= self.capital:
                        self.capital -= total_cost
                        self.position = shares
                        self.avg_cost = close
                        self.trades.append({
                            "date": date,
                            "action": "BUY",
                            "price": close,
                            "shares": shares,
                            "amount": cost,
                            "commission": round(commission, 2),
                            "tax": 0.0,
                            "profit_loss": None,
                        })

            elif signal == "SELL" and self.position > 0:
                revenue = self.position * close
                commission = revenue * self.commission_rate
                tax = revenue * self.tax_rate
                net_revenue = revenue - commission - tax
                profit = net_revenue - self.avg_cost * self.position
                pct = profit / (self.avg_cost * self.position) * 100

                self.trades.append({
                    "date": date,
                    "action": "SELL",
                    "price": close,
                    "shares": self.position,
                    "amount": revenue,
                    "commission": round(commission, 2),
                    "tax": round(tax, 2),
                    "profit_loss": round(pct, 2),
                })
                self.capital += net_revenue
                self.position = 0
                self.avg_cost = 0.0

            # 資產曲線
            portfolio_value = self.capital + self.position * close
            self.equity_curve.append({"date": date, "value": round(portfolio_value, 2)})

        # 強制平倉（最後一天）
        if self.position > 0:
            last = self.df.iloc[-1]
            close = float(last["Close"])
            revenue = self.position * close
            commission = revenue * self.commission_rate
            tax = revenue * self.tax_rate
            net_revenue = revenue - commission - tax
            profit = net_revenue - self.avg_cost * self.position
            pct = profit / (self.avg_cost * self.position) * 100
            self.trades.append({
                "date": str(last["date"].date()),
                "action": "SELL",
                "price": close,
                "shares": self.position,
                "amount": revenue,
                "commission": round(commission, 2),
                "tax": round(tax, 2),
                "profit_loss": round(pct, 2),
            })
            self.capital += net_revenue
            self.position = 0

        return self._compute_metrics()

    def _get_signal(
        self, i: int, strategy: str,
        short_ma: int, long_ma: int,
        rsi_oversold: float, rsi_overbought: float,
        score_threshold: float,
    ) -> str:
        row = self.df.iloc[i]
        prev = self.df.iloc[i - 1]

        if strategy == "ma_cross":
            return self._signal_ma_cross(row, prev, short_ma, long_ma)
        elif strategy == "macd":
            return self._signal_macd(row, prev)
        elif strategy == "rsi":
            return self._signal_rsi(row, rsi_oversold, rsi_overbought)
        elif strategy == "chip":
            return self._signal_chip(row)
        else:  # combined
            return self._signal_combined(row, prev, rsi_oversold, rsi_overbought, score_threshold)

    def _signal_ma_cross(self, row, prev, short_ma: int, long_ma: int) -> str:
        short_col = f"ma{short_ma}"
        long_col = f"ma{long_ma}"
        s, l = row.get(short_col), row.get(long_col)
        ps, pl = prev.get(short_col), prev.get(long_col)
        if any(pd.isna(v) for v in [s, l, ps, pl]):
            return "HOLD"
        if s > l and ps <= pl:
            return "BUY"
        if s < l and ps >= pl:
            return "SELL"
        return "HOLD"

    def _signal_macd(self, row, prev) -> str:
        h, ph = row.get("macd_hist"), prev.get("macd_hist")
        if pd.isna(h) or pd.isna(ph):
            return "HOLD"
        if h > 0 and ph <= 0:
            return "BUY"
        if h < 0 and ph >= 0:
            return "SELL"
        return "HOLD"

    def _signal_rsi(self, row, oversold: float, overbought: float) -> str:
        rsi = row.get("rsi_14")
        if pd.isna(rsi):
            return "HOLD"
        if rsi < oversold:
            return "BUY"
        if rsi > overbought:
            return "SELL"
        return "HOLD"

    def _signal_chip(self, row) -> str:
        """根據籌碼面（三大法人）產生訊號"""
        if self.df_inst is None or self.df_inst.empty:
            return "HOLD"
        date = row.get("date")
        inst_row = self.df_inst[self.df_inst["date"] == date]
        if inst_row.empty:
            return "HOLD"
        total_net = inst_row.iloc[0].get("total_net", 0)
        if total_net > 500_000:  # 買超50萬股以上
            return "BUY"
        if total_net < -500_000:
            return "SELL"
        return "HOLD"

    def _signal_combined(
        self, row, prev, rsi_oversold: float, rsi_overbought: float, threshold: float
    ) -> str:
        """綜合評分策略（技術面+籌碼面加權）"""
        score = 50.0

        # 技術面加分
        rsi = row.get("rsi_14")
        if pd.notna(rsi):
            if rsi < rsi_oversold:
                score += 15
            elif rsi > rsi_overbought:
                score -= 15

        h = row.get("macd_hist")
        ph = prev.get("macd_hist")
        if pd.notna(h) and pd.notna(ph):
            if h > 0 and ph <= 0:
                score += 15
            elif h < 0 and ph >= 0:
                score -= 15
            elif h > 0:
                score += 5
            else:
                score -= 5

        ma5 = row.get("ma5")
        ma20 = row.get("ma20")
        pma5 = prev.get("ma5")
        pma20 = prev.get("ma20")
        if all(pd.notna(v) for v in [ma5, ma20, pma5, pma20]):
            if ma5 > ma20 and pma5 <= pma20:
                score += 15
            elif ma5 < ma20 and pma5 >= pma20:
                score -= 15

        # 籌碼面加分
        if self.df_inst is not None and not self.df_inst.empty:
            date = row.get("date")
            inst_row = self.df_inst[self.df_inst["date"] == date]
            if not inst_row.empty:
                total_net = inst_row.iloc[0].get("total_net", 0)
                if total_net > 1_000_000:
                    score += 10
                elif total_net > 0:
                    score += 5
                elif total_net < -1_000_000:
                    score -= 10
                elif total_net < 0:
                    score -= 5

        score = max(0, min(100, score))
        if score >= threshold:
            return "BUY"
        if score <= 100 - threshold:
            return "SELL"
        return "HOLD"

    def _compute_metrics(self) -> dict:
        """計算績效指標"""
        if not self.equity_curve:
            return {}

        final_capital = self.capital
        total_return = (final_capital - self.initial_capital) / self.initial_capital * 100

        # 年化報酬率
        first_date = datetime.fromisoformat(self.equity_curve[0]["date"])
        last_date = datetime.fromisoformat(self.equity_curve[-1]["date"])
        years = max((last_date - first_date).days / 365.25, 0.01)
        annual_return = ((1 + total_return / 100) ** (1 / years) - 1) * 100

        # 最大回撤
        values = [e["value"] for e in self.equity_curve]
        max_drawdown = self._calc_max_drawdown(values)

        # 夏普比率（假設無風險利率 1.5%）
        returns = pd.Series(values).pct_change().dropna()
        risk_free = 0.015 / 252
        if returns.std() > 0:
            sharpe = (returns.mean() - risk_free) / returns.std() * np.sqrt(252)
        else:
            sharpe = 0.0

        # 交易統計
        sell_trades = [t for t in self.trades if t["action"] == "SELL" and t.get("profit_loss") is not None]
        profit_trades = [t for t in sell_trades if t["profit_loss"] > 0]
        loss_trades = [t for t in sell_trades if t["profit_loss"] <= 0]

        win_rate = len(profit_trades) / len(sell_trades) * 100 if sell_trades else 0
        avg_profit = np.mean([t["profit_loss"] for t in profit_trades]) if profit_trades else 0
        avg_loss = np.mean([t["profit_loss"] for t in loss_trades]) if loss_trades else 0

        total_profit = sum(t["profit_loss"] for t in profit_trades) if profit_trades else 0
        total_loss = abs(sum(t["profit_loss"] for t in loss_trades)) if loss_trades else 0
        profit_factor = total_profit / total_loss if total_loss > 0 else float("inf")

        # 大盤比較（買入持有策略）
        if len(self.df) >= 2:
            bench_start = float(self.df.iloc[0]["Close"])
            bench_end = float(self.df.iloc[-1]["Close"])
            benchmark_return = (bench_end - bench_start) / bench_start * 100
        else:
            benchmark_return = 0.0

        return {
            "final_capital": round(final_capital, 2),
            "total_return": round(total_return, 2),
            "annual_return": round(annual_return, 2),
            "max_drawdown": round(max_drawdown, 2),
            "sharpe_ratio": round(float(sharpe), 3),
            "win_rate": round(win_rate, 2),
            "total_trades": len(sell_trades),
            "profit_trades": len(profit_trades),
            "loss_trades": len(loss_trades),
            "avg_profit": round(float(avg_profit), 2),
            "avg_loss": round(float(avg_loss), 2),
            "profit_factor": round(min(float(profit_factor), 999), 2),
            "trades": self.trades,
            "equity_curve": self.equity_curve,
            "benchmark_return": round(benchmark_return, 2),
        }

    @staticmethod
    def _calc_max_drawdown(values: list) -> float:
        peak = values[0]
        max_dd = 0.0
        for v in values:
            if v > peak:
                peak = v
            dd = (peak - v) / peak * 100
            if dd > max_dd:
                max_dd = dd
        return max_dd
