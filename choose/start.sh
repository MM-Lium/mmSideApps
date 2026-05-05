#!/bin/bash
# 智能選股系統 - 一鍵啟動腳本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=== 智能選股系統 啟動中 ==="

# 後端虛擬環境
if [ ! -d "$BACKEND_DIR/venv" ]; then
  echo "[1/4] 建立 Python 虛擬環境..."
  python3 -m venv "$BACKEND_DIR/venv"
fi

echo "[2/4] 安裝 Python 套件..."
"$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt" -q

echo "[3/4] 啟動 FastAPI 後端 (port 8000)..."
cd "$BACKEND_DIR"
"$BACKEND_DIR/venv/bin/uvicorn" main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "後端 PID: $BACKEND_PID"

echo "[4/4] 啟動 React 前端 (port 5173)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo "前端 PID: $FRONTEND_PID"

echo ""
echo "✅ 系統啟動完成！"
echo "   前端: http://localhost:5173"
echo "   後端 API: http://localhost:8000"
echo "   API 文件: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服務"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '服務已停止'" INT TERM
wait
