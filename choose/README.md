# 智能選股系統

整合**基本面**（財務報表）、**技術面**（K線走勢）、**籌碼面**（法人買賣超）的全自動選股系統，並支援 Python 策略回測。

## 專案架構

```
choose/
├── backend/              # Python FastAPI 後端
│   ├── main.py           # 應用入口
│   ├── requirements.txt
│   └── app/
│       ├── api/
│       │   ├── stocks.py      # 股票資料 API
│       │   ├── screener.py    # 選股篩選 API
│       │   └── backtest.py    # 策略回測 API
│       ├── services/
│       │   ├── data_service.py         # FinMind/yfinance 資料抓取
│       │   ├── technical_analysis.py   # 技術面分析（RSI/MACD/KD/BB）
│       │   ├── fundamental_analysis.py # 基本面分析（財報/估值）
│       │   ├── institutional_analysis.py # 籌碼面分析
│       │   └── backtester.py           # 回測引擎
│       └── models/
│           └── schemas.py     # Pydantic 型別定義
└── frontend/             # React + TypeScript 前端
    └── src/
        ├── components/
        │   ├── StockScreener.tsx   # 選股篩選頁
        │   ├── StockDetail.tsx     # 個股分析頁
        │   ├── BacktestPanel.tsx   # 回測頁
        │   ├── StockSearch.tsx     # 股票搜尋元件
        │   ├── charts/
        │   │   ├── CandlestickChart.tsx  # K線圖
        │   │   ├── IndicatorCharts.tsx   # RSI/MACD 圖
        │   │   └── InstitutionalChart.tsx # 法人買賣超圖
        │   └── ui/Card.tsx
        ├── services/api.ts    # API 呼叫層
        ├── types/index.ts     # TypeScript 型別
        └── lib/utils.ts       # 工具函式
```

## 快速啟動

```bash
chmod +x start.sh
./start.sh
```

或分別啟動：

### 後端
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

開啟瀏覽器：http://localhost:5173

## 功能說明

### 智能選股
- 設定基本面條件（ROE、P/E、營收成長率）
- 設定技術面條件（RSI 區間、MACD 多頭）
- 設定籌碼面條件（外資連買天數、法人合計買超）
- 自訂三大面向**評分權重**
- 點選結果可直接跳轉個股分析

### 個股分析
- **技術面**：K線圖（含均線、布林通道）、RSI、MACD、KD 指標、評分與買賣訊號
- **基本面**：近期損益表（毛利率、營益率、EPS）、P/E、ROE、成長率分析
- **籌碼面**：外資、投信、自營商買賣超走勢圖、連買天數統計

### 策略回測
支援 5 種策略：
| 策略 | 說明 |
|------|------|
| 綜合評分 | 技術面 + 籌碼面加權，超過門檻值買入 |
| 均線交叉 | 短均線穿越長均線（黃金/死亡交叉） |
| MACD | MACD 柱狀體翻正/翻負 |
| RSI | RSI 超賣買入、超買賣出 |
| 籌碼策略 | 三大法人大量買超買入 |

績效指標：總報酬率、年化報酬率、最大回撤、夏普比率、勝率、獲利因子

## 資料來源
- **價格資料**：FinMind API（台股免費資料）/ yfinance（備援）
- **財務報表**：FinMind TaiwanStockFinancialStatements
- **法人資料**：FinMind TaiwanStockInstitutionalInvestors
