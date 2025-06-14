#!/bin/bash

echo "🔧 安裝 Log 分析平台..."

# 檢查 Python 版本
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python3，正在安裝..."
    sudo apt update
    sudo apt install -y python3 python3-pip python3-venv
fi

# 檢查 pip
if ! command -v pip3 &> /dev/null; then
    echo "📦 安裝 pip3..."
    sudo apt update
    sudo apt install -y python3-pip
fi

# 建立虛擬環境
echo "🔨 建立虛擬環境..."
python3 -m venv venv

# 啟動虛擬環境
echo "🔌 啟動虛擬環境..."
source venv/bin/activate

# 升級 pip
pip install --upgrade pip

# 安裝依賴
echo "📚 安裝 Python 依賴..."
pip install -r requirements.txt

# 建立必要目錄
echo "📁 建立目錄結構..."
mkdir -p uploads
mkdir -p static/uploads

# 設定權限
echo "🔐 設定權限..."
chmod +x run.sh
chmod +x install.sh

echo "✅ 安裝完成！"
echo ""
echo "🚀 使用方法："
echo "   ./run.sh              # 啟動服務"
echo "   ./run.sh --help       # 查看說明"
echo ""
echo "🌐 服務將在 http://localhost:5000 啟動"
