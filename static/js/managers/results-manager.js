// Enhanced Log 分析平台 v6 - 結果管理器
// static/js/managers/results-manager.js

window.resultsManager = {
    init: function() {
        console.log('📊 初始化結果管理器');
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 切換檢視模式
    toggleViewMode: function() {
        const currentMode = appConfig.state.currentViewMode;
        const newMode = currentMode === 'module' ? 'file' : 'module';
        
        appConfig.state.currentViewMode = newMode;
        
        // 更新按鈕文字
        const btn = $('#view-mode-btn');
        if (newMode === 'module') {
            btn.html('<i class="fas fa-exchange-alt me-1"></i>切換到檔案檢視');
        } else {
            btn.html('<i class="fas fa-exchange-alt me-1"></i>切換到模組檢視');
        }
        
        // 重新渲染結果
        this.renderResults();
        
        utils.showAlert(`已切換到${newMode === 'module' ? '模組' : '檔案'}檢視`, 'info', 2000);
    },
    
    // 渲染結果
    renderResults: function() {
        const container = $('#detailed-results');
        
        if (Object.keys(appConfig.state.moduleResults).length === 0) {
            container.html(`
                <div class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <p class="text-muted">暫無分析結果</p>
                </div>
            `);
            return;
        }
        
        if (appConfig.state.currentViewMode === 'module') {
            this.renderModuleView(container);
        } else {
            this.renderFileView(container);
        }
    },
    
    // 渲染模組檢視
    renderModuleView: function(container) {
        let html = '<div class="module-view">';
        
        Object.entries(appConfig.state.moduleResults).forEach(([module, data]) => {
            if (data.total_matches === 0) return;
            
            html += `
                <div class="module-result card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0 d-flex justify-content-between align-items-center">
                            <span>
                                <i class="fas fa-cube me-2"></i>${module}
                            </span>
                            <span class="badge bg-white text-primary">${data.total_matches} 個匹配</span>
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="file-matches">
            `;
            
            Object.entries(data.files).forEach(([file, matches]) => {
                const fileName = file.split('/').pop();
                const fileId = `file_${module}_${fileName}`.replace(/[^a-zA-Z0-9]/g, '_');
                
                html += `
                    <div class="file-section mb-3">
                        <h6 class="d-flex justify-content-between align-items-center">
                            <span>
                                <i class="fas fa-file-alt me-2"></i>${fileName}
                            </span>
                            <div>
                                <span class="badge bg-secondary me-2">${matches.length} 個匹配</span>
                                <button class="btn btn-sm btn-outline-primary" onclick="resultsManager.toggleFileDetails('${fileId}')">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </h6>
                        <div id="${fileId}" class="file-details mt-2" style="display: none;">
                `;
                
                // 顯示匹配詳情
                matches.forEach((match, index) => {
                    // 高亮關鍵字
                    const highlightedContent = this.highlightKeyword(match.content, match.keyword);
                    
                    html += `
                        <div class="match-item">
                            <div class="d-flex align-items-start">
                                <a href="/file_viewer?path=${encodeURIComponent(file)}&line=${match.line_number}&context=200" 
                                   class="line-number-link" target="_blank" title="查看檔案">
                                    行 ${match.line_number}:
                                </a>
                                <div class="flex-grow-1">
                                    <pre class="match-content mb-0">${highlightedContent}</pre>
                                </div>
                                <a href="/file_viewer?path=${encodeURIComponent(file)}&line=${match.line_number}" 
                                   target="_blank" class="btn btn-sm btn-outline-primary ms-2" title="在檔案檢視器中開啟">
                                   <i class="fas fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                    `;
                    
                    // 只顯示前10個匹配
                    if (index === 9 && matches.length > 10) {
                        html += `
                            <div class="text-center mt-3">
                                <button class="btn btn-sm btn-outline-primary" onclick="resultsManager.showAllMatches('${fileId}', '${module}', '${file}')">
                                    顯示全部 ${matches.length} 個匹配
                                </button>
                            </div>
                        `;
                        return false;
                    }
                });
                
                html += '</div></div>';
            });
            
            html += '</div></div></div>';
        });
        
        html += '</div>';
        container.html(html);
    },
    
    // 渲染檔案檢視
    renderFileView: function(container) {
        // 重組資料：按檔案分組
        const fileGroups = {};
        
        Object.entries(appConfig.state.moduleResults).forEach(([module, data]) => {
            Object.entries(data.files).forEach(([file, matches]) => {
                if (!fileGroups[file]) {
                    fileGroups[file] = {
                        modules: {},
                        total_matches: 0
                    };
                }
                
                fileGroups[file].modules[module] = matches;
                fileGroups[file].total_matches += matches.length;
            });
        });
        
        let html = '<div class="file-view">';
        
        Object.entries(fileGroups).forEach(([file, data]) => {
            const fileName = file.split('/').pop();
            
            html += `
                <div class="file-result card mb-3">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0 d-flex justify-content-between align-items-center">
                            <span>
                                <i class="fas fa-file-alt me-2"></i>${fileName}
                            </span>
                            <span class="badge bg-white text-info">${data.total_matches} 個匹配</span>
                        </h5>
                    </div>
                    <div class="card-body">
            `;
            
            Object.entries(data.modules).forEach(([module, matches]) => {
                const moduleId = `module_${fileName}_${module}`.replace(/[^a-zA-Z0-9]/g, '_');
                
                html += `
                    <div class="module-section mb-3">
                        <h6 class="d-flex justify-content-between align-items-center">
                            <span>
                                <i class="fas fa-cube me-2"></i>${module}
                            </span>
                            <div>
                                <span class="badge bg-secondary me-2">${matches.length} 個匹配</span>
                                <button class="btn btn-sm btn-outline-primary" onclick="resultsManager.toggleFileDetails('${moduleId}')">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </h6>
                        <div id="${moduleId}" class="module-details mt-2" style="display: none;">
                `;
                
                matches.forEach((match, index) => {
                    html += `
                        <div class="match-item">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <small class="text-muted">行 ${match.line_number}:</small>
                                    <pre class="mb-0"><code>${this.escapeHtml(match.content)}</code></pre>
                                </div>
                                <div class="ms-3">
                                    <span class="badge bg-info">${match.keyword}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    if (index === 9 && matches.length > 10) {
                        html += `
                            <div class="text-center mt-3">
                                <button class="btn btn-sm btn-outline-primary" onclick="resultsManager.showAllMatches('${moduleId}', '${module}', '${file}')">
                                    顯示全部 ${matches.length} 個匹配
                                </button>
                            </div>
                        `;
                        return false;
                    }
                });
                
                html += '</div></div>';
            });
            
            html += `
                        <div class="mt-3">
                            <a href="/file_viewer?path=${encodeURIComponent(file)}" target="_blank" class="btn btn-sm btn-primary">
                                <i class="fas fa-external-link-alt me-2"></i>查看完整檔案
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.html(html);
    },
    
    // 切換檔案詳情顯示
    toggleFileDetails: function(elementId) {
        const element = $(`#${elementId}`);
        const button = element.prev().find('button');
        
        if (element.is(':visible')) {
            element.slideUp();
            button.html('<i class="fas fa-chevron-down"></i>');
        } else {
            element.slideDown();
            button.html('<i class="fas fa-chevron-up"></i>');
        }
    },
    
    // 顯示所有匹配
    showAllMatches: function(elementId, module, file) {
        const matches = appConfig.state.moduleResults[module].files[file];
        const fileName = file.split('/').pop();
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-search me-2"></i>所有匹配 - ${fileName} (${module})
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                            <div class="matches-list">
                                ${matches.map((match, index) => `
                                    <div class="match-item mb-3 p-3 bg-light rounded">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div class="flex-grow-1">
                                                <strong>第 ${index + 1} 個匹配 - 行 ${match.line_number}:</strong>
                                                <pre class="mt-2 mb-0"><code>${this.escapeHtml(match.content)}</code></pre>
                                            </div>
                                            <div class="ms-3">
                                                <span class="badge bg-info">${match.keyword}</span>
                                                <a href="/file_viewer?path=${encodeURIComponent(file)}&line=${match.line_number}" 
                                                   target="_blank" class="btn btn-sm btn-outline-primary ms-2">
                                                   <i class="fas fa-external-link-alt"></i>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <a href="/file_viewer?path=${encodeURIComponent(file)}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-file-alt me-2"></i>查看完整檔案
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        modal.on('hidden.bs.modal', () => {
            modal.remove();
        });
    },
    
    // 匯出結果
    exportResults: function() {
        if (Object.keys(appConfig.state.moduleResults).length === 0) {
            utils.showAlert('⚠️ 沒有結果可以匯出', 'warning');
            return;
        }
        
        // 準備匯出資料
        const exportData = {
            version: appConfig.version,
            analysis_id: appConfig.state.currentAnalysisId,
            timestamp: new Date().toISOString(),
            summary: {
                total_files: appConfig.state.selectedFiles.length,
                total_modules: Object.keys(appConfig.state.keywords).length,
                total_matches: Object.values(appConfig.state.moduleResults)
                    .reduce((sum, module) => sum + module.total_matches, 0)
            },
            keywords: appConfig.state.keywords,
            results: appConfig.state.moduleResults
        };
        
        // 轉換為 JSON
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 下載檔案
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_results_${appConfig.state.currentAnalysisId || Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        utils.showAlert('✅ 結果已匯出', 'success');
    },
    
    // 生成報告
    generateReport: function() {
        if (!appConfig.state.currentAnalysisId) {
            utils.showAlert('⚠️ 沒有可用的分析結果', 'warning');
            return;
        }
        
        // 開啟報告頁面
        window.open(`/analysis_report/${appConfig.state.currentAnalysisId}`, '_blank');
    },
    
    // 清空結果
    clearResults: function() {
        if (confirm('確定要清空所有分析結果嗎？')) {
            appConfig.state.moduleResults = {};
            appConfig.state.currentAnalysisId = null;
            
            $('#results-block').hide();
            
            utils.showAlert('✅ 已清空分析結果', 'success');
        }
    },
    
    // 高亮關鍵字
    highlightKeyword: function(text, keyword) {
        const escapedText = this.escapeHtml(text);
        const escapedKeyword = this.escapeHtml(keyword);
        
        // 使用正則表達式進行不區分大小寫的替換
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        return escapedText.replace(regex, '<span class="highlight">$1</span>');
    },
    
    // HTML 轉義
    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 結果區塊展開/收合
        $(document).on('click', '.module-result .card-header, .file-result .card-header', function(e) {
            if ($(e.target).closest('button').length === 0) {
                const body = $(this).next('.card-body');
                body.slideToggle();
            }
        });
    },
    
    // 獲取結果統計
    getResultsStats: function() {
        const stats = {
            totalModules: Object.keys(appConfig.state.moduleResults).length,
            totalMatches: 0,
            fileCount: new Set(),
            keywordCount: new Set()
        };
        
        Object.values(appConfig.state.moduleResults).forEach(module => {
            stats.totalMatches += module.total_matches;
            
            Object.entries(module.files).forEach(([file, matches]) => {
                stats.fileCount.add(file);
                
                matches.forEach(match => {
                    stats.keywordCount.add(match.keyword);
                });
            });
        });
        
        return {
            ...stats,
            fileCount: stats.fileCount.size,
            keywordCount: stats.keywordCount.size
        };
    }
};