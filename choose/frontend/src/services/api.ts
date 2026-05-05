import axios from 'axios';
import type {
  StockInfo,
  TechnicalResponse,
  FundamentalResponse,
  InstitutionalResponse,
  ScreenerFilter,
  ScreenerResult,
  BacktestRequest,
  BacktestResult,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
});

// ---- 股票資料 ----
export const getStockList = async (): Promise<StockInfo[]> => {
  const res = await api.get('/stocks/list');
  return res.data.data;
};

export const getPriceData = async (
  stockId: string,
  days = 180
): Promise<TechnicalResponse> => {
  const res = await api.get(`/stocks/${stockId}/price`, { params: { days } });
  return res.data;
};

export const getFundamental = async (
  stockId: string,
  years = 3
): Promise<FundamentalResponse> => {
  const res = await api.get(`/stocks/${stockId}/fundamental`, {
    params: { years },
  });
  return res.data;
};

export const getInstitutional = async (
  stockId: string,
  days = 60
): Promise<InstitutionalResponse> => {
  const res = await api.get(`/stocks/${stockId}/institutional`, {
    params: { days },
  });
  return res.data;
};

// ---- 選股 ----
export const runScreener = async (
  filters: ScreenerFilter
): Promise<ScreenerResult[]> => {
  const res = await api.post('/screener/run', filters);
  return res.data;
};

// ---- 回測 ----
export const runBacktest = async (
  request: BacktestRequest
): Promise<BacktestResult> => {
  const res = await api.post('/backtest/run', request);
  return res.data;
};
