import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, Zap } from 'lucide-react';
import { cn, formatNumber, formatPercent, changeColor } from '../lib/utils';
import { runScreener } from '../services/api';
import type { ScreenerFilter } from '../types';
import { Card, Badge, ScoreBar, Loading, Empty } from './ui/Card';
import DayTradeScreener from './DayTradeScreener';

interface StockScreenerProps {
  onSelectStock: (stockId: string) => void;
}

type ScreenerMode = 'smart' | 'daytrade';

const DEFAULT_FILTERS: ScreenerFilter = {
  fundamental_weight: 0.40,
  technical_weight: 0.35,
  institutional_weight: 0.25,
  market: 'TWSE',
  limit: 20,
  min_roe: 10,
  max_pe: 25,
  min_revenue_growth: 5,
  rsi_min: 40,
  rsi_max: 72,
  require_macd_bullish: true,
  require_institutional_net_buy: true,
};

type WeightKey = [string, keyof ScreenerFilter];
const WEIGHT_KEYS: WeightKey[] = [
  ['基本面', 'fundamental_weight'],
  ['技術面', 'technical_weight'],
  ['籌碼面', 'institutional_weight'],
];

const ROW_CLS = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors';
const SMART_ON = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-[var(--bg-card)] text-[var(--text-primary)] shadow';
const SMART_OFF = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-[var(--text-secondary)]';
const TRADE_ON = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-orange-500/20 text-orange-400 shadow';
const TRADE_OFF = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-[var(--text-secondary)]';

const StockScreener: React.FC<StockScreenerProps> = ({ onSelectStock }) => {
  const [mode, setMode] = useState<ScreenerMode>('smart');
  const [filters, setFilters] = useState<ScreenerFilter>(DEFAULT_FILTERS);

  const mutation = useMutation({ mutationFn: runScreener });

  const update = (key: keyof ScreenerFilter, value: unknown) =>
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }));

  const getVal = (key: keyof ScreenerFilter): string | number => {
    const v = filters[key];
    return typeof v === 'number' ? v : '';
  };

  const getNum = (key: keyof ScreenerFilter): number => {
    const v = filters[key];
    return typeof v === 'number' ? v : 0;
  };

  const numInput = (label: string, key: keyof ScreenerFilter, placeholder: string) => (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type="number"
        className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        placeholder={placeholder}
        value={getVal(key)}
        onChange={(e) => update(key, e.target.value ? Number(e.target.value) : undefined)}
      />
    </div>
  );

  const resultTitle = '選股結果' + (mutation.data ? ' (' + mutation.data.length + ' 支)' : '');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg w-fit">
        <button onClick={() => setMode('smart')} className={mode === 'smart' ? SMART_ON : SMART_OFF}>
          <Play className="w-3.5 h-3.5" /> 智能選股
        </button>
        <button onClick={() => setMode('daytrade')} className={mode === 'daytrade' ? TRADE_ON : TRADE_OFF}>
          <Zap className="w-3.5 h-3.5" /> 本日強勢股
        </button>
      </div>

      {mode === 'daytrade' && <DayTradeScreener onSelectStock={onSelectStock} />}

      {mode === 'smart' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-1 space-y-3">
            <Card title="選股條件">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">市場</label>
                  <select
                    className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    value={String(filters.market || 'ALL')}
                    onChange={(e) => update('market', e.target.value)}
                  >
                    <option value="ALL">全部</option>
                    <option value="TWSE">上市</option>
                    <option value="TPEx">上櫃</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">顯示筆數</label>
                  <select
                    className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    value={getNum('limit') || 20}
                    onChange={(e) => update('limit', Number(e.target.value))}
                  >
                    <option value={10}>10 筆</option>
                    <option value={20}>20 筆</option>
                    <option value={30}>30 筆</option>
                    <option value={50}>50 筆</option>
                  </select>
                </div>

                <hr className="border-[var(--border-color)]" />
                <p className="text-xs font-medium text-[var(--text-secondary)]">基本面篩選</p>
                {numInput('最低 ROE (%)', 'min_roe', '例：15')}
                {numInput('最高本益比', 'max_pe', '例：25')}
                {numInput('最低營收年增 (%)', 'min_revenue_growth', '例：10')}

                <hr className="border-[var(--border-color)]" />
                <p className="text-xs font-medium text-[var(--text-secondary)]">技術面篩選</p>
                <div className="grid grid-cols-2 gap-2">
                  {numInput('RSI 最低', 'rsi_min', '0')}
                  {numInput('RSI 最高', 'rsi_max', '100')}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="macd_bullish"
                    checked={Boolean(filters.require_macd_bullish)}
                    onChange={(e) => update('require_macd_bullish', e.target.checked)}
                    className="accent-[var(--accent)]" />
                  <label htmlFor="macd_bullish" className="text-xs text-[var(--text-secondary)]">MACD 多頭</label>
                </div>

                <hr className="border-[var(--border-color)]" />
                <p className="text-xs font-medium text-[var(--text-secondary)]">籌碼面篩選</p>
                {numInput('外資連買天數 ≥', 'min_foreign_consecutive_buy', '例：3')}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="inst_buy"
                    checked={Boolean(filters.require_institutional_net_buy)}
                    onChange={(e) => update('require_institutional_net_buy', e.target.checked)}
                    className="accent-[var(--accent)]" />
                  <label htmlFor="inst_buy" className="text-xs text-[var(--text-secondary)]">三大法人買超</label>
                </div>

                <hr className="border-[var(--border-color)]" />
                <p className="text-xs font-medium text-[var(--text-secondary)]">評分權重</p>
                <div className="space-y-2">
                  {WEIGHT_KEYS.map(([label, key]) => {
                    const val = getNum(key);
                    const pct = Math.round(val * 100);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-secondary)] w-12">{label}</span>
                        <input type="range" min={0} max={1} step={0.05} value={val}
                          onChange={(e) => update(key, Number(e.target.value))}
                          className="flex-1 accent-[var(--accent)]" />
                        <span className="text-xs text-[var(--text-primary)] w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => mutation.mutate(filters)}
                  disabled={mutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {mutation.isPending ? '分析中...' : '開始選股'}
                </button>
              </div>
            </Card>
          </div>

          <div className="xl:col-span-3">
            <Card title={resultTitle}>
              {mutation.isPending && <Loading text="正在分析股票，請稍候..." />}
              {!mutation.isPending && !mutation.data && <Empty text="設定篩選條件後點擊「開始選股」" />}
              {mutation.data && mutation.data.length === 0 && <Empty text="沒有符合條件的股票，請放寬篩選條件" />}
              {mutation.data && mutation.data.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        {['股票', '收盤', '漲跌%', '基本面', '技術面', '籌碼面', '總分', '訊號', 'ROE', 'RSI'].map((h) => (
                          <th key={h} className="text-left py-2 pr-3 text-[var(--text-secondary)] font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.map((s) => {
                        const scoreColor = s.total_score >= 70 ? '#3fb950' : s.total_score >= 50 ? '#d29922' : '#f85149';
                        const sigVariant = s.signal === 'BUY' ? 'buy' : s.signal === 'SELL' ? 'sell' : 'hold';
                        const sigText = s.signal === 'BUY' ? '買' : s.signal === 'SELL' ? '賣' : '觀望';
                        return (
                          <tr key={s.stock_id} className={ROW_CLS} onClick={() => onSelectStock(s.stock_id)}>
                            <td className="py-2 pr-3">
                              <span className="text-[var(--accent)] font-medium">{s.stock_id}</span>
                              <br />
                              <span className="text-[var(--text-secondary)]">{s.stock_name}</span>
                            </td>
                            <td className="py-2 pr-3 font-medium">{formatNumber(s.close)}</td>
                            <td className={cn('py-2 pr-3', changeColor(s.change_pct))}>{formatPercent(s.change_pct)}</td>
                            <td className="py-2 pr-3"><ScoreBar value={s.fundamental_score} /></td>
                            <td className="py-2 pr-3"><ScoreBar value={s.technical_score} /></td>
                            <td className="py-2 pr-3"><ScoreBar value={s.institutional_score} /></td>
                            <td className="py-2 pr-3">
                              <span className="font-bold" style={{ color: scoreColor }}>{s.total_score.toFixed(1)}</span>
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant={sigVariant}>{sigText}</Badge>
                            </td>
                            <td className={cn('py-2 pr-3', changeColor(s.roe))}>{formatPercent(s.roe)}</td>
                            <td className="py-2">{formatNumber(s.rsi_14, 1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockScreener;
