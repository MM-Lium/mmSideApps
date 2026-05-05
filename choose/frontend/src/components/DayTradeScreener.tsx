import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Zap, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { runDayTradeScreener } from '../services/api';
import type { DayTradeFilter, DayTradeCandidate } from '../types';
import { Card, Loading, Empty } from './ui/Card';
import { formatPercent, changeColor } from '../lib/utils';

interface DayTradeScreenerProps {
  onSelectStock: (stockId: string) => void;
}

const DEFAULT_FILTERS: DayTradeFilter = {
  min_volume_lots: 5000,
  min_amplitude: 2.0,
  min_change_abs: 0,
  min_price: 10,
  require_above_ma: false,
  require_volume_surge: false,
  limit: 30,
};

const CHECK_ROW = 'flex items-center gap-2';
const CHECK_LABEL = 'text-xs text-[var(--text-secondary)]';
const MA_UP = 'text-green-400 font-medium';
const MA_DOWN = 'text-red-400';
const MA_NONE = 'text-[var(--text-secondary)]';
const SURGE_YES = 'text-orange-400 font-bold';
const SURGE_NO = 'text-[var(--text-secondary)]';

const DayTradeScreener: React.FC<DayTradeScreenerProps> = ({ onSelectStock }) => {
  const [filters, setFilters] = useState<DayTradeFilter>(DEFAULT_FILTERS);

  const mutation = useMutation({ mutationFn: runDayTradeScreener });

  const update = <K extends keyof DayTradeFilter>(key: K, value: DayTradeFilter[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const numInput = (
    label: string,
    key: keyof DayTradeFilter,
    step = 1,
    suffix?: string
  ) => (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-orange-400"
          value={(filters[key] as number) ?? ''}
          onChange={(e) =>
            update(key, e.target.value === '' ? undefined : (Number(e.target.value) as DayTradeFilter[typeof key]))
          }
        />
        {suffix && <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  const results = mutation.data ?? [];
  const dataDate = results[0]?.date ?? '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {/* 篩選條件 */}
      <div className="xl:col-span-1 space-y-3">
        <Card title="當沖選股條件">
          <div className="space-y-3">
            <div className="p-2 rounded-lg bg-orange-500/8 border border-orange-500/20 text-xs text-orange-300 space-y-0.5">
              <p className="font-medium">📊 篩選重點</p>
              <p className="opacity-80">量大 × 震盪大 × 有動能</p>
            </div>

            {numInput('最低成交量（張）', 'min_volume_lots', 500, '張')}
            {numInput('最低振幅 (%)', 'min_amplitude', 0.5, '%')}
            {numInput('漲跌幅絕對值 ≥ (%)', 'min_change_abs', 0.5, '%')}
            {numInput('過濾漲跌幅 ≤ (%)', 'max_change_abs', 0.5, '%')}
            {numInput('最低股價', 'min_price', 5, '元')}
            <hr className="border-[var(--border-color)]" />
            <p className="text-xs font-medium text-[var(--text-secondary)]">軌道條件</p>

            <div className={CHECK_ROW}>
              <input
                type="checkbox"
                id="require_above_ma"
                checked={Boolean(filters.require_above_ma)}
                onChange={(e) => update('require_above_ma', e.target.checked as DayTradeFilter['require_above_ma'])}
                className="accent-orange-500"
              />
              <label htmlFor="require_above_ma" className={CHECK_LABEL}>股價在 MA5 且 MA20 之上</label>
            </div>

            <div className={CHECK_ROW}>
              <input
                type="checkbox"
                id="require_volume_surge"
                checked={Boolean(filters.require_volume_surge)}
                onChange={(e) => update('require_volume_surge', e.target.checked as DayTradeFilter['require_volume_surge'])}
                className="accent-orange-500"
              />
              <label htmlFor="require_volume_surge" className={CHECK_LABEL}>成交量 &gt; 前日 2 倍</label>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">顯示筆數</label>
              <select
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-orange-400"
                value={filters.limit ?? 30}
                onChange={(e) => update('limit', Number(e.target.value))}
              >
                {[20, 30, 50].map((v) => (
                  <option key={v} value={v}>{v} 筆</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => mutation.mutate(filters)}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 transition-colors disabled:opacity-50"
            >
              {mutation.isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> 掃描中...</>
                : <><Zap className="w-4 h-4" /> 掃描強勢股</>}
            </button>

            {mutation.error && (
              <p className="text-xs text-red-400">掃描失敗，請確認後端服務已啟動</p>
            )}
          </div>
        </Card>

        {/* 說明卡 */}
        <Card title="技術評分說明">
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span>RSI 動能</span>
              <span className="font-medium text-orange-400">±20 分</span>
            </div>
            <div className="flex justify-between">
              <span>MACD 趨勢</span>
              <span className="font-medium text-orange-400">±20 分</span>
            </div>
            <div className="flex justify-between">
              <span>均線位置</span>
              <span className="font-medium text-orange-400">±15 分</span>
            </div>
            <div className="flex justify-between">
              <span>KD / 布林</span>
              <span className="font-medium text-orange-400">±15 分</span>
            </div>
            <hr className="border-[var(--border-color)]" />
            <p className="text-[0.65rem] leading-relaxed opacity-70">
              資料不足時以量能複合分代替<br />
              資料來源：台灣證交所官方 API<br />
              每日收盤後更新，不含上櫃
            </p>
          </div>
        </Card>
      </div>

      {/* 結果列表 */}
      <div className="xl:col-span-3">
        {mutation.isPending && <Loading text="正在掃描全市場強勢股..." />}
        {!mutation.isPending && !mutation.data && (
          <Empty text="設定篩選條件後點擊「掃描強勢股」" />
        )}

        {!mutation.isPending && mutation.data && results.length === 0 && (
          <Empty text="無符合條件的個股，請放寬篩選條件" />
        )}

        {results.length > 0 && (
          <Card title={'本日強勢股 · ' + results.length + ' 支' + (dataDate ? ' · ' + dataDate : '')}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                    <th className="text-left py-2 pr-3 font-medium w-6">排名</th>
                    <th className="text-left py-2 pr-3 font-medium">代號</th>
                    <th className="text-left py-2 pr-3 font-medium">名稱</th>
                    <th className="text-right py-2 pr-3 font-medium">收盤</th>
                    <th className="text-right py-2 pr-3 font-medium">漲跌%</th>
                    <th className="text-right py-2 pr-3 font-medium">振幅%</th>
                    <th className="text-right py-2 pr-3 font-medium">成交量(張)</th>
                    <th className="text-right py-2 pr-3 font-medium">金額(億)</th>
                    <th className="text-center py-2 pr-3 font-medium">MA</th>
                    <th className="text-center py-2 pr-3 font-medium">加速量</th>
                    <th className="text-right py-2 font-medium">技術評分</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: DayTradeCandidate, i: number) => (
                    <tr
                      key={r.stock_id}
                      className="border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-secondary)]/60 cursor-pointer transition-colors"
                      onClick={() => onSelectStock(r.stock_id)}
                    >
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">
                        {i < 3
                          ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold">{i + 1}</span>
                          : <span className="text-[var(--text-secondary)]">{i + 1}</span>
                        }
                      </td>
                      <td className="py-2 pr-3 font-medium text-[var(--accent)]">{r.stock_id}</td>
                      <td className="py-2 pr-3 text-[var(--text-primary)]">{r.stock_name}</td>
                      <td className="py-2 pr-3 text-right font-medium">{r.close.toFixed(1)}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${changeColor(r.change_pct)}`}>
                        <span className="inline-flex items-center gap-0.5">
                          {r.change_pct > 0
                            ? <TrendingUp className="w-3 h-3" />
                            : r.change_pct < 0
                            ? <TrendingDown className="w-3 h-3" />
                            : null}
                          {formatPercent(r.change_pct)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-[var(--text-primary)]">
                        {r.amplitude.toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3 text-right text-[var(--text-primary)]">
                        {r.volume_lots.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right text-[var(--text-secondary)]">
                        {r.volume_amount.toFixed(1)}
                      </td>
                      <td className="py-2 pr-3 text-center text-xs">
                        {r.ma5 != null
                          ? <span>
                              <span className={r.above_ma5 ? MA_UP : MA_DOWN}>5{r.above_ma5 ? '↑' : '↓'}</span>
                              {' '}
                              <span className={r.above_ma20 ? MA_UP : MA_DOWN}>20{r.above_ma20 ? '↑' : '↓'}</span>
                            </span>
                          : <span className={MA_NONE}>-</span>
                        }
                      </td>
                      <td className="py-2 pr-3 text-center text-xs">
                        {r.volume_surge != null
                          ? <span className={r.volume_surge ? SURGE_YES : SURGE_NO}>{r.volume_surge ? '×2↑' : '-'}</span>
                          : <span className={MA_NONE}>-</span>
                        }
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-bold">
                          {r.score.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DayTradeScreener;
