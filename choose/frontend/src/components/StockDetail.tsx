import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, BarChart2, Users } from 'lucide-react';
import { getPriceData, getFundamental, getInstitutional } from '../services/api';
import CandlestickChart from './charts/CandlestickChart';
import IndicatorCharts from './charts/IndicatorCharts';
import { Card, MetricRow, Badge, Loading, Empty } from './ui/Card';
import { formatNumber, formatPercent, formatWan, changeColor } from '../lib/utils';
import InstitutionalChart from './charts/InstitutionalChart';

interface StockDetailProps {
  stockId: string;
}

type TabKey = 'technical' | 'fundamental' | 'institutional';

const StockDetail: React.FC<StockDetailProps> = ({ stockId }) => {
  const [tab, setTab] = useState<TabKey>('technical');
  const [showBB, setShowBB] = useState(false);

  const techQuery = useQuery({
    queryKey: ['price', stockId],
    queryFn: () => getPriceData(stockId, 180),
    enabled: !!stockId,
  });

  const fundQuery = useQuery({
    queryKey: ['fundamental', stockId],
    queryFn: () => getFundamental(stockId),
    enabled: !!stockId && tab === 'fundamental',
  });

  const instQuery = useQuery({
    queryKey: ['institutional', stockId],
    queryFn: () => getInstitutional(stockId, 60),
    enabled: !!stockId && tab === 'institutional',
  });

  if (!stockId) return <Empty text="請搜尋並選擇一支股票" />;

  const tabs = [
    { key: 'technical' as TabKey, label: '技術面', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: 'fundamental' as TabKey, label: '基本面', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: 'institutional' as TabKey, label: '籌碼面', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* 頁籤 */}
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 技術面 */}
      {tab === 'technical' && (
        <>
          {techQuery.isLoading && <Loading text="載入K線資料..." />}
          {techQuery.error && <Empty text="資料載入失敗，請確認後端服務是否啟動" />}
          {techQuery.data && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {/* 主圖 */}
              <div className="xl:col-span-3 space-y-4">
                <Card
                  title={`${stockId} K線圖`}
                  action={
                    <button
                      onClick={() => setShowBB(!showBB)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        showBB
                          ? 'border-indigo-500 text-indigo-400 bg-indigo-900/30'
                          : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                      }`}
                    >
                      BB
                    </button>
                  }
                >
                  <CandlestickChart
                    data={techQuery.data.candles}
                    showMA
                    showBB={showBB}
                  />
                </Card>
                <Card title="技術指標">
                  <IndicatorCharts data={techQuery.data.candles} />
                </Card>
              </div>

              {/* 側欄評分 */}
              <div className="space-y-4">
                <Card title="技術評分">
                  <div className="text-center py-2">
                    <div
                      className="text-4xl font-bold mb-1"
                      style={{
                        color:
                          techQuery.data.score >= 70
                            ? '#3fb950'
                            : techQuery.data.score >= 50
                            ? '#d29922'
                            : '#f85149',
                      }}
                    >
                      {techQuery.data.score}
                    </div>
                    <Badge
                      variant={
                        techQuery.data.signal === 'BUY'
                          ? 'buy'
                          : techQuery.data.signal === 'SELL'
                          ? 'sell'
                          : 'hold'
                      }
                    >
                      {techQuery.data.signal === 'BUY'
                        ? '建議買入'
                        : techQuery.data.signal === 'SELL'
                        ? '建議賣出'
                        : '觀望'}
                    </Badge>
                  </div>
                </Card>

                <Card title="最新指標">
                  {techQuery.data.indicators && (
                    <>
                      <MetricRow label="RSI(14)" value={formatNumber(techQuery.data.indicators.rsi_14, 1)} />
                      <MetricRow label="MACD" value={formatNumber(techQuery.data.indicators.macd)} />
                      <MetricRow label="MACD Signal" value={formatNumber(techQuery.data.indicators.macd_signal)} />
                      <MetricRow label="MA5" value={formatNumber(techQuery.data.indicators.ma5)} />
                      <MetricRow label="MA20" value={formatNumber(techQuery.data.indicators.ma20)} />
                      <MetricRow label="MA60" value={formatNumber(techQuery.data.indicators.ma60)} />
                      <MetricRow label="BB 上軌" value={formatNumber(techQuery.data.indicators.bb_upper)} />
                      <MetricRow label="BB 下軌" value={formatNumber(techQuery.data.indicators.bb_lower)} />
                      <MetricRow label="KD-K" value={formatNumber(techQuery.data.indicators.kdj_k, 1)} />
                      <MetricRow label="KD-D" value={formatNumber(techQuery.data.indicators.kdj_d, 1)} />
                    </>
                  )}
                </Card>

                {techQuery.data.reasons.length > 0 && (
                  <Card title="訊號原因">
                    <ul className="space-y-1.5">
                      {techQuery.data.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
                          <span className="text-[var(--accent)] flex-shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 基本面 */}
      {tab === 'fundamental' && (
        <>
          {fundQuery.isLoading && <Loading text="載入財報資料..." />}
          {fundQuery.error && <Empty text="財報資料載入失敗" />}
          {fundQuery.data && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 space-y-4">
                {/* 損益表 */}
                <Card title="近期損益表">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-color)]">
                          {['日期', '營收', '毛利率', '營益率', '淨利率', 'EPS'].map((h) => (
                            <th key={h} className="text-left py-2 pr-3 text-[var(--text-secondary)] font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fundQuery.data.income_statements.slice(-8).map((s) => (
                          <tr key={s.date} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-secondary)]/50">
                            <td className="py-2 pr-3 text-[var(--text-secondary)]">{s.date}</td>
                            <td className="py-2 pr-3">{s.revenue ? `${(s.revenue / 1e8).toFixed(1)}億` : '-'}</td>
                            <td className={`py-2 pr-3 ${changeColor(s.gross_margin)}`}>{formatPercent(s.gross_margin)}</td>
                            <td className={`py-2 pr-3 ${changeColor(s.operating_margin)}`}>{formatPercent(s.operating_margin)}</td>
                            <td className={`py-2 pr-3 ${changeColor(s.net_margin)}`}>{formatPercent(s.net_margin)}</td>
                            <td className={`py-2 ${changeColor(s.eps)}`}>{formatNumber(s.eps)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* 估值指標 */}
              <div className="space-y-4">
                <Card title="基本面評分">
                  <div className="text-center py-2">
                    <div
                      className="text-4xl font-bold mb-1"
                      style={{
                        color:
                          fundQuery.data.score >= 70 ? '#3fb950' : fundQuery.data.score >= 50 ? '#d29922' : '#f85149',
                      }}
                    >
                      {fundQuery.data.score}
                    </div>
                  </div>
                </Card>

                <Card title="估值指標">
                  <MetricRow label="本益比 P/E" value={formatNumber(fundQuery.data.valuation?.pe_ratio)} />
                  <MetricRow label="股價淨值比 P/B" value={formatNumber(fundQuery.data.valuation?.pb_ratio)} />
                  <MetricRow
                    label="ROE"
                    value={
                      <span className={changeColor(fundQuery.data.valuation?.roe)}>
                        {formatPercent(fundQuery.data.valuation?.roe)}
                      </span>
                    }
                  />
                  <MetricRow label="ROA" value={formatPercent(fundQuery.data.valuation?.roa)} />
                  <MetricRow
                    label="營收年增率"
                    value={
                      <span className={changeColor(fundQuery.data.valuation?.revenue_growth_yoy)}>
                        {formatPercent(fundQuery.data.valuation?.revenue_growth_yoy)}
                      </span>
                    }
                  />
                  <MetricRow
                    label="EPS 年增率"
                    value={
                      <span className={changeColor(fundQuery.data.valuation?.eps_growth_yoy)}>
                        {formatPercent(fundQuery.data.valuation?.eps_growth_yoy)}
                      </span>
                    }
                  />
                </Card>

                {fundQuery.data.reasons.length > 0 && (
                  <Card title="評分原因">
                    <ul className="space-y-1.5">
                      {fundQuery.data.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
                          <span className="text-[var(--accent)] flex-shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 籌碼面 */}
      {tab === 'institutional' && (
        <>
          {instQuery.isLoading && <Loading text="載入籌碼資料..." />}
          {instQuery.error && <Empty text="籌碼資料載入失敗" />}
          {instQuery.data && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-3">
                <Card title="三大法人買賣超">
                  <InstitutionalChart data={instQuery.data.records} />
                </Card>
              </div>
              <div className="space-y-4">
                <Card title="籌碼評分">
                  <div className="text-center py-2">
                    <div
                      className="text-4xl font-bold mb-1"
                      style={{
                        color:
                          instQuery.data.score >= 70 ? '#3fb950' : instQuery.data.score >= 50 ? '#d29922' : '#f85149',
                      }}
                    >
                      {instQuery.data.score}
                    </div>
                  </div>
                </Card>

                <Card title="籌碼統計">
                  <MetricRow
                    label="外資近3日"
                    value={
                      <span className={changeColor(instQuery.data.stats.foreign_net_3d)}>
                        {formatWan(instQuery.data.stats.foreign_net_3d)}股
                      </span>
                    }
                  />
                  <MetricRow
                    label="外資近10日"
                    value={
                      <span className={changeColor(instQuery.data.stats.foreign_net_10d)}>
                        {formatWan(instQuery.data.stats.foreign_net_10d)}股
                      </span>
                    }
                  />
                  <MetricRow
                    label="外資連買/賣"
                    value={
                      <span className={changeColor(instQuery.data.stats.foreign_consecutive)}>
                        {instQuery.data.stats.foreign_consecutive ?? 0} 天
                      </span>
                    }
                  />
                  <MetricRow
                    label="投信近3日"
                    value={
                      <span className={changeColor(instQuery.data.stats.trust_net_3d)}>
                        {formatWan(instQuery.data.stats.trust_net_3d)}股
                      </span>
                    }
                  />
                  <MetricRow
                    label="三大法人近5日"
                    value={
                      <span className={changeColor(instQuery.data.stats.total_net_5d)}>
                        {formatWan(instQuery.data.stats.total_net_5d)}股
                      </span>
                    }
                  />
                </Card>

                {instQuery.data.reasons.length > 0 && (
                  <Card title="評分原因">
                    <ul className="space-y-1.5">
                      {instQuery.data.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
                          <span className="text-[var(--accent)] flex-shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockDetail;
