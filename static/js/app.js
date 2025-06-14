// 全域變數
let currentPath = '/home/vince_lin/Rust_Project';
let selectedFiles = [];
let keywords = {};
let allSelectMode = false;
let currentAnalysisId = null;
let analysisPollingInterval = null;
let audioContext = null;

// 頁面載入時初始化
$(document).ready(function() {
    console.log('頁面載入完成，開始初始化...');
    
    // 載入樣式
    addCustomStyles();
    
    // 初始化應用
    initializeApp();
    
    // 設置事件監聽器
    setupEventListeners();
    
    // 載入目錄
    loadDirectory(currentPath);
    
    // 為分析按鈕添加樣式
    $('#analyze-btn').addClass('btn-gradient-primary');
    
    // 添加鍵盤快捷鍵
    setupKeyboardShortcuts();
    
    console.log('初始化完成');
});

function initializeApp() {
    console.log('初始化應用...');
    
    // 初始化音頻上下文
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('音頻上下文初始化失敗，音效將不可用');
    }
    
    // 載入已有的關鍵字
    $.get('/api/keywords')
        .done(function(data) {
            console.log('載入關鍵字:', data);
            if (Object.keys(data).length > 0) {
                keywords = data;
                updateKeywordPreview();
            }
        })
        .fail(function() {
            console.log('載入關鍵字失敗');
        });
}

function setupEventListeners() {
    console.log('設置事件監聽器...');
    
    // 檔案上傳
    $('#keyword-file').on('change', function() {
        const file = this.files[0];
        if (file) {
            console.log('選擇檔案:', file.name);
            uploadKeywords(file);
        }
    });
    
    // 拖拽上傳
    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('dragover');
        });
        
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
        });
        
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadKeywords(files[0]);
            }
        });
    }
    
    // 路徑輸入框 Enter 鍵
    $('#path-input').on('keypress', function(e) {
        if (e.which === 13) {
            navigateToPath();
        }
    });
    
    console.log('事件監聽器設置完成');
}

function setupKeyboardShortcuts() {
    // Ctrl + Enter 開始分析
    $(document).keydown(function(e) {
        if (e.ctrlKey && e.which === 13) {
            e.preventDefault();
            if (!$('#analyze-btn').prop('disabled')) {
                startAnalysis();
            }
        }
        
        // Esc 停止分析
        if (e.which === 27 && currentAnalysisId) {
            e.preventDefault();
            if (confirm('確定要停止分析嗎？')) {
                stopAnalysis();
            }
        }
    });
}

function uploadKeywords(file) {
    if (!file) {
        console.log('沒有選擇檔案');
        return;
    }
    
    console.log('上傳關鍵字檔案:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    showAlert('上傳中...', 'info');
    
    $.ajax({
        url: '/api/upload_keywords',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('上傳回應:', response);
            if (response.success) {
                keywords = response.keywords;
                updateKeywordPreview();
                showAlert(response.message, 'success');
                playNotificationSound('success');
            } else {
                showAlert(response.message, 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('上傳失敗:', status, error);
            showAlert('上傳失敗', 'danger');
        }
    });
}

function updateKeywordPreview() {
    const preview = $('#keyword-preview');
    const modules = $('#keyword-modules');
    
    if (Object.keys(keywords).length === 0) {
        preview.hide();
        return;
    }
    
    modules.empty();
    for (const [module, keywordList] of Object.entries(keywords)) {
        const moduleElement = $(`
            <div class="keyword-module animate__animated animate__fadeIn">
                <strong>${module}:</strong> ${keywordList.join(', ')}
            </div>
        `);
        modules.append(moduleElement);
    }
    
    preview.show();
    console.log('關鍵字預覽已更新');
}

function loadDirectory(path) {
    console.log('載入目錄:', path);
    
    $('#file-list').html(`
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">載入中...</span>
            </div>
            <p class="mt-3 text-muted">載入檔案列表中...</p>
        </div>
    `);
    
    $.get('/api/browse', { path: path })
        .done(function(response) {
            console.log('目錄載入回應:', response);
            
            if (response.error) {
                $('#file-list').html(`
                    <div class="text-center py-5">
                        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                        <p class="text-muted">${response.error}</p>
                        <button class="btn btn-primary" onclick="loadDirectory('${currentPath}')">重試</button>
                    </div>
                `);
                return;
            }
            
            currentPath = response.current_path;
            $('#path-input').val(currentPath);
            updateBreadcrumb();
            renderFileList(response.items);
        })
        .fail(function(xhr, status, error) {
            console.error('載入目錄失敗:', status, error);
            $('#file-list').html(`
                <div class="text-center py-5">
                    <i class="fas fa-wifi fa-3x text-danger mb-3"></i>
                    <p class="text-muted">載入失敗，請檢查網路連接</p>
                    <button class="btn btn-primary" onclick="loadDirectory('${currentPath}')">重試</button>
                </div>
            `);
        });
}

function renderFileList(items) {
    console.log('渲染檔案列表:', items.length, '個項目');
    
    const fileList = $('#file-list');
    fileList.empty();
    
    if (items.length === 0) {
        fileList.html(`
            <div class="text-center py-5">
                <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                <p class="text-muted">此目錄為空</p>
            </div>
        `);
        return;
    }
    
    items.forEach(function(item, index) {
        const isSelected = selectedFiles.includes(item.path);
        
        const fileItem = $(`
            <div class="file-item ${isSelected ? 'selected' : ''}" data-path="${item.path}" data-type="${item.type}">
                <div class="d-flex align-items-center">
                    ${item.type === 'file' && !item.is_parent ? 
                        `<input type="checkbox" class="form-check-input me-3" ${isSelected ? 'checked' : ''}>` : 
                        '<div class="me-3" style="width: 16px;"></div>'
                    }
                    <div class="file-icon ${item.is_parent ? 'parent' : item.type === 'directory' ? 'directory' : 'log-file'}">
                        <i class="fas ${item.is_parent ? 'fa-arrow-left' : item.type === 'directory' ? 'fa-folder' : 'fa-file-alt'}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <small class="text-muted">
                            ${item.size ? item.size + ' • ' : ''}${item.modified}
                        </small>
                    </div>
                </div>
            </div>
        `);
        
        // 點擊事件
        fileItem.on('click', function(e) {
            console.log('點擊項目:', item.name, item.type);
            
            if (item.type === 'directory') {
                loadDirectory(item.path);
            } else if (item.type === 'file' && !item.is_parent) {
                if (e.target.type !== 'checkbox') {
                    const checkbox = $(this).find('input[type="checkbox"]');
                    checkbox.prop('checked', !checkbox.prop('checked'));
                    checkbox.trigger('change');
                }
            }
        });
        
        // 檔案選擇事件
        const checkbox = fileItem.find('input[type="checkbox"]');
        checkbox.on('change', function(e) {
            e.stopPropagation();
            
            const path = item.path;
            const isChecked = $(this).is(':checked');
            
            console.log('檔案選擇狀態改變:', path, isChecked);
            
            if (isChecked) {
                if (!selectedFiles.includes(path)) {
                    selectedFiles.push(path);
                }
                fileItem.addClass('selected');
            } else {
                selectedFiles = selectedFiles.filter(f => f !== path);
                fileItem.removeClass('selected');
            }
            
            updateSelectedCount();
        });
        
        fileList.append(fileItem);
    });
    
    console.log('檔案列表渲染完成');
}

function updateBreadcrumb() {
    const breadcrumb = $('#breadcrumb');
    const pathParts = currentPath.split('/').filter(part => part);
    
    breadcrumb.empty();
    
    // 根目錄
    const rootItem = $(`<li class="breadcrumb-item"><a href="#" onclick="loadDirectory('/')">根目錄</a></li>`);
    breadcrumb.append(rootItem);
    
    // 路徑部分
    let buildPath = '';
    pathParts.forEach((part, index) => {
        buildPath += '/' + part;
        const isLast = index === pathParts.length - 1;
        
        if (isLast) {
            breadcrumb.append(`<li class="breadcrumb-item active">${part}</li>`);
        } else {
            const pathToNavigate = buildPath;
            breadcrumb.append(`<li class="breadcrumb-item"><a href="#" onclick="loadDirectory('${pathToNavigate}')">${part}</a></li>`);
        }
    });
    
    console.log('面包屑導航已更新:', currentPath);
}

function navigateToPath() {
    const path = $('#path-input').val().trim();
    if (path) {
        console.log('導航到路徑:', path);
        loadDirectory(path);
    }
}

function refreshBrowser() {
    console.log('刷新瀏覽器');
    loadDirectory(currentPath);
}

function toggleSelectAll() {
    allSelectMode = !allSelectMode;
    console.log('切換全選模式:', allSelectMode);
    
    $('.file-item[data-type="file"]').each(function() {
        const checkbox = $(this).find('input[type="checkbox"]');
        const path = $(this).data('path');
        
        if (allSelectMode) {
            checkbox.prop('checked', true);
            $(this).addClass('selected');
            if (!selectedFiles.includes(path)) {
                selectedFiles.push(path);
            }
        } else {
            checkbox.prop('checked', false);
            $(this).removeClass('selected');
            selectedFiles = selectedFiles.filter(f => f !== path);
        }
    });
    
    updateSelectedCount();
    
    // 更新按鈕文字
    const btn = $('button[onclick="toggleSelectAll()"]');
    if (allSelectMode) {
        btn.html('<i class="fas fa-times me-1"></i>取消全選');
    } else {
        btn.html('<i class="fas fa-check-square me-1"></i>全選');
    }
}

function updateSelectedCount() {
    $('#selected-count').text(selectedFiles.length);
    const analyzeBtn = $('#analyze-btn');
    
    if (selectedFiles.length > 0 && Object.keys(keywords).length > 0) {
        analyzeBtn.prop('disabled', false);
    } else {
        analyzeBtn.prop('disabled', true);
    }
    
    console.log('已選擇檔案數量:', selectedFiles.length);
}

function startAnalysis() {
    console.log('開始分析');
    
    if (selectedFiles.length === 0) {
        showAlert('請選擇要分析的檔案', 'warning');
        return;
    }
    
    if (Object.keys(keywords).length === 0) {
        showAlert('請先上傳關鍵字清單', 'warning');
        return;
    }
    
    // 顯示載入狀態
    const analyzeBtn = $('#analyze-btn');
    const originalText = analyzeBtn.html();
    analyzeBtn.html('<i class="fas fa-rocket me-2"></i>啟動分析...').prop('disabled', true);
    
    showAlert('正在啟動分析，準備即時顯示結果...', 'info');
    
    // 初始化分析顯示區域
    initializeAnalysisDisplay();
    
    // 嘗試非同步分析，如果失敗則使用同步分析
    $.ajax({
        url: '/api/analyze_stream',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            files: selectedFiles
        }),
        success: function(response) {
            console.log('非同步分析啟動:', response);
            if (response.success) {
                currentAnalysisId = response.analysis_id;
                analyzeBtn.html('<i class="fas fa-pause me-2"></i>分析中...').removeClass('btn-gradient-primary').addClass('btn-gradient-warning');
                
                // 添加停止按鈕
                analyzeBtn.after(`
                    <button id="stop-analysis-btn" class="btn btn-outline-danger btn-sm ms-2" onclick="stopAnalysis()" title="停止分析 (ESC)">
                        <i class="fas fa-stop me-1"></i>停止
                    </button>
                `);
                
                showAlert('🚀 分析已開始，結果將即時顯示！', 'success');
                playNotificationSound('start');
                
                // 開始輪詢分析狀態
                startPollingAnalysisStatus();
            } else {
                showAlert(response.message, 'danger');
                analyzeBtn.html(originalText).prop('disabled', false);
            }
        },
        error: function(xhr) {
            console.log('非同步分析不可用，回退到同步分析');
            if (xhr.status === 404) {
                showAlert('使用同步分析模式...', 'info');
                startSyncAnalysis();
            } else {
                showAlert('啟動分析失敗，請檢查網路連接', 'danger');
                analyzeBtn.html(originalText).prop('disabled', false);
            }
        }
    });
}

function initializeAnalysisDisplay() {
    const resultsContainer = $('#analysis-results');
    const statsContainer = $('#result-stats');
    const detailsContainer = $('#detailed-results');
    
    // 顯示分析區域
    resultsContainer.show();
    
    // 初始化統計區域
    statsContainer.html(`
        <div class="col-md-3">
            <div class="card bg-primary text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-file-alt me-2"></i>分析檔案</h5>
                    <h2 id="stat-files" class="counter-number">${selectedFiles.length}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-success text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-cube me-2"></i>完成模組</h5>
                    <h2 id="stat-modules" class="counter-number">0/${Object.keys(keywords).length}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-info text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-search me-2"></i>找到匹配</h5>
                    <h2 id="stat-matches" class="counter-number">0</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-warning text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-cogs me-2"></i>分析進度</h5>
                    <div class="progress progress-modern mb-2">
                        <div class="progress-bar progress-bar-animated" id="progress-bar" style="width: 0%"></div>
                    </div>
                    <small id="progress-text" class="progress-text">準備中...</small>
                </div>
            </div>
        </div>
    `);
    
    // 初始化詳細結果區域
    detailsContainer.html(`
        <div class="analysis-status mb-4 animate__animated animate__fadeInDown">
            <div class="status-header">
                <h5><i class="fas fa-info-circle me-2"></i>分析狀態</h5>
            </div>
            <div class="alert alert-info status-alert">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-3 status-spinner" role="status"></div>
                    <div class="flex-grow-1">
                        <div id="current-status" class="status-text">正在準備分析...</div>
                        <small class="text-muted" id="current-detail">正在初始化 fastgrep 搜尋程序</small>
                    </div>
                    <div class="status-time">
                        <i class="fas fa-clock me-1"></i>
                        <span id="elapsed-time">00:00</span>
                    </div>
                </div>
            </div>
        </div>
        <div id="live-results" class="live-results">
            <!-- 即時結果將在這裡顯示 -->
        </div>
    `);
    
    // 滾動到結果區域
    $('html, body').animate({
        scrollTop: resultsContainer.offset().top - 100
    }, 500);
    
    // 開始計時器
    startElapsedTimer();
}

function startElapsedTimer() {
    const startTime = Date.now();
    
    const timer = setInterval(function() {
        if (!currentAnalysisId) {
            clearInterval(timer);
            return;
        }
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        $('#elapsed-time').text(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
}

function startPollingAnalysisStatus() {
    if (!currentAnalysisId) return;
    
    console.log('開始輪詢分析狀態:', currentAnalysisId);
    
    // 每 800ms 輪詢一次，讓更新更流暢
    analysisPollingInterval = setInterval(function() {
        pollAnalysisStatus();
    }, 800);
    
    // 立即執行一次
    pollAnalysisStatus();
}

function pollAnalysisStatus() {
    if (!currentAnalysisId) {
        stopPollingAnalysisStatus();
        return;
    }
    
    $.get(`/api/analysis_status/${currentAnalysisId}`)
        .done(function(status) {
            updateAnalysisDisplay(status);
            
            if (status.status === 'completed') {
                stopPollingAnalysisStatus();
                onAnalysisComplete(status);
            } else if (status.status === 'error') {
                stopPollingAnalysisStatus();
                onAnalysisError(status);
            }
        })
        .fail(function() {
            console.error('無法獲取分析狀態');
            stopPollingAnalysisStatus();
            showAlert('分析狀態查詢失敗', 'danger');
        });
}

function stopPollingAnalysisStatus() {
    if (analysisPollingInterval) {
        clearInterval(analysisPollingInterval);
        analysisPollingInterval = null;
        console.log('停止輪詢分析狀態');
    }
}

function updateAnalysisDisplay(status) {
    // 更新進度條
    const progressBar = $('#progress-bar');
    const progressText = $('#progress-text');
    const currentProgress = parseInt(progressBar.css('width')) || 0;
    const newProgress = status.progress || 0;
    
    // 平滑進度條動畫
    progressBar.animate({
        width: newProgress + '%'
    }, 600, 'easeOutQuart');
    
    progressText.text(`${newProgress}% 完成`);
    
    // 更新統計 - 使用動畫計數
    animateNumber('#stat-modules', `${Object.keys(status.results || {}).length}/${status.total_modules || 0}`);
    
    // 計算總匹配數
    let totalMatches = 0;
    if (status.results) {
        Object.values(status.results).forEach(module => {
            totalMatches += module.total_matches || 0;
        });
    }
    animateNumber('#stat-matches', totalMatches);
    
    // 更新狀態訊息
    const currentStatus = $('#current-status');
    const currentDetail = $('#current-detail');
    
    if (status.status === 'running') {
        currentStatus.html(`<i class="fas fa-search me-2"></i>正在分析：<strong>${status.current_module || '準備中'}</strong>`);
        currentDetail.text(`當前檔案：${status.current_file || '準備中'}`);
    } else if (status.status === 'completed') {
        currentStatus.html(`<i class="fas fa-check-circle me-2 text-success"></i>分析完成！`);
        currentDetail.text(`總共耗時：${status.total_time?.toFixed(2) || 0} 秒`);
    } else if (status.status === 'error') {
        currentStatus.html(`<i class="fas fa-exclamation-triangle me-2 text-danger"></i>分析發生錯誤`);
        currentDetail.text(status.error || '未知錯誤');
    }
    
    // 即時更新結果
    updateLiveResults(status.results || {});
}

function animateNumber(selector, newValue) {
    const element = $(selector);
    const isNumeric = !isNaN(newValue);
    
    if (isNumeric) {
        const oldValue = parseInt(element.text()) || 0;
        const targetValue = parseInt(newValue);
        
        if (targetValue > oldValue) {
            // 添加脈衝動畫
            element.addClass('number-pulse');
            
            // 數字計數動畫
            $({ counter: oldValue }).animate({ counter: targetValue }, {
                duration: 800,
                easing: 'easeOutQuart',
                step: function() {
                    element.text(Math.ceil(this.counter));
                },
                complete: function() {
                    element.text(targetValue);
                    setTimeout(() => {
                        element.removeClass('number-pulse');
                    }, 500);
                }
            });
        }
    } else {
        element.text(newValue);
    }
}

function updateLiveResults(results) {
    const liveResultsContainer = $('#live-results');
    
    // 為每個有結果的模組創建/更新顯示
    Object.entries(results).forEach(([module, data]) => {
        if (data.total_matches === 0) return;
        
        const moduleId = module.replace(/\s+/g, '-');
        let moduleElement = $(`#live-module-${moduleId}`);
        
        if (moduleElement.length === 0) {
            // 創建新的模組元素
            moduleElement = createLiveModuleElement(module, moduleId);
            liveResultsContainer.append(moduleElement);
            
            // 添加出現動畫
            moduleElement.addClass('animate__animated animate__fadeInUp');
            
            // 播放新發現音效
            playNotificationSound('discovery');
        }
        
        // 更新模組內容
        updateModuleElement(moduleElement, module, data);
    });
}

function createLiveModuleElement(module, moduleId) {
    return $(`
        <div class="result-module live-module" id="live-module-${moduleId}">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h4><i class="fas fa-cube me-2"></i>${module}</h4>
                    <p class="mb-3" id="module-info-${moduleId}">
                        <i class="fas fa-search me-1"></i>找到 <span class="match-count">0</span> 次匹配
                        <span class="ms-3 analysis-status-text">
                            <i class="fas fa-clock me-1"></i>分析中...
                        </span>
                    </p>
                </div>
                <div class="module-controls">
                    <span class="badge bg-success module-status" id="module-status-${moduleId}">
                        <i class="fas fa-spinner fa-spin me-1"></i>分析中
                    </span>
                    <button class="btn btn-outline-light btn-sm ms-2" onclick="scrollToTop()" title="回到頂部">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                </div>
            </div>
            <div class="result-files" id="module-files-${moduleId}">
                <!-- 檔案結果將在這裡顯示 -->
            </div>
        </div>
    `);
}

function updateModuleElement(moduleElement, module, data) {
    const moduleId = module.replace(/\s+/g, '-');
    
    // 更新匹配數量 - 使用動畫
    const oldCount = parseInt(moduleElement.find('.match-count').text()) || 0;
    const newCount = data.total_matches;
    
    if (newCount > oldCount) {
        // 有新的匹配，播放音效
        if (newCount > 0 && oldCount === 0) {
            playNotificationSound('match');
        }
        animateNumber(moduleElement.find('.match-count'), newCount);
    }
    
    // 更新狀態資訊
    const moduleInfo = $(`#module-info-${moduleId}`);
    let infoHtml = `<i class="fas fa-search me-1"></i>找到 <span class="match-count">${data.total_matches}</span> 次匹配`;
    
    if (data.keywords_found && data.keywords_found.length > 0) {
        infoHtml += `<span class="ms-3"><i class="fas fa-tags me-1"></i>關鍵字: ${data.keywords_found.join(', ')}</span>`;
    }
    
    if (data.search_time) {
        infoHtml += `<span class="ms-3 analysis-status-text">
            <i class="fas fa-check-circle me-1 text-success"></i>完成 (${data.search_time.toFixed(2)}秒)
        </span>`;
    } else {
        infoHtml += `<span class="ms-3 analysis-status-text">
            <i class="fas fa-clock me-1"></i>分析中...
        </span>`;
    }
    
    moduleInfo.html(infoHtml);
    
    // 更新狀態標籤
    const statusBadge = $(`#module-status-${moduleId}`);
    if (data.search_time) {
        statusBadge.html('<i class="fas fa-check me-1"></i>完成');
        statusBadge.removeClass('bg-success').addClass('bg-primary');
    }
    
    // 更新檔案結果
    const filesContainer = $(`#module-files-${moduleId}`);
    
    // 檢查是否有新檔案
    const existingFiles = new Set();
    filesContainer.find('.result-file').each(function() {
        const filename = $(this).find('small.text-muted').text();
        existingFiles.add(filename);
    });
    
    Object.entries(data.files || {}).forEach(([filename, matches]) => {
        if (!existingFiles.has(filename)) {
            // 新檔案，創建並添加動畫
            const fileElement = createLiveFileElement(filename, matches, module);
            filesContainer.append(fileElement);
            fileElement.addClass('animate__animated animate__fadeInLeft');
        } else {
            // 更新現有檔案
            updateExistingFileElement(filesContainer, filename, matches);
        }
    });
}

function createLiveFileElement(filename, matches, module) {
    const fileDiv = $(`
        <div class="result-file live-file">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="flex-grow-1">
                    <h6 class="mb-1"><i class="fas fa-file me-2"></i>${filename.split('/').pop()}</h6>
                    <small class="text-muted">${filename}</small>
                    <span class="badge bg-light text-dark ms-2 match-badge">${matches.length} 條匹配</span>
                </div>
                <button class="btn btn-outline-light btn-sm" onclick="scrollToModule('${module}')" title="回到模組頂部">
                    <i class="fas fa-arrow-up"></i>
                </button>
            </div>
            <div class="result-lines"></div>
        </div>
    `);
    
    const linesDiv = fileDiv.find('.result-lines');
    
    matches.forEach((match, index) => {
        // 高亮關鍵字
        const highlightedContent = highlightKeyword(match.content, match.keyword);
        
        const lineDiv = $(`
            <div class="result-line animate__animated animate__fadeIn" style="animation-delay: ${index * 0.1}s">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <small class="text-muted mb-1">
                            <i class="fas fa-map-marker-alt me-1"></i>第 ${match.line_number} 行 
                            <span class="keyword-tag">[${match.keyword}]</span>
                        </small>
                        <div class="line-content">${highlightedContent}</div>
                    </div>
                </div>
            </div>
        `);
        
        linesDiv.append(lineDiv);
    });
    
    return fileDiv;
}

function updateExistingFileElement(container, filename, matches) {
    container.find('.result-file').each(function() {
        const $this = $(this);
        const existingFilename = $this.find('small.text-muted').text();
        
        if (existingFilename === filename) {
            // 更新匹配數量標籤
            const badge = $this.find('.match-badge');
            const oldCount = parseInt(badge.text().match(/\d+/)[0]) || 0;
            const newCount = matches.length;
            
            if (newCount > oldCount) {
                badge.text(`${newCount} 條匹配`);
                badge.addClass('animate__animated animate__pulse');
                
                // 添加新的匹配行
                const linesDiv = $this.find('.result-lines');
                const existingLines = linesDiv.find('.result-line').length;
                
                for (let i = existingLines; i < matches.length; i++) {
                    const match = matches[i];
                    const highlightedContent = highlightKeyword(match.content, match.keyword);
                    
                    const lineDiv = $(`
                        <div class="result-line animate__animated animate__fadeIn" style="animation-delay: ${(i - existingLines) * 0.1}s">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <small class="text-muted mb-1">
                                        <i class="fas fa-map-marker-alt me-1"></i>第 ${match.line_number} 行 
                                        <span class="keyword-tag">[${match.keyword}]</span>
                                    </small>
                                    <div class="line-content">${highlightedContent}</div>
                                </div>
                            </div>
                        </div>
                    `);
                    
                    linesDiv.append(lineDiv);
                }
                
                setTimeout(() => {
                    badge.removeClass('animate__animated animate__pulse');
                }, 1000);
            }
            return false; // 跳出 each 迴圈
        }
    });
}

function onAnalysisComplete(status) {
    console.log('分析完成:', status);
    
    const analyzeBtn = $('#analyze-btn');
    const stopBtn = $('#stop-analysis-btn');
    
    // 更新按鈕狀態
    analyzeBtn.html('<i class="fas fa-check-circle me-2"></i>分析完成')
             .removeClass('btn-gradient-warning')
             .addClass('btn-gradient-success')
             .prop('disabled', false);
    
    // 移除停止按鈕
    stopBtn.remove();
    
    // 更新狀態區域
    $('.analysis-status .alert')
        .removeClass('alert-info')
        .addClass('alert-success');
    $('.status-spinner').replaceWith('<i class="fas fa-check-circle text-success"></i>');
    
    // 添加快速導航
    addNavigationToCompletedResults(status.results);
    
    // 播放完成音效
    playNotificationSound('complete');
    
    // 顯示完成訊息
    showAlert(`🎉 分析完成！總共找到 ${status.total_matches || 0} 次匹配，耗時 ${status.total_time?.toFixed(2) || 0} 秒`, 'success');
    
    // 5秒後恢復按鈕
    setTimeout(() => {
        analyzeBtn.html('<i class="fas fa-search me-2"></i>開始分析')
                  .removeClass('btn-gradient-success')
                  .addClass('btn-gradient-primary');
        
        // 清理分析資料
        cleanupAnalysis();
    }, 5000);
}

function onAnalysisError(status) {
    console.error('分析錯誤:', status);
    
    const analyzeBtn = $('#analyze-btn');
    const stopBtn = $('#stop-analysis-btn');
    
    // 更新按鈕狀態
    analyzeBtn.html('<i class="fas fa-exclamation-triangle me-2"></i>分析失敗')
             .removeClass('btn-gradient-warning')
             .addClass('btn-gradient-danger')
             .prop('disabled', false);
    
    // 移除停止按鈕
    stopBtn.remove();
    
    // 更新狀態區域
    $('.analysis-status .alert')
        .removeClass('alert-info')
        .addClass('alert-danger');
    $('.status-spinner').replaceWith('<i class="fas fa-exclamation-triangle text-danger"></i>');
    
    // 顯示錯誤訊息
    showAlert('❌ 分析過程中發生錯誤：' + (status.error || '未知錯誤'), 'danger');
    
    // 3秒後恢復按鈕
    setTimeout(() => {
        analyzeBtn.html('<i class="fas fa-search me-2"></i>開始分析')
                  .removeClass('btn-gradient-danger')
                  .addClass('btn-gradient-primary');
        
        cleanupAnalysis();
    }, 3000);
}

function stopAnalysis() {
    if (!currentAnalysisId) return;
    
    console.log('手動停止分析');
    
    stopPollingAnalysisStatus();
    
    // 清理分析資料
    $.ajax({
        url: `/api/analysis_cleanup/${currentAnalysisId}`,
        method: 'DELETE'
    });
    
    currentAnalysisId = null;
    
    // 更新UI
    const analyzeBtn = $('#analyze-btn');
    const stopBtn = $('#stop-analysis-btn');
    
    analyzeBtn.html('<i class="fas fa-search me-2"></i>開始分析')
             .removeClass('btn-gradient-warning')
             .addClass('btn-gradient-primary')
             .prop('disabled', false);
    
    stopBtn.remove();
    
    showAlert('⏹️ 分析已手動停止', 'warning');
}

function cleanupAnalysis() {
    if (currentAnalysisId) {
        $.ajax({
            url: `/api/analysis_cleanup/${currentAnalysisId}`,
            method: 'DELETE'
        });
        currentAnalysisId = null;
    }
}

function addNavigationToCompletedResults(results) {
    const navigation = createModuleNavigation(results);
    const liveResults = $('#live-results');
    
    // 在結果前面插入導航
    liveResults.prepend(navigation);
    navigation.addClass('animate__animated animate__fadeInDown');
}

function startSyncAnalysis() {
    const analyzeBtn = $('#analyze-btn');
    
    analyzeBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>分析中...').prop('disabled', true);
    showAlert('正在分析檔案，請稍候...', 'info');
    
    $.ajax({
        url: '/api/analyze',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            files: selectedFiles
        }),
        success: function(response) {
            console.log('同步分析完成:', response);
            if (response.success) {
                displayResults(response);
                showAlert('分析完成！', 'success');
                playNotificationSound('complete');
            } else {
                showAlert(response.message, 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('分析失敗:', status, error);
            showAlert('分析失敗，請檢查網路連接', 'danger');
        },
        complete: function() {
            analyzeBtn.html('<i class="fas fa-search me-2"></i>開始分析').prop('disabled', false);
        }
    });
}

function playNotificationSound(type) {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 不同類型的音效
        const soundMap = {
            'success': { freq: 800, duration: 0.2 },
            'start': { freq: 600, duration: 0.3 },
            'discovery': { freq: 900, duration: 0.15 },
            'match': { freq: 1000, duration: 0.1 },
            'complete': { freq: [800, 1000, 1200], duration: 0.5 }
        };
        
        const sound = soundMap[type] || soundMap['success'];
        
        if (Array.isArray(sound.freq)) {
            // 播放和弦
            sound.freq.forEach((freq, index) => {
                setTimeout(() => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    
                    osc.frequency.value = freq;
                    osc.type = 'sine';
                    
                    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    
                    osc.start(audioContext.currentTime);
                    osc.stop(audioContext.currentTime + 0.3);
                }, index * 0.1);
            });
        } else {
            oscillator.frequency.value = sound.freq;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + sound.duration);
        }
    } catch (e) {
        console.log('播放音效失敗:', e);
    }
}

function highlightKeyword(text, keyword) {
    if (!text || !keyword) return text;
    
    // 轉義特殊字符
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    
    return text.replace(regex, '<span class="keyword-highlight">$1</span>');
}

function createModuleNavigation(results) {
    const nav = $('<div class="module-navigation mb-4"></div>');
    
    const navTitle = $('<h5 class="mb-3"><i class="fas fa-compass me-2"></i>快速導航</h5>');
    nav.append(navTitle);
    
    const navButtons = $('<div class="nav-buttons"></div>');
    
    Object.entries(results).forEach(([module, data]) => {
        if (data.total_matches > 0) {
            const btn = $(`
                <button class="btn btn-outline-primary btn-sm me-2 mb-2 nav-btn" 
                        onclick="scrollToModule('${module}')">
                    <i class="fas fa-cube me-1"></i>${module}
                    <span class="badge bg-primary ms-1">${data.total_matches}</span>
                </button>
            `);
            navButtons.append(btn);
        }
    });
    
    // 添加回到頂部按鈕
    const topBtn = $(`
        <button class="btn btn-outline-secondary btn-sm me-2 mb-2" onclick="scrollToTop()">
            <i class="fas fa-arrow-up me-1"></i>回到頂部
        </button>
    `);
    navButtons.append(topBtn);
    
    nav.append(navButtons);
    return nav;
}

function scrollToModule(moduleId) {
    const moduleElement = $(`#module-${moduleId.replace(/\s+/g, '-')}, #live-module-${moduleId.replace(/\s+/g, '-')}`);
    if (moduleElement.length > 0) {
        $('html, body').animate({
            scrollTop: moduleElement.offset().top - 100
        }, 500);
    }
}

function displayResults(response) {
    console.log('顯示分析結果');
    
    const resultsContainer = $('#analysis-results');
    const statsContainer = $('#result-stats');
    const detailsContainer = $('#detailed-results');
    
    // 計算統計
    let totalMatches = 0;
    let totalModules = Object.keys(response.results).length;
    let modulesWithMatches = 0;
    
    Object.values(response.results).forEach(module => {
        totalMatches += module.total_matches;
        if (module.total_matches > 0) {
            modulesWithMatches++;
        }
    });
    
    // 統計卡片
    statsContainer.html(`
        <div class="col-md-3">
            <div class="card bg-primary text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-file-alt me-2"></i>分析檔案</h5>
                    <h2>${response.total_files}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-success text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-cube me-2"></i>監控模組</h5>
                    <h2>${modulesWithMatches}/${totalModules}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-info text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-search me-2"></i>總匹配數</h5>
                    <h2>${totalMatches}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-warning text-white stats-card">
                <div class="card-body">
                    <h5><i class="fas fa-clock me-2"></i>分析時間</h5>
                    <h6>${response.analysis_time}</h6>
                </div>
            </div>
        </div>
    `);
    
    // 清空詳細結果
    detailsContainer.empty();
    
    // 創建快速導航
    const navigation = createModuleNavigation(response.results);
    detailsContainer.append(navigation);
    
    // 詳細結果
    Object.entries(response.results).forEach(([module, data]) => {
        if (data.total_matches === 0) return;
        
        const moduleId = module.replace(/\s+/g, '-');
        const moduleDiv = $(`
            <div class="result-module animate__animated animate__fadeInUp" id="module-${moduleId}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h4><i class="fas fa-cube me-2"></i>${module}</h4>
                        <p class="mb-3">
                            <i class="fas fa-search me-1"></i>找到 ${data.total_matches} 次匹配
                            <span class="ms-3"><i class="fas fa-tags me-1"></i>關鍵字: ${data.keywords_found.join(', ')}</span>
                            ${data.search_time ? `<span class="ms-3"><i class="fas fa-stopwatch me-1"></i>搜尋時間: ${data.search_time.toFixed(2)}秒</span>` : ''}
                        </p>
                    </div>
                    <button class="btn btn-outline-light btn-sm" onclick="scrollToTop()" title="回到頂部">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                </div>
                <div class="result-files"></div>
            </div>
        `);
        
        const filesDiv = moduleDiv.find('.result-files');
        
        Object.entries(data.files).forEach(([filename, matches]) => {
            const fileDiv = $(`
                <div class="result-file animate__animated animate__fadeInLeft">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <h6 class="mb-1"><i class="fas fa-file me-2"></i>${filename.split('/').pop()}</h6>
                            <small class="text-muted">${filename}</small>
                            <span class="badge bg-light text-dark ms-2">${matches.length} 條匹配</span>
                        </div>
                        <button class="btn btn-outline-light btn-sm" onclick="scrollToModule('${module}')" title="回到模組頂部">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                    </div>
                    <div class="result-lines"></div>
                </div>
            `);
            
            const linesDiv = fileDiv.find('.result-lines');
            
            matches.forEach((match, index) => {
                // 高亮關鍵字
                const highlightedContent = highlightKeyword(match.content, match.keyword);
                
                const lineDiv = $(`
                    <div class="result-line animate__animated animate__fadeIn" style="animation-delay: ${index * 0.1}s">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <small class="text-muted mb-1">
                                    <i class="fas fa-map-marker-alt me-1"></i>第 ${match.line_number} 行 
                                    <span class="keyword-tag">[${match.keyword}]</span>
                                </small>
                                <div class="line-content">${highlightedContent}</div>
                            </div>
                            ${index === 0 ? `
                                <button class="btn btn-outline-secondary btn-sm ms-2" onclick="scrollToModule('${module}')" title="回到模組頂部">
                                    <i class="fas fa-arrow-up"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `);
                
                linesDiv.append(lineDiv);
            });
            
            filesDiv.append(fileDiv);
        });
        
        detailsContainer.append(moduleDiv);
    });
    
    if (totalMatches === 0) {
        detailsContainer.html(`
            <div class="text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h5>未找到匹配的關鍵字</h5>
                <p class="text-muted">嘗試調整關鍵字或選擇其他檔案</p>
                <button class="btn btn-primary" onclick="scrollToTop()">
                    <i class="fas fa-arrow-up me-2"></i>回到頂部
                </button>
            </div>
        `);
    }
    
    resultsContainer.show();
    
    // 滾動到結果區域
    $('html, body').animate({
        scrollTop: resultsContainer.offset().top - 100
    }, 500);
}

function showAlert(message, type) {
    const alertContainer = $('#alert-container');
    const alert = $(`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    alertContainer.empty().append(alert);
    
    // 自動消失
    setTimeout(() => {
        alert.alert('close');
    }, 5000);
}

function exportResults() {
    showAlert('匯出功能開發中...', 'info');
}

function scrollToTop() {
    $('html, body').animate({
        scrollTop: 0
    }, 500);
}

function addCustomStyles() {
    if ($('#custom-analysis-styles').length > 0) {
        return; // 已經載入過樣式
    }
    
    const styles = `
        <style id="custom-analysis-styles">
        /* 引入 Animate.css 動畫庫 */
        @import url('https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css');
        
        /* 按鈕漸變樣式 */
        .btn-gradient-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .btn-gradient-primary:hover {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            color: white;
        }
        
        .btn-gradient-warning {
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            border: none;
            color: #2d3436;
            animation: pulse 2s infinite;
        }
        
        .btn-gradient-success {
            background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
            border: none;
            color: white;
        }
        
        .btn-gradient-danger {
            background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
            border: none;
            color: white;
        }
        
        /* 統計卡片樣式 */
        .stats-card {
            transition: all 0.3s ease;
            border: none;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .stats-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .counter-number {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .number-pulse {
            animation: numberPulse 0.6s ease-in-out;
        }
        
        @keyframes numberPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); color: #ff6b6b; }
            100% { transform: scale(1); }
        }
        
        /* 進度條樣式 */
        .progress-modern {
            height: 12px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .progress-modern .progress-bar {
            background: linear-gradient(90deg, #00b894 0%, #00cec9 50%, #74b9ff 100%);
            border-radius: 10px;
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        
        .progress-modern .progress-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            animation: progressShine 2s infinite;
        }
        
        @keyframes progressShine {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        
        .progress-text {
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        /* 狀態區域樣式 */
        .analysis-status {
            border-radius: 15px;
            overflow: hidden;
        }
        
        .status-header h5 {
            margin: 0;
            color: #2d3436;
            font-weight: 600;
        }
        
        .status-alert {
            border: none;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }
        
        .status-text {
            font-weight: 500;
            font-size: 1rem;
        }
        
        .status-time {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            padding: 5px 10px;
            border-radius: 8px;
        }
        
        .status-spinner {
            animation: spin 1.5s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        /* 即時結果樣式 */
        .live-results {
            min-height: 200px;
        }
        
        .live-module {
            border: 2px solid transparent;
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            background-clip: padding-box;
            position: relative;
        }
        
        .live-module::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 15px;
            padding: 2px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            z-index: -1;
        }
        
        .module-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .module-status {
            transition: all 0.3s ease;
            border-radius: 20px;
            padding: 6px 12px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        
        .analysis-status-text {
            font-weight: 500;
            transition: all 0.3s ease;
        }
        
        /* 檔案結果樣式 */
        .live-file {
            border: 1px solid rgba(255,255,255,0.3);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .live-file:hover {
            border-color: rgba(102, 126, 234, 0.5);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
        }
        
        .match-badge {
            transition: all 0.3s ease;
            border-radius: 15px;
            font-weight: 500;
        }
        
        /* 導航樣式 */
        .module-navigation {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.07);
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        
        .nav-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .nav-btn {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 25px;
            font-weight: 500;
        }
        
        .nav-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.15);
        }
        
        /* 結果行樣式 */
        .result-module {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            color: #1565c0;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .result-module::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s ease;
        }
        
        .result-module:hover::before {
            left: 100%;
        }
        
        .result-module:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(0,0,0,0.15);
        }
        
        .result-file {
            background: rgba(255,255,255,0.3);
            border-radius: 12px;
            padding: 18px;
            margin-bottom: 15px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .result-file:hover {
            background: rgba(255,255,255,0.4);
            transform: translateX(5px);
            border-color: rgba(255,255,255,0.4);
        }
        
        .result-line {
            background: rgba(255,255,255,0.15);
            border-left: 3px solid rgba(21, 101, 192, 0.5);
            padding: 12px;
            margin: 8px 0;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            transition: all 0.2s ease;
            position: relative;
        }
        
        .result-line:hover {
            background: rgba(255,255,255,0.25);
            transform: translateX(8px);
            border-left-color: rgba(21, 101, 192, 0.8);
        }
        
        .keyword-highlight {
            background: linear-gradient(135deg, #ff5722 0%, #ff6347 100%);
            color: white;
            font-weight: bold;
            padding: 3px 6px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(255, 87, 34, 0.3);
            animation: keywordGlow 2s infinite alternate;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        @keyframes keywordGlow {
            0% { box-shadow: 0 2px 8px rgba(255, 87, 34, 0.3); }
            100% { box-shadow: 0 4px 12px rgba(255, 87, 34, 0.6); }
        }
        
        .keyword-tag {
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 15px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
        }
        
        .line-content {
            line-height: 1.6;
            word-break: break-all;
            margin-top: 8px;
            padding: 5px;
            background: rgba(255,255,255,0.1);
            border-radius: 6px;
        }
        
        /* 響應式設計 */
        @media (max-width: 768px) {
            .result-module {
                padding: 15px;
                margin-bottom: 15px;
            }
            
            .result-file {
                padding: 12px;
            }
            
            .result-line {
                padding: 8px;
                font-size: 0.8rem;
            }
            
            .nav-buttons {
                flex-direction: column;
            }
            
            .nav-btn {
                width: 100%;
                margin-bottom: 8px;
            }
            
            .stats-card {
                margin-bottom: 15px;
            }
        }
        
        /* 滾動行為優化 */
        html {
            scroll-behavior: smooth;
        }
        
        /* 按鈕樣式增強 */
        .btn-outline-light:hover {
            background-color: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.4);
            transform: translateY(-1px);
        }
        
        .btn-outline-secondary {
            border-color: rgba(108, 117, 125, 0.3);
            transition: all 0.3s ease;
        }
        
        .btn-outline-secondary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(108, 117, 125, 0.3);
        }
        
        /* 動畫增強 */
        .animate__fadeInUp {
            animation-duration: 0.8s;
        }
        
        .animate__fadeInLeft {
            animation-duration: 0.6s;
        }
        
        .animate__fadeIn {
            animation-duration: 0.4s;
        }
        
        .animate__fadeInDown {
            animation-duration: 0.7s;
        }
        
        .animate__pulse {
            animation-duration: 1s;
        }
        
        /* jQuery UI easing */
        .ui-effects-transfer {
            border: 2px dotted #667eea;
        }
        </style>
    `;
    
    $('head').append(styles);
    
    // 添加 jQuery UI easing
    if (typeof $.easing.easeOutQuart === 'undefined') {
        $.easing.easeOutQuart = function (x, t, b, c, d) {
            return -c * ((t=t/d-1)*t*t*t - 1) + b;
        };
    }
    
    console.log('自定義樣式已載入');
}