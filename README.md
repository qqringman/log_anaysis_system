# 🚀 Log 分析平台

一個基於 Flask 的智慧型日誌分析平台，使用 FastGrep 技術快速搜尋和分析 Ubuntu Server 上的日誌檔案。

## ✨ 功能特色

- 🔍 **快速搜尋**: 使用系統內建的 grep 命令進行高效關鍵字搜尋
- 📁 **智慧瀏覽**: 直觀的檔案瀏覽器，支援目錄導航和檔案選擇
- 🏷️ **模組化管理**: 按模組分類管理關鍵字，提升搜尋精準度
- 📊 **視覺化結果**: 美觀的分析結果展示和統計圖表
- 💻 **響應式設計**: 支援桌面和行動設備
- 🎨 **現代化 UI**: 使用 Bootstrap 5 和漸層設計

## 🛠️ 系統需求

- **作業系統**: Ubuntu 16.04 或更高版本
- **Python**: 3.6 或更高版本
- **記憶體**: 建議 2GB 以上
- **磁碟空間**: 100MB 以上可用空間
- **權限**: 需要讀取日誌檔案的權限

## 📦 快速安裝

### 方法一：一鍵安裝 (推薦)

```bash
# 1. 解壓縮並進入目錄
unzip log_analyzer.zip
cd log_analyzer

# 2. 執行自動安裝腳本
chmod +x install.sh
./install.sh

# 3. 啟動服務
./run.sh
```

### 方法二：手動安裝

```bash
# 1. 確保系統已安裝必要套件
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 2. 建立虛擬環境
python3 -m venv venv
source venv/bin/activate

# 3. 安裝 Python 依賴
pip install --upgrade pip
pip install -r requirements.txt

# 4. 啟動應用程式
python3 app.py
```

## 🚀 使用說明

### 1. 啟動服務

```bash
./run.sh
```

預設服務會在 http://localhost:5000 啟動

### 2. 準備關鍵字檔案

創建 CSV 檔案，包含以下欄位：
- **Module**: 模組名稱
- **Keyword list**: 關鍵字清單 (用逗號分隔)

範例檔案內容：
```csv
Module,Keyword list
Error,error,ERROR,failed,FAILED,exception
Warning,warning,WARN,alert
Security,unauthorized,forbidden,attack
Database,database error,connection failed,timeout
Network,connection refused,network unreachable
System,out of memory,disk full,cpu usage
```

### 3. 上傳關鍵字

- 點擊「選擇檔案」或直接拖拽 CSV 檔案到上傳區域
- 系統會自動載入並顯示關鍵字預覽
- 也可以下載範例檔案作為參考

### 4. 瀏覽檔案

- 在檔案瀏覽器中導航到目標目錄
- 支援的檔案格式：.log, .txt, .out, .err
- 可以點擊目錄進入下層，點擊「..」返回上層

### 5. 選擇檔案

- 勾選要分析的日誌檔案
- 使用「全選」快速選取所有檔案
- 右下角顯示已選擇的檔案數量

### 6. 開始分析

- 點擊「開始分析」按鈕
- 系統使用 grep 命令快速搜尋關鍵字
- 分析完成後會顯示詳細結果

## 📋 進階設定

### 自定義啟動參數

```bash
# 指定端口
./run.sh --port 8080

# 指定主機地址 (只允許本機訪問)
./run.sh --host 127.0.0.1

# 啟用除錯模式
./run.sh --debug

# 組合使用
./run.sh --host 0.0.0.0 --port 8080 --debug
```

## 🎯 快速啟動檢查清單

- [ ] ✅ Ubuntu 16.04+ 
- [ ] ✅ Python 3.6+
- [ ] ✅ 解壓縮 log_analyzer.zip
- [ ] ✅ 執行 `./install.sh`
- [ ] ✅ 執行 `./run.sh`
- [ ] ✅ 開啟 `http://server-ip:5000`
- [ ] ✅ 上傳關鍵字 CSV
- [ ] ✅ 選擇日誌檔案
- [ ] ✅ 執行分析測試

🎉 **祝您使用愉快！**
