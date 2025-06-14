// Enhanced Log 分析平台 v6 - 關鍵字管理器
// static/js/managers/keyword-manager.js

window.keywordManager = {
    init: function() {
        console.log('🏷️ 初始化關鍵字管理器');
        
        // 設置拖放上傳
        this.setupDropZone();
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 載入關鍵字
    loadKeywords: function() {
        $.get(appConfig.api.keywords)
            .done((data) => {
                console.log('📋 載入關鍵字:', data);
                if (Object.keys(data).length > 0) {
                    appConfig.state.keywords = data;
                    this.updateKeywordPreview();
                }
            })
            .fail(() => {
                console.log('❌ 載入關鍵字失敗');
                utils.showAlert('❌ 載入關鍵字失敗', 'danger');
            });
    },
    
    // 設置拖放區域
    setupDropZone: function() {
        const uploadZone = document.getElementById('upload-zone');
        if (!uploadZone) return;
        
        // 拖曳進入
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            $(uploadZone).addClass('dragover');
        });
        
        // 拖曳離開
        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            $(uploadZone).removeClass('dragover');
        });
        
        // 拖曳放下
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            $(uploadZone).removeClass('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadKeywords(files[0]);
            }
        });
        
        // 點擊上傳
        uploadZone.addEventListener('click', () => {
            $('#keyword-file').click();
        });
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 檔案選擇
        $('#keyword-file').on('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📁 選擇檔案:', file.name);
                this.uploadKeywords(file);
            }
        });
    },
    
    // 上傳關鍵字
    uploadKeywords: function(file) {
        if (!file) {
            console.log('❌ 沒有選擇檔案');
            return;
        }
        
        // 檢查檔案類型
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
            utils.showAlert('❌ 請上傳 CSV 或 TXT 格式的檔案', 'danger');
            return;
        }
        
        console.log('📤 上傳關鍵字檔案:', file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        
        utils.showAlert('📤 上傳中...', 'info', 2000);
        
        $.ajax({
            url: '/upload_keywords',  // 修正為正確的路徑
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (response) => {
                console.log('📋 上傳回應:', response);
                if (response.success) {
                    appConfig.state.keywords = response.keywords;
                    this.updateKeywordPreview();
                    utils.showAlert(`✅ ${response.message}`, 'success');
                    utils.playNotificationSound('success');
                    
                    // 更新分析按鈕狀態
                    this.updateAnalysisButtons();
                } else {
                    utils.showAlert(`❌ ${response.message || '上傳失敗'}`, 'danger');
                }
            },
            error: (xhr, status, error) => {
                console.error('❌ 上傳失敗:', status, error);
                let errorMessage = '上傳失敗';
                
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 404) {
                    errorMessage = '上傳接口不存在，請檢查後端服務';
                } else if (xhr.status === 500) {
                    errorMessage = '伺服器錯誤，請稍後再試';
                }
                
                utils.showAlert(`❌ ${errorMessage}`, 'danger');
            }
        });
    },
    
    // 更新關鍵字預覽
    updateKeywordPreview: function() {
        const preview = $('#keyword-preview');
        const modules = $('#keyword-modules');
        
        if (Object.keys(appConfig.state.keywords).length === 0) {
            preview.hide();
            return;
        }
        
        modules.empty();
        
        Object.entries(appConfig.state.keywords).forEach(([module, keywordList]) => {
            const moduleElement = $(`
                <div class="keyword-module animate__animated animate__fadeIn" data-module="${module}">
                    <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded mb-2">
                        <div>
                            <h6 class="mb-1">
                                <i class="fas fa-tag me-2 text-primary"></i>${module}
                            </h6>
                            <div class="keyword-list">
                                ${keywordList.map(k => `<span class="badge bg-secondary me-1">${k}</span>`).join('')}
                            </div>
                            <small class="text-muted">共 ${keywordList.length} 個關鍵字</small>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="keywordManager.deleteKeywordModule('${module}')" title="刪除此模組">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `);
            modules.append(moduleElement);
        });
        
        preview.show();
        
        // 更新統計
        const totalModules = Object.keys(appConfig.state.keywords).length;
        const totalKeywords = Object.values(appConfig.state.keywords).reduce((sum, list) => sum + list.length, 0);
        
        modules.append(`
            <div class="mt-3 p-3 bg-info bg-opacity-10 rounded">
                <i class="fas fa-info-circle me-2"></i>
                總計: ${totalModules} 個模組, ${totalKeywords} 個關鍵字
            </div>
        `);
        
        console.log('📋 關鍵字預覽已更新');
    },
    
    // 刪除關鍵字模組
    deleteKeywordModule: function(module) {
        if (!confirm(`確定要刪除模組 "${module}" 嗎？`)) {
            return;
        }
        
        $.ajax({
            url: `${appConfig.api.deleteKeyword}${encodeURIComponent(module)}`,
            type: 'DELETE',
            success: (response) => {
                if (response.success) {
                    delete appConfig.state.keywords[module];
                    this.updateKeywordPreview();
                    utils.showAlert(`✅ 已刪除模組: ${module}`, 'success');
                    utils.playNotificationSound('success');
                    
                    // 更新分析按鈕狀態
                    this.updateAnalysisButtons();
                } else {
                    utils.showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: () => {
                utils.showAlert('❌ 刪除失敗', 'danger');
            }
        });
    },
    
    // 復原所有關鍵字
    restoreKeywords: function() {
        if (!confirm('確定要復原所有關鍵字模組嗎？')) {
            return;
        }
        
        $.ajax({
            url: appConfig.api.restoreKeywords,
            type: 'POST',
            success: (response) => {
                if (response.success) {
                    appConfig.state.keywords = response.keywords;
                    this.updateKeywordPreview();
                    utils.showAlert(`✅ ${response.message}`, 'success');
                    utils.playNotificationSound('success');
                    
                    // 更新分析按鈕狀態
                    this.updateAnalysisButtons();
                } else {
                    utils.showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: () => {
                utils.showAlert('❌ 復原失敗', 'danger');
            }
        });
    },
    
    // 更新分析按鈕狀態
    updateAnalysisButtons: function() {
        const hasKeywords = Object.keys(appConfig.state.keywords).length > 0;
        const hasFiles = appConfig.state.selectedFiles.length > 0;
        
        // 更新流式分析按鈕
        const analyzeBtn = $('#analyze-btn');
        if (hasKeywords && hasFiles) {
            analyzeBtn.prop('disabled', false);
        } else {
            analyzeBtn.prop('disabled', true);
        }
        
        // 更新快速分析按鈕
        quickAnalysis.updateAnalysisButton();
    },
    
    // 匯出關鍵字
    exportKeywords: function() {
        if (Object.keys(appConfig.state.keywords).length === 0) {
            utils.showAlert('⚠️ 沒有關鍵字可以匯出', 'warning');
            return;
        }
        
        // 轉換為 CSV 格式
        let csv = 'Module,Keyword list\n';
        
        Object.entries(appConfig.state.keywords).forEach(([module, keywordList]) => {
            csv += `"${module}","${keywordList.join(',')}"\n`;
        });
        
        // 下載 CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keywords_${new Date().getTime()}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        utils.showAlert('✅ 關鍵字已匯出', 'success');
    },
    
    // 快速添加關鍵字
    quickAddKeyword: function() {
        const module = prompt('請輸入模組名稱:');
        if (!module) return;
        
        const keywords = prompt('請輸入關鍵字（用逗號分隔）:');
        if (!keywords) return;
        
        const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
        
        if (keywordList.length === 0) {
            utils.showAlert('⚠️ 請輸入有效的關鍵字', 'warning');
            return;
        }
        
        // 添加到本地關鍵字
        if (!appConfig.state.keywords[module]) {
            appConfig.state.keywords[module] = [];
        }
        
        appConfig.state.keywords[module] = appConfig.state.keywords[module].concat(keywordList);
        
        // 更新預覽
        this.updateKeywordPreview();
        this.updateAnalysisButtons();
        
        utils.showAlert(`✅ 已添加關鍵字到模組: ${module}`, 'success');
    },
    
    // 清空所有關鍵字
    clearAllKeywords: function() {
        if (Object.keys(appConfig.state.keywords).length === 0) {
            utils.showAlert('⚠️ 沒有關鍵字需要清空', 'warning');
            return;
        }
        
        if (!confirm('確定要清空所有關鍵字嗎？此操作無法復原。')) {
            return;
        }
        
        appConfig.state.keywords = {};
        this.updateKeywordPreview();
        this.updateAnalysisButtons();
        
        utils.showAlert('✅ 已清空所有關鍵字', 'success');
    },
    
    // 驗證 CSV 格式
    validateCSV: function(content) {
        try {
            const lines = content.trim().split('\n');
            if (lines.length < 2) {
                return { valid: false, error: 'CSV 檔案至少需要標題行和一行資料' };
            }
            
            const header = lines[0].toLowerCase();
            if (!header.includes('module') || !header.includes('keyword')) {
                return { valid: false, error: 'CSV 標題必須包含 Module 和 Keyword 欄位' };
            }
            
            return { valid: true };
        } catch (e) {
            return { valid: false, error: '無效的 CSV 格式' };
        }
    }
};