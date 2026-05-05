import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { CandlestickBar } from '../../types';

interface IndicatorChartsProps {
  data: CandlestickBar[];
}

const IndicatorCharts: React.FC<IndicatorChartsProps> = ({ data }) => {
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="space-y-4">
      {/* RSI */}
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">RSI (14)</p>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={28} ticks={[30, 50, 70]} />
            <Tooltip
              contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown) => [(v as number)?.toFixed(1), 'RSI']}
              labelStyle={{ color: '#8b949e' }}
            />
            <ReferenceLine y={70} stroke="#f85149" strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={30} stroke="#3fb950" strokeDasharray="4 2" strokeWidth={1} />
            <Line type="monotone" dataKey="rsi_14" stroke="#58a6ff" dot={false} strokeWidth={1.5} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD */}
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">MACD</p>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={{ stroke: '#30363d' }} interval={tickInterval} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#8b949e' }}
            />
            <ReferenceLine y={0} stroke="#30363d" />
            <Bar dataKey="macd_hist" name="柱狀">
              {data.map((d, i) => (
                <Cell key={i} fill={(d.macd_hist ?? 0) >= 0 ? '#3fb95088' : '#f8514988'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="macd" name="MACD" stroke="#58a6ff" dot={false} strokeWidth={1.5} connectNulls />
            <Line type="monotone" dataKey="macd_signal" name="Signal" stroke="#f97316" dot={false} strokeWidth={1.5} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default IndicatorCharts;
