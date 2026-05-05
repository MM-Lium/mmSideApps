import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { runScreener } from '../services/api';
import type { ScreenerFilter } from '../types';
import { Card, Badge, ScoreBar, Loading, Empty } from './ui/Card';
import { formatNumber, formatPercent, changeColor } from '../lib/utils';

interface StockScreenerProps {
  onSelectStock: (stockId: string) => void;
}

const DEFAULT_FILTERS: ScreenerFilter = {
  fundamental_weight: 0.35,
  technical_weight: 0.35,
  institutional_weight: 0.30,
  market: 'ALL',
  limit: 20,
};

const StockScreener: React.FC<StockScreenerProps> = ({ onSelectStock }) => {
  const [filters, setFilters] = useState<ScreenerFilter>(DEFAULT_FILTERS);

  const mutation = useMutation({
    mutationFn: runScreener,
  });

  const update = (key: keyof ScreenerFilter, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }));

  const numInput = (
    label: string,
    key: keyof ScreenerFilter,
    placeholder: string,
    suffix?: string
  ) => (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center">
        <input
          type="number"
          className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          placeholder={placeholder}
          value={(filters[key] as number) ?? ''}
          onChange={(e) => update(key, e.target.value ? Number(e.target.value) : undefined)}
        />
        {suffix && <span className="ml-1 text-xs text-[var(--text-secondary)]">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 篩選條件 */}
        <div className="xl:col-span-1 space-y-3">
          <Card title="選股條件">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">市場</label>
                <select
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  value={filters.market ?? 'ALL'}
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
                  value={filters.limit ?? 20}
                  onChange={(e) => update('limit', Number(e.target.value))}
                >
                  {[10, 20, 30, 50].map((v) => <option key={v} value={v}>{v} 筆</option>)}
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
                <input
                  type="checkbox"
                  id="macd_bullish"
                  checked={filters.require_macd_bullish ?? false}
                  onChange={(e) => update('require_macd_bullish', e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor="macd_bullish" className="text-xs text-[var(--text-secondary)]">
                  MACD 多頭
                </label>
              </div>

              <hr className="border-[var(--border-color)]" />
              <p className="text-xs font-medium text-[var(--text-secondary)]">籌碼面篩選</p>
              {numInput('外資連買天數 ≥', 'min_foreign_consecutive_buy', '例：3')}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="inst_buy"
                  checked={filters.require_institutional_net_buy ?? false}
                  onChange={(e) => update('require_institutional_net_buy', e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor="inst_buy" className="text-xs text-[var(--text-secondary)]">
                  三大法人買超
                </label>
              </div>

              <hr className="border-[var(--border-color)]" />
              <p className="text-xs font-medium text-[var(--text-secondary)]">評分權重</p>
              <div className="space-y-2">
                {([
                  ['基本面', 'fundamental_weight'],
                  ['技術面', 'technical_weight'],
                  ['籌碼面', 'institutional_weight'],
                ] as [string, keyof ScreenerFilter][]).map(([label, key]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)] w-12">{label}</span>
                    <input
                      type="range"
                      min={0} max={1} step={0.05}
                      value={(filters[key] as number | undefined) ?? 0}
                      onChange={(e) => update(key, Number(e.target.value))}
                      className="flex-1 accent-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--text-primary)] w-8 text-right">
                      {(((filters[key] as number | undefined) ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
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

        {/* 結果表格 */}
        <div className="xl:col-span-3">
          <Card title={`選股結果 ${mutation.data ? `(${mutation.data.length} 支)` : ''}`}>
            {mutation.isPending && <Loading text="正在分析股票，請稍候..." />}
            {!mutation.isPending && !mutation.data && (
              <Empty text="設定篩選條件後點擊「開始選股」" />
            )}
            {mutation.data && mutation.data.length === 0 && (
              <Empty text="沒有符合條件的股票，請放寬篩選條件" />
            )}
            {mutation.data && mutation.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['股票', '收盤', '漲跌%', '基本面', '技術面', '籌碼面', '總分', '訊號', 'ROE', 'RSI'].map((h) => (
                        <th key={h} className="text-left py-2 pr-3 text-[var(--text-secondary)] font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.map((s) => (
                      <tr
                        key={s.stock_id}
                        className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                        onClick={() => onSelectStock(s.stock_id)}
                      >
                        <td className="py-2 pr-3">
                          <div>
                            <span className="text-[var(--accent)] font-medium">{s.stock_id}</span>
                            <br />
                            <span className="text-[var(--text-secondary)]">{s.stock_name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 font-medium">{formatNumber(s.close)}</td>
                        <td className={`py-2 pr-3 ${changeColor(s.change_pct)}`}>{formatPercent(s.change_pct)}</td>
                        <td className="py-2 pr-3">
                          <ScoreBar value={s.fundamental_score} />
                        </td>
                        <td className="py-2 pr-3">
                          <ScoreBar value={s.technical_score} />
                        </td>
                        <td className="py-2 pr-3">
                          <ScoreBar value={s.institutional_score} />
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className="font-bold"
                            style={{ color: s.total_score >= 70 ? '#3fb950' : s.total_score >= 50 ? '#d29922' : '#f85149' }}
                          >
                            {s.total_score.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={s.signal === 'BUY' ? 'buy' : s.signal === 'SELL' ? 'sell' : 'hold'}>
                            {s.signal === 'BUY' ? '買' : s.signal === 'SELL' ? '賣' : '觀望'}
                          </Badge>
                        </td>
                        <td className={`py-2 pr-3 ${changeColor(s.roe)}`}>{formatPercent(s.roe)}</td>
                        <td className="py-2">{formatNumber(s.rsi_14, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StockScreener;
