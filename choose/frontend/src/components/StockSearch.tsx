import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { StockInfo } from '../types';
import { getStockList } from '../services/api';

interface StockSearchProps {
  value?: string;
  onChange: (stockId: string) => void;
  placeholder?: string;
}

const StockSearch: React.FC<StockSearchProps> = ({ value, onChange, placeholder = '輸入股票代號或名稱...' }) => {
  const [query, setQuery] = useState(value || '');
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [filtered, setFiltered] = useState<StockInfo[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStockList().then(setStocks).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered([]);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      stocks
        .filter(
          (s) =>
            s.stock_id.includes(q) ||
            s.stock_name.toLowerCase().includes(q)
        )
        .slice(0, 12)
    );
  }, [query, stocks]);

  // 點外部關閉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (s: StockInfo) => {
    setQuery(`${s.stock_id} ${s.stock_name}`);
    onChange(s.stock_id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus-within:border-[var(--accent)] transition-colors">
        <Search className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
        <input
          type="text"
          className="bg-transparent flex-1 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s.stock_id}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-secondary)] transition-colors text-left"
              onClick={() => select(s)}
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">
                <span className="text-[var(--accent)]">{s.stock_id}</span>
                {' '}
                {s.stock_name}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">{s.industry}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockSearch;
