# Enhanced Log 分析平台 v6 - 完整功能升級版

## ?? 功能特色

### 核心功能
- **流式日誌分析**: 即時分析大型日誌檔案，支援多種格式
- **關鍵字檢測**: 模組化關鍵字管理，支援批量匯入
- **視覺化統計**: 即時圖表展示分析結果
- **檔案瀏覽器**: 完整的檔案系統瀏覽功能

### 新增功能 (v6)
1. **完整聊天室系統**
   - 即時聊天與歷史記錄
   - 創建和管理多個聊天室
   - 獨立聊天室頁面
   - 線上用戶列表與 @提及功能

2. **廣播系統**
   - 向所有線上用戶發送通知
   - 自定義訊息和優先級

3. **互動功能**
   - 自定義幸運轉盤
   - 投票系統
   - 檔案分享
   - 支援圖片和連結

4. **聊天室管理中心**
   - 集中管理所有聊天室
   - 查看資源和活動記錄

5. **可拖動區塊設計**
   - 類似 JIRA Dashboard 的佈局
   - 支援多種佈局模式（預設、網格、瀑布流）
   - 區塊可自由拖動排序

6. **響應式設計**
   - 電腦版/手機版切換
   - 支援 Android/iOS 檢視模式

7. **分享功能**
   - 分析結果分享（公開/私密）
   - 分享管理中心
   - 過期時間控制

## ?? 系統需求

- Python 3.8+
- 支援的作業系統: Linux, macOS, Windows
- 瀏覽器: Chrome, Firefox, Safari, Edge (最新版本)

## ??? 安裝步驟

1. **克隆專案**
   ```bash
   git clone https://github.com/your-repo/enhanced-log-analysis-v6.git
   cd enhanced-log-analysis-v6
   ```

2. **建立虛擬環境**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Linux/macOS
   source venv/bin/activate
   ```

3. **安裝依賴**
   ```bash
   pip install -r requirements.txt
   ```

4. **建立必要目錄**
   ```bash
   mkdir -p uploads/chat
   mkdir -p uploads/archives
   mkdir -p static/js
   mkdir -p static/css
   mkdir -p templates
   ```

5. **啟動應用**
   ```bash
   python app.py
   ```

6. **訪問應用**
   打開瀏覽器訪問: `http://localhost:5000`

## ?? 專案結構

```
enhanced-log-analysis-v6/
├── app.py                     # 主應用程式
├── requirements.txt           # Python 依賴
├── README.md                 # 專案說明
├── templates/                # HTML 模板
│   ├── enhanced_index_v2.html    # 主頁面
│   ├── room.html                 # 聊天室頁面
│   ├── room_manager.html         # 聊天室管理
│   ├── analysis_report.html      # 分析報告
│   ├── shared_report.html        # 分享報告
│   └── enhanced_file_viewer.html # 檔案檢視器
├── static/                   # 靜態資源
│   ├── js/
│   │   └── enhanced-app-v6.js    # 主要 JavaScript
│   └── css/
│       └── custom-styles.css     # 自定義樣式
├── uploads/                  # 上傳檔案目錄
│   ├── chat/                    # 聊天室檔案
│   └── archives/                # 壓縮檔案
├── chat_data.db             # SQLite 資料庫
└── uploads/
    └── keywords_sample.csv  # 關鍵字範例檔案
```

## ?? 使用指南

### 1. 關鍵字管理
- 上傳 CSV 格式的關鍵字檔案
- 格式要求: `Module,Keyword list`
- 支援拖拽上傳

### 2. 檔案分析
- 瀏覽並選擇要分析的檔案
- 支援拖拽檔案快速分析
- 支援壓縮檔案 (.zip, .7z, .tar.gz)

### 3. 聊天室功能
- 輸入名稱後可加入聊天
- 使用 @ 提及其他用戶
- 支援檔案上傳和分享

### 4. 佈局管理
- 點擊右上角按鈕切換佈局模式
- 拖動區塊標題進行重新排序
- 點擊 X 最小化區塊

## ?? 配置選項

### FastGrep 設定
```python
'fastgrep_settings': {
    'threads': 4,        # 執行緒數
    'use_mmap': True,    # 記憶體映射
    'context_lines': 0,  # 上下文行數
    'timeout': 120       # 超時時間(秒)
}
```

### 檔案大小限制
```python
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
```

## ?? 故障排除

### 常見問題

1. **分析無結果**
   - 確認關鍵字格式正確
   - 檢查檔案編碼是否為 UTF-8
   - 確認 grep 命令可用

2. **Socket.IO 連接失敗**
   - 檢查防火牆設定
   - 確認 eventlet 已安裝
   - 重啟應用程式

3. **檔案上傳失敗**
   - 檢查 uploads 目錄權限
   - 確認檔案大小未超過限制

## ?? 更新日誌

### v6.0 (2025-01-10)
- ? 修復分析引擎
- ? 新增完整聊天室系統
- ? 新增廣播功能
- ? 支援自定義轉盤
- ? 新增分享功能
- ? 可拖動區塊設計
- ? 響應式手機版支援

## ?? 貢獻指南

歡迎提交 Issue 和 Pull Request！

## ?? 授權

c 2025 Vince. All rights reserved.

## ?? 聯絡方式

如有問題或建議，請聯絡開發團隊。