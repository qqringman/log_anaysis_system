// Enhanced Log 分析平台 v6 - 快速分析
// static/js/managers/quick-analysis.js

window.quickAnalysis = {
    init: function() {
        console.log('⚡ 初始化快速分析');
        
        // 設置拖放區域
        this.setupDropZone();
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 設置拖放區域
    setupDropZone: function() {
        const dropZone = document.getElementById('drop-analysis-zone');
        const quickAnalysisFile = document.getElementById('quick-analysis-file');
        
        if (!dropZone || !quickAnalysisFile) return;
        
        // 拖曳事件
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            $(dropZone).addClass('dragover');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!dropZone.contains(e.relatedTarget)) {
                $(dropZone).removeClass('dragover');
            }
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            $(dropZone).removeClass('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleDroppedFiles(files);
        });
        
        // 檔案選擇器事件
        quickAnalysisFile.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleDroppedFiles(files);
        });
    },
    
    // 處理拖曳的檔案
    handleDroppedFiles: function(files) {
        console.log('📁 處理拖曳檔案:', files.length, '個');
        
        files.forEach(file => {
            // 檢查檔案類型
            const validExtensions = [...appConfig.defaults.supportedLogExtensions, ...appConfig.defaults.supportedArchiveExtensions];
            
            if (!utils.isValidFileType(file.name, validExtensions)) {
                utils.showAlert(`❌ 不支援的檔案類型: ${file.name}`, 'danger');
                return;
            }
            
            // 檢查檔案大小
            if (file.size > appConfig.defaults.maxFileSize) {
                utils.showAlert(`❌ 檔案太大: ${file.name} (最大 100MB)`, 'danger');
                return;
            }
            
            // 上傳檔案
            this.uploadFile(file);
        });
    },
    
    // 上傳檔案
    uploadFile: function(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        utils.showAlert(`📤 上傳檔案: ${file.name}`, 'info', 2000);
        
        // 判斷是否為壓縮檔
        const isArchive = appConfig.defaults.supportedArchiveExtensions.some(ext => file.name.endsWith(ext));
        const uploadUrl = isArchive ? appConfig.api.uploadArchive : appConfig.api.uploadFile;
        
        $.ajax({
            url: uploadUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (response) => {
                if (response.success) {
                    if (isArchive) {
                        // 處理壓縮檔案結果
                        this.handleArchiveUpload(response, file);
                    } else {
                        // 處理普通檔案
                        this.handleFileUpload(response, file);
                    }
                } else {
                    utils.showAlert(`❌ 上傳失敗: ${response.message}`, 'danger');
                }
            },
            error: () => {
                utils.showAlert(`❌ 上傳檔案 ${file.name} 失敗`, 'danger');
            }
        });
    },
    
    // 處理普通檔案上傳
    handleFileUpload: function(response, file) {
        // 添加到拖曳檔案列表
        const fileInfo = {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            file: file,
            virtualPath: response.virtual_path,
            actualPath: response.file_path
        };
        
        appConfig.state.droppedFiles.push(fileInfo);
        appConfig.state.selectedFiles.push(response.virtual_path);
        
        this.updateDroppedFilesList();
        this.updateAnalysisCount();
        fileBrowser.updateSelectedCount();
        
        utils.showAlert(`✅ 已添加檔案: ${file.name}`, 'success');
    },
    
    // 處理壓縮檔案上傳
    handleArchiveUpload: function(response, file) {
        utils.showAlert(`✅ ${response.message}`, 'success');
        
        // 顯示解壓縮的檔案列表
        if (response.files && response.files.length > 0) {
            const modal = $(`
                <div class="modal fade" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-file-archive me-2"></i>選擇要分析的檔案
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>從 <strong>${file.name}</strong> 解壓縮出 ${response.files.length} 個檔案：</p>
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" id="select-all-archive" checked>
                                    <label class="form-check-label" for="select-all-archive">
                                        <strong>全選</strong>
                                    </label>
                                </div>
                                <div class="archive-files-list" style="max-height: 400px; overflow-y: auto;">
                                    ${response.files.map((f, index) => `
                                        <div class="form-check">
                                            <input class="form-check-input archive-file" type="checkbox" 
                                                   value="${f.path}" id="archive-file-${index}" checked>
                                            <label class="form-check-label" for="archive-file-${index}">
                                                <i class="fas ${utils.getFileIcon(f.name)} me-2"></i>
                                                ${f.name} <small class="text-muted">(${f.size})</small>
                                            </label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-primary" id="add-archive-files">
                                    <i class="fas fa-plus me-2"></i>添加選中的檔案
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            $('body').append(modal);
            const modalInstance = new bootstrap.Modal(modal[0]);
            modalInstance.show();
            
            // 全選功能
            modal.find('#select-all-archive').on('change', function() {
                modal.find('.archive-file').prop('checked', $(this).is(':checked'));
            });
            
            // 添加檔案
            modal.find('#add-archive-files').on('click', () => {
                const selectedFiles = [];
                modal.find('.archive-file:checked').each(function() {
                    const filePath = $(this).val();
                    const fileData = response.files.find(f => f.path === filePath);
                    if (fileData) {
                        selectedFiles.push(fileData);
                    }
                });
                
                if (selectedFiles.length > 0) {
                    selectedFiles.forEach(fileData => {
                        const fileInfo = {
                            name: fileData.name,
                            size: 0, // 從伺服器獲取的大小
                            lastModified: Date.now(),
                            file: null, // 壓縮檔案沒有原始 File 物件
                            virtualPath: fileData.path,
                            actualPath: fileData.path,
                            fromArchive: true
                        };
                        
                        appConfig.state.droppedFiles.push(fileInfo);
                        appConfig.state.selectedFiles.push(fileData.path);
                    });
                    
                    this.updateDroppedFilesList();
                    this.updateAnalysisCount();
                    fileBrowser.updateSelectedCount();
                    
                    utils.showAlert(`✅ 已添加 ${selectedFiles.length} 個檔案`, 'success');
                }
                
                modalInstance.hide();
                modal.remove();
            });
            
            // 清理
            modal.on('hidden.bs.modal', () => {
                modal.remove();
            });
        }
    },
    
    // 更新拖曳檔案列表
    updateDroppedFilesList: function() {
        const container = $('#dropped-files-container');
        const listElement = $('#dropped-files-list');
        
        if (appConfig.state.droppedFiles.length === 0) {
            listElement.hide();
            return;
        }
        
        listElement.show();
        container.empty();
        
        appConfig.state.droppedFiles.forEach((fileInfo, index) => {
            const fileElement = $(`
                <div class="dropped-file-item animate__animated animate__fadeInUp" data-index="${index}">
                    <div class="d-flex align-items-center p-2 bg-light rounded mb-2">
                        <div class="file-icon me-3">
                            <i class="fas ${utils.getFileIcon(fileInfo.name)} fa-lg"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${fileInfo.name}</h6>
                            <small class="text-muted">
                                ${utils.formatFileSize(fileInfo.size)} • 
                                ${new Date(fileInfo.lastModified).toLocaleString()}
                                ${fileInfo.fromArchive ? ' • 來自壓縮檔' : ''}
                            </small>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="quickAnalysis.removeDroppedFile(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `);
            
            container.append(fileElement);
        });
        
        // 更新計數
        $('#dropped-files-count').text(appConfig.state.droppedFiles.length);
    },
    
    // 移除拖曳的檔案
    removeDroppedFile: function(index) {
        const removedFile = appConfig.state.droppedFiles[index];
        appConfig.state.selectedFiles = appConfig.state.selectedFiles.filter(f => f !== removedFile.virtualPath);
        
        appConfig.state.droppedFiles.splice(index, 1);
        this.updateDroppedFilesList();
        this.updateAnalysisCount();
        fileBrowser.updateSelectedCount();
        
        utils.showAlert('🗑️ 已移除檔案', 'info');
    },
    
    // 清空拖曳檔案
    clearDroppedFiles: function() {
        if (appConfig.state.droppedFiles.length === 0) {
            utils.showAlert('⚠️ 沒有檔案需要清空', 'warning');
            return;
        }
        
        if (!confirm('確定要清空所有拖曳的檔案嗎？')) {
            return;
        }
        
        appConfig.state.droppedFiles.forEach(fileInfo => {
            appConfig.state.selectedFiles = appConfig.state.selectedFiles.filter(f => f !== fileInfo.virtualPath);
        });
        
        appConfig.state.droppedFiles = [];
        this.updateDroppedFilesList();
        this.updateAnalysisCount();
        fileBrowser.updateSelectedCount();
        
        utils.showAlert('🗑️ 已清空拖曳檔案列表', 'info');
    },
    
    // 更新分析計數
    updateAnalysisCount: function() {
        const includeBrowser = $('#include-browser-files').is(':checked');
        const includeDropped = $('#include-dropped-files').is(':checked');
        
        const browserFiles = appConfig.state.selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        const browserCount = includeBrowser ? browserFiles.length : 0;
        const droppedCount = includeDropped ? appConfig.state.droppedFiles.length : 0;
        const totalCount = browserCount + droppedCount;
        
        $('#browser-files-count').text(browserCount);
        $('#dropped-files-count').text(droppedCount);
        $('#total-files-count').text(totalCount);
        
        this.updateAnalysisButton();
    },
    
    // 更新分析按鈕
    updateAnalysisButton: function() {
        const quickAnalyzeBtn = $('#quick-analyze-btn');
        const hasKeywords = Object.keys(appConfig.state.keywords).length > 0;
        
        const includeBrowser = $('#include-browser-files').is(':checked');
        const includeDropped = $('#include-dropped-files').is(':checked');
        const browserFiles = appConfig.state.selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        const totalCount = (includeBrowser ? browserFiles.length : 0) + 
                          (includeDropped ? appConfig.state.droppedFiles.length : 0);
        
        const hasFiles = totalCount > 0;
        
        quickAnalyzeBtn.prop('disabled', !hasKeywords || !hasFiles || analysisManager.isAnalysisRunning());
        
        if (analysisManager.isAnalysisRunning()) {
            quickAnalyzeBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>分析進行中');
        } else if (!hasKeywords) {
            quickAnalyzeBtn.html('<i class="fas fa-exclamation-triangle me-2"></i>請先上傳關鍵字');
        } else if (!hasFiles) {
            quickAnalyzeBtn.html('<i class="fas fa-folder-open me-2"></i>請選擇檔案');
        } else {
            quickAnalyzeBtn.html(`<i class="fas fa-rocket me-2"></i>分析 ${totalCount} 個檔案`);
        }
    },
    
    // 開始快速分析
    startQuickAnalysis: function() {
        console.log('⚡ 開始快速分析');
        
        const includeBrowser = $('#include-browser-files').is(':checked');
        const includeDropped = $('#include-dropped-files').is(':checked');
        
        let analysisFiles = [];
        
        if (includeBrowser) {
            const browserFiles = appConfig.state.selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
            analysisFiles = analysisFiles.concat(browserFiles);
        }
        
        if (includeDropped) {
            const droppedPaths = appConfig.state.droppedFiles.map(f => f.virtualPath);
            analysisFiles = analysisFiles.concat(droppedPaths);
        }
        
        if (analysisFiles.length === 0) {
            utils.showAlert('⚠️ 請選擇要分析的檔案', 'warning');
            return;
        }
        
        // 暫時替換選擇的檔案
        const originalSelectedFiles = appConfig.state.selectedFiles.slice();
        appConfig.state.selectedFiles = analysisFiles;
        
        // 開始分析
        analysisManager.startStreamAnalysis();
        
        // 恢復原始選擇
        setTimeout(() => {
            appConfig.state.selectedFiles = originalSelectedFiles;
        }, 1000);
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 檢視模式選項變更
        $('#include-browser-files, #include-dropped-files').on('change', () => {
            this.updateAnalysisCount();
        });
    }
};