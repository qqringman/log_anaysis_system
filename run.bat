@echo off
REM Enhanced Log 分析平台 v6 啟動腳本 (Windows)

echo ========================================
echo ?? Enhanced Log 分析平台 v6 啟動中...
echo ========================================

REM 檢查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ? 錯誤: 找不到 Python，請先安裝 Python 3.8+
    pause
    exit /b 1
)

echo ? Python 已安裝

REM 檢查虛擬環境
if not exist "venv" (
    echo ??  虛擬環境不存在，正在創建...
    python -m venv venv
    echo ? 虛擬環境創建完成
)

REM 啟動虛擬環境
echo ?? 啟動虛擬環境...
call venv\Scripts\activate

REM 安裝依賴
echo ?? 檢查並安裝依賴...
pip install -r requirements.txt

REM 創建必要目錄
echo ?? 創建必要目錄...
if not exist "uploads\chat" mkdir uploads\chat
if not exist "uploads\archives" mkdir uploads\archives
if not exist "static\js" mkdir static\js
if not exist "static\css" mkdir static\css
if not exist "templates" mkdir templates
echo ? 目錄創建完成

REM 設置環境變數
set FLASK_APP=app.py
set FLASK_ENV=development

REM 啟動應用
echo.
echo ========================================
echo ?? 啟動應用...
echo ========================================
echo ?? 訪問地址: http://localhost:5000
echo ?? 按 Ctrl+C 停止應用
echo ========================================
echo.

REM 啟動 Flask 應用
python app.py

pause