import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { CandlestickBar } from '../../types';

interface CandlestickChartProps {
  data: CandlestickBar[];
  showMA?: boolean;
  showBB?: boolean;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, showMA = true, showBB = false }) => {
  // Recharts 不支援原生 K 線，用 Bar 模擬高低影線 + 實體
  const chartData = useMemo(() =>
    data.map((d) => {
      const isUp = d.close >= d.open;
      const bodyLow = Math.min(d.open, d.close);
      const bodyHigh = Math.max(d.open, d.close);
      return {
        ...d,
        isUp,
        // 下影線底部到實體底部
        shadowLow: [d.low, bodyLow],
        // 實體
        body: [bodyLow, bodyHigh],
        // 實體頂部到上影線
        shadowHigh: [bodyHigh, d.high],
      };
    }),
    [data]
  );

  // 顯示日期間隔
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = chartData.find((x) => x.date === label);
    if (!d) return null;
    const color = d.isUp ? '#3fb950' : '#f85149';
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 text-xs shadow-xl min-w-[160px]">
        <p className="text-[var(--text-secondary)] mb-2">{d.date}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-[var(--text-secondary)]">開</span><span style={{ color }}>{d.open?.toFixed(2)}</span>
          <span className="text-[var(--text-secondary)]">高</span><span className="text-[var(--text-primary)]">{d.high?.toFixed(2)}</span>
          <span className="text-[var(--text-secondary)]">低</span><span className="text-[var(--text-primary)]">{d.low?.toFixed(2)}</span>
          <span className="text-[var(--text-secondary)]">收</span><span style={{ color }}>{d.close?.toFixed(2)}</span>
          <span className="text-[var(--text-secondary)]">量</span><span className="text-[var(--text-primary)]">{(d.volume / 1000).toFixed(0)}張</span>
        </div>
        {showMA && (
          <div className="mt-2 pt-2 border-t border-[var(--border-color)] grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-yellow-400">MA5</span><span className="text-yellow-400">{d.ma5?.toFixed(2) ?? '-'}</span>
            <span className="text-blue-400">MA20</span><span className="text-blue-400">{d.ma20?.toFixed(2) ?? '-'}</span>
            <span className="text-purple-400">MA60</span><span className="text-purple-400">{d.ma60?.toFixed(2) ?? '-'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* 主圖：K線 */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#8b949e' }}
            tickLine={false}
            axisLine={{ stroke: '#30363d' }}
            interval={tickInterval}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: '#8b949e' }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* 高低影線（bar 透明度拉低模擬細線） */}
          <Bar dataKey="shadowLow" stackId="s" fill="transparent" />
          <Bar dataKey="body" stackId="s" radius={0}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isUp ? '#3fb950' : '#f85149'} />
            ))}
          </Bar>
          <Bar dataKey="shadowHigh" stackId="s" fill="transparent" />

          {/* BB */}
          {showBB && <Line type="monotone" dataKey="bb_upper" stroke="#6366f1" dot={false} strokeWidth={1} strokeDasharray="3 3" />}
          {showBB && <Line type="monotone" dataKey="bb_lower" stroke="#6366f1" dot={false} strokeWidth={1} strokeDasharray="3 3" />}
          {showBB && <Line type="monotone" dataKey="bb_middle" stroke="#818cf8" dot={false} strokeWidth={1} />}

          {/* 均線 */}
          {showMA && <Line type="monotone" dataKey="ma5" stroke="#d29922" dot={false} strokeWidth={1.5} connectNulls />}
          {showMA && <Line type="monotone" dataKey="ma20" stroke="#58a6ff" dot={false} strokeWidth={1.5} connectNulls />}
          {showMA && <Line type="monotone" dataKey="ma60" stroke="#a855f7" dot={false} strokeWidth={1.5} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 成交量 */}
      <ResponsiveContainer width="100%" height={60}>
        <ComposedChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Bar dataKey="volume">
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isUp ? '#3fb95066' : '#f8514966'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* 圖例 */}
      {showMA && (
        <div className="flex gap-4 px-1 text-xs">
          <span className="text-yellow-400">━ MA5</span>
          <span className="text-blue-400">━ MA20</span>
          <span className="text-purple-400">━ MA60</span>
          {showBB && <span className="text-indigo-400">- - BB</span>}
        </div>
      )}
    </div>
  );
};

export default CandlestickChart;
