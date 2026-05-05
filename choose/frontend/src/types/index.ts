// API 型別定義

export interface StockInfo {
  stock_id: string;
  stock_name: string;
  industry?: string;
  market?: string;
}

export interface CandlestickBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  rsi_14?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  kdj_k?: number;
  kdj_d?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
}

export interface TechnicalResponse {
  stock_id: string;
  candles: CandlestickBar[];
  indicators: Record<string, number | null>;
  signal: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  reasons: string[];
}

export interface FundamentalResponse {
  stock_id: string;
  income_statements: IncomeStatement[];
  balance_sheets: BalanceSheet[];
  valuation: ValuationMetrics;
  score: number;
  reasons: string[];
  current_price: number;
}

export interface IncomeStatement {
  date: string;
  revenue?: number;
  gross_profit?: number;
  operating_income?: number;
  net_income?: number;
  eps?: number;
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
}

export interface BalanceSheet {
  date: string;
  total_assets?: number;
  total_liabilities?: number;
  equity?: number;
  debt_ratio?: number;
}

export interface ValuationMetrics {
  pe_ratio?: number;
  pb_ratio?: number;
  roe?: number;
  roa?: number;
  revenue_growth_yoy?: number;
  eps_growth_yoy?: number;
}

export interface InstitutionalRecord {
  date: string;
  foreign_net: number;
  trust_net: number;
  dealer_net: number;
  total_net: number;
}

export interface InstitutionalResponse {
  stock_id: string;
  records: InstitutionalRecord[];
  score: number;
  reasons: string[];
  stats: Record<string, number>;
}

// 選股
export interface ScreenerFilter {
  min_roe?: number;
  max_pe?: number;
  max_pb?: number;
  min_revenue_growth?: number;
  rsi_min?: number;
  rsi_max?: number;
  require_golden_cross?: boolean;
  require_macd_bullish?: boolean;
  min_foreign_consecutive_buy?: number;
  require_institutional_net_buy?: boolean;
  fundamental_weight?: number;
  technical_weight?: number;
  institutional_weight?: number;
  market?: string;
  limit?: number;
}

export interface ScreenerResult {
  stock_id: string;
  stock_name: string;
  industry?: string;
  close: number;
  change_pct: number;
  fundamental_score: number;
  technical_score: number;
  institutional_score: number;
  total_score: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  pe_ratio?: number;
  roe?: number;
  rsi_14?: number;
  foreign_net_3d?: number;
}

// 回測
export type StrategyType = 'ma_cross' | 'macd' | 'rsi' | 'chip' | 'combined';

export interface BacktestRequest {
  stock_id: string;
  strategy: StrategyType;
  start_date: string;
  end_date: string;
  initial_capital: number;
  commission_rate?: number;
  tax_rate?: number;
  short_ma?: number;
  long_ma?: number;
  rsi_oversold?: number;
  rsi_overbought?: number;
  score_threshold?: number;
}

export interface TradeRecord {
  date: string;
  action: 'BUY' | 'SELL';
  price: number;
  shares: number;
  amount: number;
  commission: number;
  tax: number;
  profit_loss?: number;
}

export interface BacktestResult {
  stock_id: string;
  strategy: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  profit_trades: number;
  loss_trades: number;
  avg_profit: number;
  avg_loss: number;
  profit_factor: number;
  trades: TradeRecord[];
  equity_curve: { date: string; value: number }[];
  benchmark_return: number;
}
