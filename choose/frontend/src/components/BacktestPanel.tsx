import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { runBacktest } from '../services/api';
import type { BacktestRequest, StrategyType, BacktestResult } from '../types';
import { Card, MetricRow, Loading, Empty, Badge } from './ui/Card';
import { formatPercent, changeColor } from '../lib/utils';
import StockSearch from './StockSearch';

const STRATEGIES: { value: StrategyType; label: string; desc: string }[] = [
  { value: 'combined', label: '綜合評分', desc: '技術面 + 籌碼面加權評分' },
  { value: 'ma_cross', label: '均線交叉', desc: '短期均線穿越長期均線' },
  { value: 'macd', label: 'MACD', desc: 'MACD 金叉死叉策略' },
  { value: 'rsi', label: 'RSI', desc: 'RSI 超買超賣策略' },
  { value: 'chip', label: '籌碼策略', desc: '三大法人買賣超策略' },
];

const DEFAULT_REQUEST: BacktestRequest = {
  stock_id: '2330',
  strategy: 'combined',
  start_date: '2022-01-01',
  end_date: '2024-12-31',
  initial_capital: 1_000_000,
  short_ma: 5,
  long_ma: 20,
  rsi_oversold: 30,
  rsi_overbought: 70,
  score_threshold: 60,
};

const BacktestPanel: React.FC = () => {
  const [req, setReq] = useState<BacktestRequest>(DEFAULT_REQUEST);

  const mutation = useMutation<BacktestResult, Error, BacktestRequest>({ mutationFn: runBacktest });

  const update = (key: keyof BacktestRequest, value: unknown) =>
    setReq((prev) => ({ ...prev, [key]: value }));

  const result = mutation.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {/* 設定面板 */}
      <div className="xl:col-span-1">
        <Card title="回測設定">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">股票代號</label>
              <StockSearch
                value={req.stock_id}
                onChange={(id: string) => update('stock_id', id)}
                placeholder="輸入股票代號..."
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">投資策略</label>
              <div className="space-y-1">
                {STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => update('strategy', s.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      req.strategy === s.value
                        ? 'bg-[var(--accent)]/20 border border-[var(--accent)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[0.65rem] opacity-70">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-[var(--border-color)]" />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">開始日期</label>
                <input
                  type="date"
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  value={req.start_date}
                  onChange={(e) => update('start_date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">結束日期</label>
                <input
                  type="date"
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  value={req.end_date}
                  onChange={(e) => update('end_date', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">初始資金</label>
              <input
                type="number"
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                value={req.initial_capital}
                onChange={(e) => update('initial_capital', Number(e.target.value))}
              />
            </div>

            {req.strategy === 'ma_cross' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">短期均線</label>
                  <input type="number" className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none" value={req.short_ma} onChange={(e) => update('short_ma', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">長期均線</label>
                  <input type="number" className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none" value={req.long_ma} onChange={(e) => update('long_ma', Number(e.target.value))} />
                </div>
              </div>
            )}

            {req.strategy === 'rsi' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">超賣（買入）</label>
                  <input type="number" className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none" value={req.rsi_oversold} onChange={(e) => update('rsi_oversold', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">超買（賣出）</label>
                  <input type="number" className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none" value={req.rsi_overbought} onChange={(e) => update('rsi_overbought', Number(e.target.value))} />
                </div>
              </div>
            )}

            <button
              onClick={() => mutation.mutate(req)}
              disabled={mutation.isPending || !req.stock_id}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {mutation.isPending ? '回測中...' : '執行回測'}
            </button>

            {mutation.error && (
              <p className="text-xs text-red-400">回測失敗，請確認後端服務已啟動</p>
            )}
          </div>
        </Card>
      </div>

      {/* 回測結果 */}
      <div className="xl:col-span-3 space-y-4">
        {mutation.isPending && <Loading text="執行策略回測中..." />}
        {!mutation.isPending && !result && (
          <Empty text="設定回測參數後點擊「執行回測」" />
        )}

        {result && (
          <>
            {/* 績效摘要卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: '總報酬率',
                  value: formatPercent(result.total_return),
                  color: changeColor(result.total_return),
                  sub: `vs 大盤 ${formatPercent(result.benchmark_return)}`,
                },
                {
                  label: '年化報酬率',
                  value: formatPercent(result.annual_return),
                  color: changeColor(result.annual_return),
                  sub: `夏普 ${result.sharpe_ratio.toFixed(2)}`,
                },
                {
                  label: '最大回撤',
                  value: `-${result.max_drawdown.toFixed(2)}%`,
                  color: 'text-red-400',
                  sub: `獲利因子 ${result.profit_factor.toFixed(2)}`,
                },
                {
                  label: '勝率',
                  value: formatPercent(result.win_rate),
                  color: changeColor(result.win_rate - 50),
                  sub: `${result.profit_trades}勝 ${result.loss_trades}負`,
                },
              ].map((c) => (
                <Card key={c.label}>
                  <p className="text-xs text-[var(--text-secondary)]">{c.label}</p>
                  <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{c.sub}</p>
                </Card>
              ))}
            </div>

            {/* 資產曲線 */}
            <Card title="資產曲線 vs 大盤">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={result.equity_curve} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={{ stroke: '#30363d' }} interval={Math.max(1, Math.floor(result.equity_curve.length / 8))} tickFormatter={(v) => v.slice(0, 7)} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => `$${(v / 10000).toFixed(0)}萬`} />
                  <Tooltip
                    contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: unknown) => [`$${(v as number).toLocaleString()}`, '資產']}
                    labelStyle={{ color: '#8b949e' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#58a6ff" fill="url(#equityGrad)" strokeWidth={2} dot={false} />
                  <ReferenceLine y={result.initial_capital} stroke="#30363d" strokeDasharray="4 2" label={{ value: '初始', fontSize: 9, fill: '#8b949e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* 績效指標 */}
              <Card title="詳細指標">
                <MetricRow label="初始資金" value={`$${result.initial_capital.toLocaleString()}`} />
                <MetricRow label="最終資金" value={`$${result.final_capital.toLocaleString()}`} />
                <MetricRow label="總交易次數" value={`${result.total_trades} 次`} />
                <MetricRow label="平均獲利" value={<span className="text-green-400">{formatPercent(result.avg_profit)}</span>} />
                <MetricRow label="平均虧損" value={<span className="text-red-400">{formatPercent(result.avg_loss)}</span>} />
                <MetricRow label="大盤報酬（B&H）" value={<span className={changeColor(result.benchmark_return)}>{formatPercent(result.benchmark_return)}</span>} />
                <MetricRow label="超額報酬" value={<span className={changeColor(result.total_return - result.benchmark_return)}>{formatPercent(result.total_return - result.benchmark_return)}</span>} />
              </Card>

              {/* 交易紀錄 */}
              <Card title={`交易紀錄 (最近20筆)`}>
                <div className="overflow-y-auto max-h-[220px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-card)]">
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="text-left py-1.5 pr-2 text-[var(--text-secondary)] font-medium">日期</th>
                        <th className="text-left py-1.5 pr-2 text-[var(--text-secondary)] font-medium">動作</th>
                        <th className="text-right py-1.5 pr-2 text-[var(--text-secondary)] font-medium">價格</th>
                        <th className="text-right py-1.5 text-[var(--text-secondary)] font-medium">損益%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.slice(-20).reverse().map((t, i) => (
                        <tr key={i} className="border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-secondary)]/50">
                          <td className="py-1.5 pr-2 text-[var(--text-secondary)]">{t.date}</td>
                          <td className="py-1.5 pr-2">
                            <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'}>
                              {t.action === 'BUY' ? '買' : '賣'}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-2 text-right font-medium">{t.price.toFixed(2)}</td>
                          <td className={`py-1.5 text-right font-medium ${changeColor(t.profit_loss)}`}>
                            {t.profit_loss != null ? formatPercent(t.profit_loss) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BacktestPanel;
