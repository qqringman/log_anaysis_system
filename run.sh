#!/bin/bash

show_help() {
    echo "🚀 Log 分析平台啟動腳本"
    echo ""
    echo "使用方法:"
    echo "  ./run.sh [選項]"
    echo ""
    echo "選項:"
    echo "  --help, -h     顯示此說明"
    echo "  --port PORT    指定端口 (預設: 5000)"
    echo "  --host HOST    指定主機 (預設: 0.0.0.0)"
    echo "  --debug        啟用除錯模式"
    echo ""
    echo "範例:"
    echo "  ./run.sh                    # 預設啟動"
    echo "  ./run.sh --port 8080        # 指定端口"
    echo "  ./run.sh --host 127.0.0.1   # 只允許本機訪問"
}

# 預設設定
PORT=5000
HOST="0.0.0.0"
DEBUG=""

# 解析參數
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --debug)
            DEBUG="--debug"
            shift
            ;;
        *)
            echo "未知選項: $1"
            echo "使用 --help 查看說明"
            exit 1
            ;;
    esac
done

echo "🚀 啟動 Log 分析平台..."

# 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo "❌ 虛擬環境不存在，請先執行 ./install.sh"
    exit 1
fi

# 啟動虛擬環境
source venv/bin/activate

# 檢查依賴
if ! pip show Flask > /dev/null 2>&1; then
    echo "📚 安裝依賴..."
    pip install -r requirements.txt
fi

# 設定環境變數
export FLASK_APP=app.py
export FLASK_HOST=$HOST
export FLASK_PORT=$PORT

# 啟動應用
echo "🌐 啟動 Flask 應用..."
echo "📍 服務地址: http://$HOST:$PORT"
echo "📋 按 Ctrl+C 停止服務"
echo ""

if [ -n "$DEBUG" ]; then
    echo "🐛 除錯模式已啟用"
    python3 app.py --host $HOST --port $PORT --debug
else
    python3 app.py
fi
