// Enhanced Log 分析平台 v6 - 分析管理器
// static/js/managers/analysis-manager.js

window.analysisManager = {
    init: function() {
        console.log('📊 初始化分析管理器');
        
        // 初始化圖表
        this.initializeModuleChart();
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 開始流式分析
    startStreamAnalysis: function() {
        console.log('🚀 開始流式分析');
        
        // 檢查是否有選擇檔案
        if (appConfig.state.selectedFiles.length === 0) {
            utils.showAlert('⚠️ 請選擇要分析的檔案', 'warning');
            return;
        }
        
        // 檢查是否有關鍵字
        if (Object.keys(appConfig.state.keywords).length === 0) {
            utils.showAlert('⚠️ 請先上傳關鍵字清單', 'warning');
            return;
        }
        
        // 顯示結果區塊
        $('#results-block').show();
        
        // 確保統計區塊在結果區塊上方
        const statsBlock = $('#statistics-block');
        const resultsBlock = $('#results-block');
        resultsBlock.before(statsBlock);
        
        // 初始化分析界面
        this.initializeStreamingAnalysis();
        
        // 發送分析請求
        $.ajax({
            url: appConfig.api.analyzeStream,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                files: appConfig.state.selectedFiles
            }),
            success: (response) => {
                console.log('🎯 流式分析啟動:', response);
                if (response.success) {
                    appConfig.state.currentAnalysisId = response.analysis_id;
                    this.startEventSource(response.analysis_id);
                    utils.showAlert('🚀 分析已開始，結果將即時顯示！', 'success');
                    utils.playNotificationSound('start');
                    this.updateAnalysisButtonState('running');
                } else {
                    utils.showAlert(`❌ ${response.message}`, 'danger');
                    this.updateAnalysisButtonState('idle');
                }
            },
            error: (xhr, status, error) => {
                console.error('❌ 啟動分析失敗:', status, error);
                utils.showAlert('❌ 啟動分析失敗，請檢查網路連接', 'danger');
                this.updateAnalysisButtonState('idle');
            }
        });
    },
    
    // 停止流式分析
    stopStreamAnalysis: function() {
        if (!appConfig.state.currentAnalysisId) return;
        
        console.log('⏹️ 停止分析');
        
        this.updateAnalysisButtonState('stopping');
        
        // 關閉 EventSource
        if (appConfig.state.eventSource) {
            appConfig.state.eventSource.close();
            appConfig.state.eventSource = null;
        }
        
        // 可以發送停止請求到伺服器
        // $.post(`/api/analysis/${appConfig.state.currentAnalysisId}/stop`);
        
        appConfig.state.currentAnalysisId = null;
        this.updateAnalysisButtonState('idle');
        
        utils.showAlert('⏹️ 分析已停止', 'info');
    },
    
    // 初始化流式分析界面
    initializeStreamingAnalysis: function() {
        const statsContainer = $('#result-stats');
        const detailsContainer = $('#detailed-results');
        
        // 顯示統計圖表
        $('#statistics-block').show();
        
        // 初始化統計區域
        statsContainer.html(`
            <div class="col-md-2">
                <div class="card bg-primary text-white stats-card">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-file-alt me-2"></i>檔案</h5>
                        <h2 id="stat-files" class="counter-number">${appConfig.state.selectedFiles.length}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="card bg-success text-white stats-card">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-cube me-2"></i>模組</h5>
                        <h2 id="stat-modules" class="counter-number">0/${Object.keys(appConfig.state.keywords).length}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="card bg-info text-white stats-card">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-search me-2"></i>匹配</h5>
                        <h2 id="stat-matches" class="counter-number">0</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-white stats-card">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-cogs me-2"></i>進度</h5>
                        <div class="progress progress-modern mb-2">
                            <div class="progress-bar progress-bar-animated" id="progress-bar" style="width: 0%"></div>
                        </div>
                        <small id="progress-text" class="progress-text">準備中...</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-secondary text-white stats-card">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-clock me-2"></i>狀態</h5>
                        <div id="analysis-status-display">
                            <div class="d-flex align-items-center justify-content-center">
                                <div class="spinner-border spinner-border-sm me-2" role="status" id="status-spinner"></div>
                                <span id="current-module-display">初始化中...</span>
                            </div>
                            <button class="btn btn-danger btn-sm mt-2" id="stop-analysis-inline" onclick="analysisManager.stopStreamAnalysis()">
                                <i class="fas fa-stop me-1"></i>停止分析
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // 初始化結果區域
        detailsContainer.html(`
            <div id="stream-results" class="stream-results">
                <div class="analysis-starting animate__animated animate__fadeIn">
                    <div class="text-center py-4">
                        <div class="d-flex align-items-center justify-content-center mb-3">
                            <div class="spinner-border text-primary me-3" role="status"></div>
                            <h5 class="mb-0">正在啟動分析引擎...</h5>
                        </div>
                        <p class="text-muted">結果將在下方即時顯示，您可以繼續操作其他功能</p>
                    </div>
                </div>
            </div>
        `);
        
        // 重置模組結果
        appConfig.state.moduleResults = {};
        
        // 滾動到結果區域
        utils.scrollToElement('#results-block', 100);
        
        // 更新圖表
        this.updateChartSummary();
    },
    
    // 初始化圖表
    initializeModuleChart: function() {
        const ctx = document.getElementById('moduleChart');
        if (!ctx) return;
        
        appConfig.state.moduleChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '匹配數量',
                    data: [],
                    backgroundColor: appConfig.chart.colors.primary,
                    borderColor: appConfig.chart.colors.primaryBorder,
                    borderWidth: 2,
                    borderRadius: 5
                }]
            },
            options: appConfig.chart.options
        });
    },
    
    // 更新分析按鈕狀態
    updateAnalysisButtonState: function(state) {
        const analyzeBtn = $('#analyze-btn');
        const quickAnalyzeBtn = $('#quick-analyze-btn');
        
        switch (state) {
            case 'running':
                analyzeBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>分析進行中')
                         .removeClass('btn-danger')
                         .addClass('btn-warning')
                         .prop('disabled', false)
                         .attr('onclick', 'analysisManager.stopStreamAnalysis()');
                
                quickAnalyzeBtn.prop('disabled', true)
                              .html('<i class="fas fa-spinner fa-spin me-2"></i>分析進行中');
                break;
                
            case 'stopping':
                analyzeBtn.html('<i class="fas fa-circle-notch fa-spin me-2"></i>正在停止')
                         .addClass('btn-secondary')
                         .prop('disabled', true);
                
                quickAnalyzeBtn.prop('disabled', true);
                break;
                
            case 'idle':
            default:
                analyzeBtn.html('<i class="fas fa-stream me-2"></i>開始流式分析')
                         .removeClass('btn-warning btn-secondary')
                         .addClass('btn-danger')
                         .prop('disabled', appConfig.state.selectedFiles.length === 0 || Object.keys(appConfig.state.keywords).length === 0)
                         .attr('onclick', 'analysisManager.startStreamAnalysis()');
                
                // 更新快速分析按鈕
                quickAnalysis.updateAnalysisButton();
                break;
        }
    },
    
    // 啟動 EventSource
    startEventSource: function(analysisId) {
        console.log('🌊 啟動 EventSource:', analysisId);
        
        if (appConfig.state.eventSource) {
            appConfig.state.eventSource.close();
            appConfig.state.eventSource = null;
        }
        
        try {
            appConfig.state.eventSource = new EventSource(`${appConfig.api.analysisStream}${analysisId}`);
            
            appConfig.state.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setTimeout(() => {
                        this.handleStreamMessage(data);
                    }, 0);
                } catch (e) {
                    console.error('❌ 解析 SSE 訊息失敗:', e, event.data);
                }
            };
            
            appConfig.state.eventSource.onerror = (event) => {
                console.error('❌ EventSource 錯誤:', event);
                if (!appConfig.state.eventSource || appConfig.state.eventSource.readyState === EventSource.CLOSED) {
                    console.log('🔌 EventSource 連接已關閉');
                    appConfig.state.eventSource = null;
                    this.updateAnalysisButtonState('idle');
                }
            };
            
            appConfig.state.eventSource.onopen = (event) => {
                console.log('✅ EventSource 連接已建立');
            };
            
        } catch (e) {
            console.error('❌ 建立 EventSource 失敗:', e);
            utils.showAlert('❌ 建立即時連接失敗', 'danger');
            this.updateAnalysisButtonState('idle');
        }
    },
    
    // 處理流式訊息
    handleStreamMessage: function(data) {
        try {
            console.log('📩 收到流式訊息:', data.type);
            
            switch (data.type) {
                case 'heartbeat':
                    // 心跳訊息，保持連接
                    break;
                    
                case 'start':
                    this.updateProgressStatus('🚀 分析開始', '正在初始化...');
                    $('.analysis-starting').remove();
                    break;
                    
                case 'module_start':
                    this.updateProgressStatus(`🔍 分析模組: ${data.module}`, '準備搜尋關鍵字...');
                    $('#current-module-display').text(`正在分析: ${data.module}`);
                    break;
                    
                case 'file_start':
                    this.updateProgressStatus(
                        `📂 分析檔案: ${data.module}`, 
                        `正在處理: ${data.file.split('/').pop()}`
                    );
                    break;
                    
                case 'matches_found':
                    this.handleMatchesFound(data);
                    break;
                    
                case 'progress':
                    this.updateProgress(data.progress);
                    break;
                    
                case 'module_complete':
                    this.updateModuleComplete(data);
                    break;
                    
                case 'complete':
                    this.handleAnalysisComplete(data);
                    break;
                    
                case 'error':
                case 'timeout':
                    this.handleAnalysisError(data);
                    break;
                    
                default:
                    console.log('🤔 未知訊息類型:', data.type);
            }
        } catch (e) {
            console.error('❌ 處理流式訊息時發生錯誤:', e, data);
        }
    },
    
    // 處理找到的匹配
    handleMatchesFound: function(data) {
        try {
            console.log('🎯 發現匹配 - 模組:', data.module, '檔案:', data.file.split('/').pop(), '匹配數:', data.matches.length);
            
            // 初始化模組結果
            if (!appConfig.state.moduleResults[data.module]) {
                appConfig.state.moduleResults[data.module] = {
                    total_matches: 0,
                    files: {}
                };
            }
            
            // 儲存匹配結果
            if (!appConfig.state.moduleResults[data.module].files[data.file]) {
                appConfig.state.moduleResults[data.module].files[data.file] = [];
            }
            
            appConfig.state.moduleResults[data.module].files[data.file] = 
                appConfig.state.moduleResults[data.module].files[data.file].concat(data.matches);
            appConfig.state.moduleResults[data.module].total_matches = data.total_matches;
            
            // 更新統計
            this.updateStatsLightweight(data.total_matches);
            
            // 更新圖表
            this.updateModuleChart(data.module, data.total_matches);
            
            // 更新結果顯示
            this.updateStreamResults();
            
        } catch (e) {
            console.error('❌ 處理匹配結果時發生錯誤:', e);
        }
    },
    
    // 更新進度狀態
    updateProgressStatus: function(title, subtitle) {
        $('#progress-text').text(title);
        if (subtitle) {
            $('#current-module-display').text(subtitle);
        }
    },
    
    // 更新進度
    updateProgress: function(progress) {
        $('#progress-bar').css('width', progress + '%');
        $('#progress-text').text(`進度: ${progress}%`);
    },
    
    // 更新統計（輕量級）
    updateStatsLightweight: function(totalMatches) {
        $('#stat-matches').text(totalMatches);
        
        // 更新圖表摘要
        this.updateChartSummary();
    },
    
    // 更新圖表摘要
    updateChartSummary: function() {
        const totalModules = Object.keys(appConfig.state.keywords).length;
        const completedModules = Object.keys(appConfig.state.moduleResults).length;
        const totalMatches = Object.values(appConfig.state.moduleResults)
            .reduce((sum, module) => sum + module.total_matches, 0);
        
        $('#total-modules').text(totalModules);
        $('#stat-modules').text(`${completedModules}/${totalModules}`);
        $('#total-matches-chart').text(totalMatches);
        $('#total-files-chart').text(appConfig.state.selectedFiles.length);
    },
    
    // 更新模組圖表
    updateModuleChart: function(module, matches) {
        if (!appConfig.state.moduleChart) return;
        
        const chart = appConfig.state.moduleChart;
        const labels = chart.data.labels;
        const data = chart.data.datasets[0].data;
        
        const index = labels.indexOf(module);
        if (index >= 0) {
            data[index] = matches;
        } else {
            labels.push(module);
            data.push(matches);
        }
        
        chart.update('active');
    },
    
    // 更新流式結果
    updateStreamResults: function() {
        const container = $('#stream-results');
        let html = '';
        
        Object.entries(appConfig.state.moduleResults).forEach(([module, data]) => {
            if (data.total_matches > 0) {
                html += `
                    <div class="module-result animate__animated animate__fadeIn">
                        <h5>
                            <i class="fas fa-cube me-2"></i>${module}
                            <span class="badge bg-primary float-end">${data.total_matches} 個匹配</span>
                        </h5>
                        <div class="file-matches">
                `;
                
                Object.entries(data.files).forEach(([file, matches]) => {
                    const fileName = file.split('/').pop();
                    html += `
                        <div class="mb-3">
                            <h6>
                                <i class="fas fa-file-alt me-2"></i>${fileName}
                                <span class="badge bg-secondary ms-2">${matches.length} 個匹配</span>
                            </h6>
                    `;
                    
                    // 顯示前5個匹配
                    matches.slice(0, 5).forEach(match => {
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
                                </div>
                            </div>
                        `;
                    });
                    
                    if (matches.length > 5) {
                        html += `
                            <div class="text-muted small mt-2">
                                ... 還有 ${matches.length - 5} 個匹配
                                <a href="/file_viewer?path=${encodeURIComponent(file)}&line=${matches[0].line_number}" 
                                   target="_blank" class="ms-2">
                                   <i class="fas fa-external-link-alt"></i> 查看檔案
                                </a>
                            </div>
                        `;
                    }
                    
                    html += '</div>';
                });
                
                html += '</div></div>';
            }
        });
        
        if (html) {
            container.html(html);
        }
    },
    
    // 模組完成
    updateModuleComplete: function(data) {
        console.log(`✅ 模組 ${data.module} 分析完成，耗時: ${data.search_time.toFixed(2)}秒`);
        utils.playNotificationSound('success');
    },
    
    // 分析完成
    handleAnalysisComplete: function(data) {
        console.log('🎉 分析完成！總匹配數:', data.total_matches, '耗時:', data.total_time.toFixed(2), '秒');
        
        // 更新狀態
        this.updateAnalysisButtonState('idle');
        $('#status-spinner').hide();
        $('#current-module-display').text('分析完成！');
        $('#stop-analysis-inline').hide();
        
        // 關閉 EventSource
        if (appConfig.state.eventSource) {
            appConfig.state.eventSource.close();
            appConfig.state.eventSource = null;
        }
        
        // 播放完成音效
        utils.playNotificationSound('success');
        
        // 顯示完成通知
        utils.showAlert(`🎉 分析完成！共找到 ${data.total_matches} 個匹配，耗時 ${data.total_time.toFixed(2)} 秒`, 'success');
        utils.showNotification(`分析完成！共找到 ${data.total_matches} 個匹配`);
        
        // 啟用報告按鈕
        $('#report-btn').prop('disabled', false);
    },
    
    // 分析錯誤
    handleAnalysisError: function(data) {
        console.error('❌ 分析錯誤:', data.message);
        
        // 更新狀態
        this.updateAnalysisButtonState('idle');
        $('#status-spinner').hide();
        $('#current-module-display').text('分析錯誤');
        $('#stop-analysis-inline').hide();
        
        // 關閉 EventSource
        if (appConfig.state.eventSource) {
            appConfig.state.eventSource.close();
            appConfig.state.eventSource = null;
        }
        
        // 顯示錯誤訊息
        utils.showAlert(`❌ 分析錯誤: ${data.message}`, 'danger');
        utils.playNotificationSound('error');
    },
    
    // 檢查分析是否正在進行
    isAnalysisRunning: function() {
        return appConfig.state.currentAnalysisId !== null && appConfig.state.eventSource !== null;
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
        // Ctrl + Enter 開始分析
        $(document).on('keydown', function(e) {
            if (e.ctrlKey && e.which === 13) {
                e.preventDefault();
                if (!$('#analyze-btn').prop('disabled') && !analysisManager.isAnalysisRunning()) {
                    analysisManager.startStreamAnalysis();
                }
            }
            
            // Esc 停止分析
            if (e.which === 27 && analysisManager.isAnalysisRunning()) {
                e.preventDefault();
                if (confirm('確定要停止分析嗎？')) {
                    analysisManager.stopStreamAnalysis();
                }
            }
        });
    }
};