import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, children, className, action }) => (
  <div
    className={cn(
      'rounded-xl border p-4',
      'bg-[var(--bg-card)] border-[var(--border-color)]',
      className
    )}
  >
    {title && (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </h3>
        {action}
      </div>
    )}
    {children}
  </div>
);

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const MetricRow: React.FC<MetricRowProps> = ({ label, value, className }) => (
  <div className={cn('flex justify-between items-center py-1.5 border-b border-[var(--border-color)] last:border-0', className)}>
    <span className="text-xs text-[var(--text-secondary)]">{label}</span>
    <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
  </div>
);

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'buy' | 'sell' | 'hold' | 'default';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const cls = {
    buy: 'bg-green-900/50 text-green-400 border border-green-700',
    sell: 'bg-red-900/50 text-red-400 border border-red-700',
    hold: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
    default: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]',
  }[variant];

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cls)}>
      {children}
    </span>
  );
};

interface ScoreBarProps {
  value: number; // 0-100
  label?: string;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({ value, label }) => {
  const color =
    value >= 70 ? '#3fb950' : value >= 50 ? '#d29922' : '#f85149';

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-[var(--text-secondary)] w-12">{label}</span>}
      <div className="flex-1 bg-[var(--bg-secondary)] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right" style={{ color }}>
        {value.toFixed(0)}
      </span>
    </div>
  );
};

interface LoadingProps {
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ text = '載入中...' }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-secondary)]">
    <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    <span className="text-sm">{text}</span>
  </div>
);

interface EmptyProps {
  text?: string;
}

export const Empty: React.FC<EmptyProps> = ({ text = '無資料' }) => (
  <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-sm">
    {text}
  </div>
);
