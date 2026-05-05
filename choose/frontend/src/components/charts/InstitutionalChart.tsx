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
import type { InstitutionalRecord } from '../../types';

interface InstitutionalChartProps {
  data: InstitutionalRecord[];
}

const InstitutionalChart: React.FC<InstitutionalChartProps> = ({ data }) => {
  const tickInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="space-y-4">
      {/* 外資 */}
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">外資買賣超（張）</p>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown) => [`${((v as number) / 1000).toFixed(0)}張`, '外資']}
              labelStyle={{ color: '#8b949e' }}
            />
            <ReferenceLine y={0} stroke="#30363d" />
            <Bar dataKey="foreign_net" name="外資">
              {data.map((d, i) => (
                <Cell key={i} fill={d.foreign_net >= 0 ? '#3fb950aa' : '#f85149aa'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="foreign_net" stroke="#58a6ff" dot={false} strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 投信 */}
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">投信買賣超（張）</p>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <ReferenceLine y={0} stroke="#30363d" />
            <Bar dataKey="trust_net" name="投信">
              {data.map((d, i) => (
                <Cell key={i} fill={d.trust_net >= 0 ? '#f97316aa' : '#a855f7aa'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 三大法人合計 */}
      <div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">三大法人合計</p>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={{ stroke: '#30363d' }} interval={tickInterval} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 9, fill: '#8b949e' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <ReferenceLine y={0} stroke="#30363d" />
            <Bar dataKey="total_net" name="合計">
              {data.map((d, i) => (
                <Cell key={i} fill={d.total_net >= 0 ? '#3fb95066' : '#f8514966'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InstitutionalChart;
