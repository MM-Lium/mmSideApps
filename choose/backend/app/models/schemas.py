"""
Pydantic 資料模型定義
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ---- 通用 ----

class StockInfo(BaseModel):
    stock_id: str
    stock_name: str
    industry: Optional[str] = None
    market: Optional[str] = None


# ---- 技術面 ----

class CandlestickBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class TechnicalIndicators(BaseModel):
    rsi_14: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    ma5: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    kdj_k: Optional[float] = None
    kdj_d: Optional[float] = None


class TechnicalData(BaseModel):
    stock_id: str
    candles: List[CandlestickBar]
    indicators: Optional[TechnicalIndicators] = None
    signal: Optional[str] = None  # BUY / SELL / HOLD
    score: Optional[float] = None  # 0~100


# ---- 基本面 ----

class FinancialStatement(BaseModel):
    date: str
    revenue: Optional[float] = None           # 營業收入
    gross_profit: Optional[float] = None      # 毛利
    operating_income: Optional[float] = None  # 營業利益
    net_income: Optional[float] = None        # 稅後淨利
    eps: Optional[float] = None               # 每股盈餘
    gross_margin: Optional[float] = None      # 毛利率
    operating_margin: Optional[float] = None  # 營益率
    net_margin: Optional[float] = None        # 淨利率


class BalanceSheetData(BaseModel):
    date: str
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    equity: Optional[float] = None
    debt_ratio: Optional[float] = None        # 負債比率


class ValuationMetrics(BaseModel):
    pe_ratio: Optional[float] = None    # 本益比
    pb_ratio: Optional[float] = None    # 股價淨值比
    roe: Optional[float] = None         # 股東權益報酬率
    roa: Optional[float] = None         # 資產報酬率
    revenue_growth_yoy: Optional[float] = None  # 營收年增率
    eps_growth_yoy: Optional[float] = None      # EPS 年增率


class FundamentalData(BaseModel):
    stock_id: str
    income_statements: List[FinancialStatement]
    balance_sheets: List[BalanceSheetData]
    valuation: Optional[ValuationMetrics] = None
    score: Optional[float] = None  # 0~100


# ---- 籌碼面 ----

class InstitutionalTrading(BaseModel):
    date: str
    foreign_net: float       # 外資買賣超
    trust_net: float         # 投信買賣超
    dealer_net: float        # 自營商買賣超
    total_net: float         # 三大法人合計


class InstitutionalData(BaseModel):
    stock_id: str
    records: List[InstitutionalTrading]
    foreign_consecutive_buy: Optional[int] = None   # 外資連買天數
    trust_consecutive_buy: Optional[int] = None     # 投信連買天數
    score: Optional[float] = None  # 0~100


# ---- 選股結果 ----

class ScreenerFilter(BaseModel):
    # 基本面篩選
    min_roe: Optional[float] = None
    max_pe: Optional[float] = None
    max_pb: Optional[float] = None
    min_revenue_growth: Optional[float] = None
    min_eps_growth: Optional[float] = None

    # 技術面篩選
    rsi_min: Optional[float] = Field(None, ge=0, le=100)
    rsi_max: Optional[float] = Field(None, ge=0, le=100)
    require_golden_cross: bool = False    # 要求均線黃金交叉
    require_macd_bullish: bool = False    # 要求 MACD 多頭

    # 籌碼面篩選
    min_foreign_consecutive_buy: Optional[int] = None   # 外資連買天數
    min_trust_consecutive_buy: Optional[int] = None     # 投信連買天數
    require_institutional_net_buy: bool = False          # 三大法人合計買超

    # 權重設定（加總=1）
    fundamental_weight: float = Field(0.35, ge=0, le=1)
    technical_weight: float = Field(0.35, ge=0, le=1)
    institutional_weight: float = Field(0.30, ge=0, le=1)

    # 篩選目標市場
    market: Optional[str] = None  # TWSE / TPEx / ALL
    limit: int = Field(20, ge=1, le=100)


class ScreenerResult(BaseModel):
    stock_id: str
    stock_name: str
    industry: Optional[str] = None
    close: float
    change_pct: float
    fundamental_score: float
    technical_score: float
    institutional_score: float
    total_score: float
    signal: str
    pe_ratio: Optional[float] = None
    roe: Optional[float] = None
    rsi_14: Optional[float] = None
    foreign_net_3d: Optional[float] = None   # 外資近3日買賣超


# ---- 回測 ----

class StrategyType(str, Enum):
    MA_CROSS = "ma_cross"           # 均線交叉
    MACD = "macd"                   # MACD策略
    RSI = "rsi"                     # RSI策略
    CHIP = "chip"                   # 籌碼策略
    COMBINED = "combined"           # 綜合評分策略


class BacktestRequest(BaseModel):
    stock_id: str
    strategy: StrategyType = StrategyType.COMBINED
    start_date: str = "2022-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = Field(1_000_000, ge=10_000)
    commission_rate: float = Field(0.001425, ge=0)  # 手續費率 (0.1425%)
    tax_rate: float = Field(0.003, ge=0)             # 交易稅 (0.3%)

    # 策略參數
    short_ma: int = Field(5, ge=2)
    long_ma: int = Field(20, ge=5)
    rsi_oversold: float = Field(30, ge=10, le=50)
    rsi_overbought: float = Field(70, ge=50, le=90)
    score_threshold: float = Field(60, ge=0, le=100)


class TradeRecord(BaseModel):
    date: str
    action: str  # BUY / SELL
    price: float
    shares: int
    amount: float
    commission: float
    tax: float
    profit_loss: Optional[float] = None


class BacktestResult(BaseModel):
    stock_id: str
    strategy: str
    start_date: str
    end_date: str
    initial_capital: float
    final_capital: float
    total_return: float           # 總報酬率 %
    annual_return: float          # 年化報酬率 %
    max_drawdown: float           # 最大回撤 %
    sharpe_ratio: float           # 夏普比率
    win_rate: float               # 勝率 %
    total_trades: int             # 總交易次數
    profit_trades: int            # 獲利次數
    loss_trades: int              # 虧損次數
    avg_profit: float             # 平均獲利 %
    avg_loss: float               # 平均虧損 %
    profit_factor: float          # 獲利因子
    trades: List[TradeRecord]
    equity_curve: List[dict]      # 資產曲線 [{date, value}]
    benchmark_return: float       # 大盤報酬率 % (買入持有)
