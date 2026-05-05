import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNumber = (n?: number | null, decimals = 2): string => {
  if (n == null) return '-';
  return n.toLocaleString('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatPercent = (n?: number | null): string => {
  if (n == null) return '-';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

export const formatWan = (n?: number | null): string => {
  if (n == null) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}億`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}萬`;
  return `${sign}${abs.toFixed(0)}`;
};

export const signalColor = (signal: string): string => {
  if (signal === 'BUY') return 'text-green-400';
  if (signal === 'SELL') return 'text-red-400';
  return 'text-yellow-400';
};

export const scoreColor = (score: number): string => {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
};

export const changeColor = (v?: number | null): string => {
  if (v == null) return '';
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
};
