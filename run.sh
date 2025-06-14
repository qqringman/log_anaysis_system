#!/bin/bash

# Enhanced Log 分析平台 v6 啟動腳本

echo "🚀 Enhanced Log 分析平台 v6 啟動中..."
echo "=================================="

# 檢查 Python 版本
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python 版本: $python_version"

# 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo "⚠️  虛擬環境不存在，正在創建..."
    python3 -m venv venv
    echo "✓ 虛擬環境創建完成"
fi

# 啟動虛擬環境
echo "🔄 啟動虛擬環境..."
source venv/bin/activate

# 檢查並安裝依賴
echo "📦 檢查依賴..."
pip install -r requirements.txt --quiet

# 創建必要目錄
echo "📁 創建必要目錄..."
mkdir -p uploads/chat
mkdir -p uploads/archives
mkdir -p static/js
mkdir -p static/css
mkdir -p templates
echo "✓ 目錄創建完成"

# 檢查 grep 命令
if command -v grep &> /dev/null; then
    echo "✓ grep 命令可用"
else
    echo "⚠️  警告: grep 命令不可用，分析功能可能受限"
fi

# 設置環境變數
export FLASK_APP=app.py
export FLASK_ENV=development

# 啟動應用
echo ""
echo "🎉 啟動應用..."
echo "=================================="
echo "📍 訪問地址: http://localhost:5000"
echo "📍 按 Ctrl+C 停止應用"
echo "=================================="
echo ""

# 啟動 Flask 應用
python app.py