// Enhanced Log 分析平台 v5 - 主要前端腳本
// 全域變數
let currentPath = '/home/vince_lin/Rust_Project';
let selectedFiles = [];
let droppedFiles = [];
let keywords = {};
let allSelectMode = false;
let currentAnalysisId = null;
let eventSource = null;
let audioContext = null;
let currentViewMode = 'module';
let minimizedBlocks = new Set();
let socket = null;
let currentRoom = null;
let userName = 'Guest';
let moduleChart = null;

// 頁面載入時初始化
$(document).ready(function() {
    console.log('🚀 Enhanced Log 分析平台 v5 載入完成');
    
    addCustomStyles();
    initializeApp();
    setupEventListeners();
    setupDropAnalysis();
    setupSocketIO();
    loadDirectory(currentPath);
    setupKeyboardShortcuts();
    
    console.log('✅ 初始化完成');
});

function initializeApp() {
    console.log('🔧 初始化應用...');
    
    // 初始化音頻上下文
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('⚠️ 音頻上下文初始化失敗，音效將不可用');
    }
    
    // 載入已有的關鍵字
    $.get('/api/keywords')
        .done(function(data) {
            console.log('📋 載入關鍵字:', data);
            if (Object.keys(data).length > 0) {
                keywords = data;
                updateKeywordPreview();
            }
        })
        .fail(function() {
            console.log('❌ 載入關鍵字失敗');
        });
    
    // 設置用戶名
    userName = prompt('請輸入您的名稱：') || 'Guest';
}

function setupEventListeners() {
    console.log('🎛️ 設置事件監聽器...');
    
    // 檔案上傳
    $('#keyword-file').on('change', function() {
        const file = this.files[0];
        if (file) {
            console.log('📁 選擇檔案:', file.name);
            uploadKeywords(file);
        }
    });
    
    // 拖拽上傳關鍵字
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
    
    // 檢視模式選項變更
    $('#include-browser-files, #include-dropped-files').on('change', updateAnalysisCount);
    
    console.log('✅ 事件監聽器設置完成');
}

function setupDropAnalysis() {
    console.log('🎯 設置拖曳分析功能');
    
    const dropZone = document.getElementById('drop-analysis-zone');
    const quickAnalysisFile = document.getElementById('quick-analysis-file');
    
    // 拖曳區域事件
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        if (!dropZone.contains(e.relatedTarget)) {
            $(this).removeClass('dragover');
        }
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        handleDroppedFiles(files);
    });
    
    // 檔案選擇器事件
    quickAnalysisFile.addEventListener('change', function() {
        const files = Array.from(this.files);
        handleDroppedFiles(files);
    });
    
    console.log('✅ 拖曳分析功能設置完成');
}

function setupSocketIO() {
    console.log('🔌 初始化 Socket.IO 連接');
    
    try {
        socket = io();
        
        socket.on('connect', function() {
            console.log('✅ Socket.IO 連接成功');
        });
        
        socket.on('disconnect', function() {
            console.log('❌ Socket.IO 連接斷開');
        });
        
        socket.on('user_connected', function(data) {
            console.log('👤 用戶連接:', data);
        });
        
        socket.on('new_message', function(data) {
            displayChatMessage(data);
        });
        
    } catch (e) {
        console.log('⚠️ Socket.IO 初始化失敗:', e);
    }
}

function setupKeyboardShortcuts() {
    // Ctrl + Enter 開始分析
    $(document).keydown(function(e) {
        if (e.ctrlKey && e.which === 13) {
            e.preventDefault();
            if (!$('#analyze-btn').prop('disabled')) {
                startStreamAnalysis();
            }
        }
        
        // Esc 停止分析
        if (e.which === 27 && currentAnalysisId) {
            e.preventDefault();
            if (confirm('確定要停止分析嗎？')) {
                stopStreamAnalysis();
            }
        }
        
        // Ctrl + T 切換檢視模式
        if (e.ctrlKey && e.which === 84) {
            e.preventDefault();
            toggleViewMode();
        }
        
        // Ctrl + R 生成報告
        if (e.ctrlKey && e.which === 82) {
            e.preventDefault();
            if (currentAnalysisId) {
                generateReport();
            }
        }
    });
}

function handleDroppedFiles(files) {
    console.log('📁 處理拖曳檔案:', files.length, '個');
    
    const logExtensions = ['.log', '.txt', '.out', '.err'];
    const archiveExtensions = ['.zip', '.7z', '.tar.gz', '.gz', '.tar'];
    const allExtensions = [...logExtensions, ...archiveExtensions];
    
    const validFiles = files.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        const isArchive = file.name.endsWith('.tar.gz') || allExtensions.some(ext => file.name.endsWith(ext));
        return isArchive;
    });
    
    if (validFiles.length === 0) {
        showAlert('⚠️ 請拖曳有效的檔案格式', 'warning');
        return;
    }
    
    // 處理檔案
    validFiles.forEach(file => {
        if (archiveExtensions.some(ext => file.name.endsWith(ext))) {
            // 處理壓縮檔案
            handleArchiveFile(file);
        } else {
            // 處理一般檔案
            handleRegularFile(file);
        }
    });
}

function handleArchiveFile(file) {
    console.log('📦 處理壓縮檔案:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    showAlert('📦 正在解壓縮檔案...', 'info');
    
    $.ajax({
        url: '/api/upload_archive',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('📦 解壓縮回應:', response);
            if (response.success) {
                // 顯示檔案選擇對話框
                showArchiveFileSelector(response.files);
                showAlert(`✅ ${response.message}`, 'success');
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 解壓縮失敗:', status, error);
            showAlert('❌ 解壓縮失敗', 'danger');
        }
    });
}

function handleRegularFile(file) {
    console.log('📄 處理一般檔案:', file.name);
    
    // 檢查是否已存在
    const exists = droppedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!exists) {
        const virtualPath = `/tmp/uploaded/${file.name}`;
        droppedFiles.push({
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            file: file,
            virtualPath: virtualPath
        });
        
        selectedFiles.push(virtualPath);
    }
    
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    
    showAlert(`✅ 已添加檔案: ${file.name}`, 'success');
}

function showArchiveFileSelector(files) {
    // 創建檔案選擇對話框
    const modalHtml = `
        <div class="modal fade" id="archiveFileModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-archive me-2"></i>選擇要分析的檔案
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <button class="btn btn-primary btn-sm me-2" onclick="selectAllArchiveFiles()">
                                <i class="fas fa-check-square me-1"></i>全選
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="deselectAllArchiveFiles()">
                                <i class="fas fa-square me-1"></i>取消全選
                            </button>
                        </div>
                        <div id="archive-files-list" style="max-height: 400px; overflow-y: auto;">
                            ${files.map(file => `
                                <div class="form-check mb-2">
                                    <input class="form-check-input archive-file-check" type="checkbox" 
                                           value="${file.path}" id="archive-${file.name.replace(/\W/g, '_')}">
                                    <label class="form-check-label d-flex justify-content-between" 
                                           for="archive-${file.name.replace(/\W/g, '_')}">
                                        <span>
                                            <i class="fas fa-file-alt me-2"></i>${file.name}
                                        </span>
                                        <small class="text-muted">${file.size}</small>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="addSelectedArchiveFiles()">
                            <i class="fas fa-plus me-1"></i>添加選中檔案
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除舊的對話框
    $('#archiveFileModal').remove();
    
    // 添加新的對話框
    $('body').append(modalHtml);
    
    // 顯示對話框
    const modal = new bootstrap.Modal(document.getElementById('archiveFileModal'));
    modal.show();
}

function selectAllArchiveFiles() {
    $('.archive-file-check').prop('checked', true);
}

function deselectAllArchiveFiles() {
    $('.archive-file-check').prop('checked', false);
}

function addSelectedArchiveFiles() {
    const selectedPaths = $('.archive-file-check:checked').map(function() {
        return $(this).val();
    }).get();
    
    selectedPaths.forEach(path => {
        if (!selectedFiles.includes(path)) {
            selectedFiles.push(path);
            
            // 添加到拖曳檔案列表
            const fileName = path.split('/').pop();
            droppedFiles.push({
                name: fileName,
                size: 0,
                lastModified: Date.now(),
                virtualPath: path
            });
        }
    });
    
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    
    // 關閉對話框
    $('#archiveFileModal').modal('hide');
    
    showAlert(`✅ 已添加 ${selectedPaths.length} 個檔案`, 'success');
}

function updateDroppedFilesList() {
    const container = $('#dropped-files-container');
    const listElement = $('#dropped-files-list');
    
    if (droppedFiles.length === 0) {
        listElement.hide();
        return;
    }
    
    listElement.show();
    container.empty();
    
    droppedFiles.forEach((fileInfo, index) => {
        const fileElement = $(`
            <div class="dropped-file-item animate__animated animate__fadeInUp" data-index="${index}">
                <div class="d-flex align-items-center">
                    <div class="file-icon log-file me-3">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${fileInfo.name}</h6>
                        <small class="text-muted">
                            ${formatFileSize(fileInfo.size)} • 
                            ${new Date(fileInfo.lastModified).toLocaleString()}
                        </small>
                    </div>
                    <button class="btn btn-outline-danger btn-sm" onclick="removeDroppedFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `);
        
        container.append(fileElement);
    });
}

function removeDroppedFile(index) {
    const removedFile = droppedFiles[index];
    // 從已選擇檔案中移除
    selectedFiles = selectedFiles.filter(f => f !== removedFile.virtualPath);
    
    droppedFiles.splice(index, 1);
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    
    showAlert('🗑️ 已移除檔案', 'info');
}

function clearDroppedFiles() {
    // 從已選擇檔案中移除所有拖曳檔案
    droppedFiles.forEach(fileInfo => {
        selectedFiles = selectedFiles.filter(f => f !== fileInfo.virtualPath);
    });
    
    droppedFiles = [];
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    showAlert('🗑️ 已清空拖曳檔案列表', 'info');
}

function updateAnalysisCount() {
    const includeBrowser = $('#include-browser-files').is(':checked');
    const includeDropped = $('#include-dropped-files').is(':checked');
    
    // 計算瀏覽器選擇的檔案（排除拖曳檔案）
    const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
    const browserCount = includeBrowser ? browserFiles.length : 0;
    const droppedCount = includeDropped ? droppedFiles.length : 0;
    const totalCount = browserCount + droppedCount;
    
    $('#browser-files-count').text(browserCount);
    $('#dropped-files-count').text(droppedCount);
    $('#total-files-count').text(totalCount);
    
    // 更新快速分析按鈕
    const quickAnalyzeBtn = $('#quick-analyze-btn');
    const hasKeywords = Object.keys(keywords).length > 0;
    const hasFiles = totalCount > 0;
    
    quickAnalyzeBtn.prop('disabled', !hasKeywords || !hasFiles);
    
    if (!hasKeywords) {
        quickAnalyzeBtn.html('<i class="fas fa-exclamation-triangle me-2"></i>請先上傳關鍵字');
    } else if (!hasFiles) {
        quickAnalyzeBtn.html('<i class="fas fa-folder-open me-2"></i>請選擇檔案');
    } else {
        quickAnalyzeBtn.html(`<i class="fas fa-rocket me-2"></i>分析 ${totalCount} 個檔案`);
    }
}

function startQuickAnalysis() {
    console.log('⚡ 開始快速分析');
    
    const includeBrowser = $('#include-browser-files').is(':checked');
    const includeDropped = $('#include-dropped-files').is(':checked');
    
    // 準備分析檔案列表
    let analysisFiles = [];
    
    if (includeBrowser) {
        const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        analysisFiles = analysisFiles.concat(browserFiles);
    }
    
    if (includeDropped) {
        const droppedPaths = droppedFiles.map(f => f.virtualPath);
        analysisFiles = analysisFiles.concat(droppedPaths);
    }
    
    if (analysisFiles.length === 0) {
        showAlert('⚠️ 請選擇要分析的檔案', 'warning');
        return;
    }
    
    // 更新全域選擇檔案列表並開始分析
    const originalSelectedFiles = selectedFiles.slice();
    selectedFiles = analysisFiles;
    
    startStreamAnalysis();
    
    // 恢復原始選擇（保持瀏覽器狀態）
    setTimeout(() => {
        selectedFiles = originalSelectedFiles;
    }, 1000);
}

function uploadKeywords(file) {
    if (!file) {
        console.log('❌ 沒有選擇檔案');
        return;
    }
    
    console.log('📤 上傳關鍵字檔案:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    showAlert('📤 上傳中...', 'info');
    
    $.ajax({
        url: '/api/upload_keywords',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('📋 上傳回應:', response);
            if (response.success) {
                keywords = response.keywords;
                updateKeywordPreview();
                showAlert(`✅ ${response.message}`, 'success');
                playNotificationSound('success');
                updateAnalysisCount(); // 更新分析按鈕狀態
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 上傳失敗:', status, error);
            showAlert('❌ 上傳失敗', 'danger');
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
            <div class="keyword-module animate__animated animate__fadeIn" data-module="${module}">
                <span>${module}: ${keywordList.join(', ')}</span>
                <button class="delete-btn" onclick="deleteKeywordModule('${module}')" title="刪除此模組">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
        modules.append(moduleElement);
    }
    
    preview.show();
    console.log('📋 關鍵字預覽已更新');
}

function deleteKeywordModule(module) {
    if (confirm(`確定要刪除模組 "${module}" 嗎？`)) {
        $.ajax({
            url: `/api/keywords/delete/${encodeURIComponent(module)}`,
            type: 'DELETE',
            success: function(response) {
                if (response.success) {
                    delete keywords[module];
                    updateKeywordPreview();
                    showAlert(`✅ 已刪除模組: ${module}`, 'success');
                } else {
                    showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: function() {
                showAlert('❌ 刪除失敗', 'danger');
            }
        });
    }
}

function restoreKeywords() {
    if (confirm('確定要復原所有關鍵字模組嗎？')) {
        $.ajax({
            url: '/api/keywords/restore',
            type: 'POST',
            success: function(response) {
                if (response.success) {
                    keywords = response.keywords;
                    updateKeywordPreview();
                    showAlert(`✅ ${response.message}`, 'success');
                } else {
                    showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: function() {
                showAlert('❌ 復原失敗', 'danger');
            }
        });
    }
}

function loadDirectory(path) {
    console.log('📂 載入目錄:', path);
    
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
            console.log('📂 目錄載入回應:', response);
            
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
            console.error('❌ 載入目錄失敗:', status, error);
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
    console.log('📋 渲染檔案列表:', items.length, '個項目');
    
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
        // 排除拖曳檔案來檢查選擇狀態
        const isSelected = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/')).includes(item.path);
        
        const fileItem = $(`
            <div class="file-item ${isSelected ? 'selected' : ''} animate__animated animate__fadeInUp" 
                 data-path="${item.path}" data-type="${item.type}" style="animation-delay: ${index * 0.05}s">
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
            console.log('👆 點擊項目:', item.name, item.type);
            
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
            
            console.log('☑️ 檔案選擇狀態改變:', path, isChecked);
            
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
    
    console.log('✅ 檔案列表渲染完成');
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
    
    console.log('🧭 面包屑導航已更新:', currentPath);
}

function navigateToPath() {
    const path = $('#path-input').val().trim();
    if (path) {
        console.log('🎯 導航到路徑:', path);
        loadDirectory(path);
    }
}

function refreshBrowser() {
    console.log('🔄 刷新瀏覽器');
    loadDirectory(currentPath);
}

function toggleSelectAll() {
    allSelectMode = !allSelectMode;
    console.log('🔄 切換全選模式:', allSelectMode);
    
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
    // 計算實際的瀏覽器選擇檔案（排除拖曳檔案）
    const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
    $('#selected-count').text(browserFiles.length);
    
    const analyzeBtn = $('#analyze-btn');
    const totalFiles = selectedFiles.length;
    
    if (totalFiles > 0 && Object.keys(keywords).length > 0) {
        analyzeBtn.prop('disabled', false);
    } else {
        analyzeBtn.prop('disabled', true);
    }
    
    // 同時更新快速分析計數
    updateAnalysisCount();
    
    console.log('📊 已選擇檔案數量:', totalFiles);
}

function startStreamAnalysis() {
    console.log('🚀 開始流式分析');
    
    if (selectedFiles.length === 0) {
        showAlert('⚠️ 請選擇要分析的檔案', 'warning');
        return;
    }
    
    if (Object.keys(keywords).length === 0) {
        showAlert('⚠️ 請先上傳關鍵字清單', 'warning');
        return;
    }
    
    // 直接開始分析，不使用模態框
    initializeStreamingAnalysis();
    
    // 啟動流式分析
    $.ajax({
        url: '/api/analyze_stream',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            files: selectedFiles
        }),
        success: function(response) {
            console.log('🎯 流式分析啟動:', response);
            if (response.success) {
                currentAnalysisId = response.analysis_id;
                startEventSource(response.analysis_id);
                showAlert('🚀 分析已開始，結果將即時顯示！', 'success');
                playNotificationSound('start');
                
                // 更新分析按鈕狀態
                updateAnalysisButtonState('running');
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
                updateAnalysisButtonState('idle');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 啟動分析失敗:', status, error);
            showAlert('❌ 啟動分析失敗，請檢查網路連接', 'danger');
            updateAnalysisButtonState('idle');
        }
    });
}

function initializeStreamingAnalysis() {
    const resultsContainer = $('#analysis-results');
    const statsContainer = $('#result-stats');
    const detailsContainer = $('#detailed-results');
    
    // 顯示分析區域
    resultsContainer.show();
    
    // 顯示統計圖表
    $('#statistics-section').show();
    
    // 初始化統計區域
    statsContainer.html(`
        <div class="col-md-2">
            <div class="card bg-primary text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-file-alt me-2"></i>檔案</h5>
                    <h2 id="stat-files" class="counter-number">${selectedFiles.length}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card bg-success text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-cube me-2"></i>模組</h5>
                    <h2 id="stat-modules" class="counter-number">0/${Object.keys(keywords).length}</h2>
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
                        <button class="btn btn-danger btn-sm mt-2" id="stop-analysis-inline" onclick="stopStreamAnalysis()">
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
    
    // 滾動到結果區域
    $('html, body').animate({
        scrollTop: resultsContainer.offset().top - 50
    }, 300);
    
    // 初始化圖表
    initializeModuleChart();
}

function initializeModuleChart() {
    const ctx = document.getElementById('moduleChart');
    if (!ctx) return;
    
    moduleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '匹配數量',
                data: [],
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: '各模組匹配統計',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function updateAnalysisButtonState(state) {
    const analyzeBtn = $('#analyze-btn');
    
    switch (state) {
        case 'running':
            analyzeBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>分析進行中')
                      .removeClass('btn-danger-gradient')
                      .addClass('btn-warning')
                      .prop('disabled', false)
                      .attr('onclick', 'stopStreamAnalysis()');
            break;
        case 'stopping':
            analyzeBtn.html('<i class="fas fa-circle-notch fa-spin me-2"></i>正在停止')
                      .addClass('btn-secondary')
                      .prop('disabled', true);
            break;
        case 'idle':
        default:
            analyzeBtn.html('<i class="fas fa-stream me-2"></i>開始流式分析')
                      .removeClass('btn-warning btn-secondary')
                      .addClass('btn-danger-gradient')
                      .prop('disabled', selectedFiles.length === 0 || Object.keys(keywords).length === 0)
                      .attr('onclick', 'startStreamAnalysis()');
            break;
    }
}

function startEventSource(analysisId) {
    console.log('🌊 啟動 EventSource:', analysisId);
    
    // 關閉現有連接
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    try {
        // 建立新的 SSE 連接
        eventSource = new EventSource(`/api/analysis_stream/${analysisId}`);
        
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                // 使用 setTimeout 確保不阻塞 UI
                setTimeout(() => {
                    handleStreamMessage(data);
                }, 0);
            } catch (e) {
                console.error('❌ 解析 SSE 訊息失敗:', e, event.data);
            }
        };
        
        eventSource.onerror = function(event) {
            console.error('❌ EventSource 錯誤:', event);
            
            // 如果連接關閉，清理資源
            if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
                console.log('🔌 EventSource 連接已關閉');
                eventSource = null;
            }
        };
        
        eventSource.onopen = function(event) {
            console.log('✅ EventSource 連接已建立');
        };
        
    } catch (e) {
        console.error('❌ 建立 EventSource 失敗:', e);
        showAlert('❌ 建立即時連接失敗', 'danger');
    }
}

function handleStreamMessage(data) {
    try {
        console.log('📩 收到流式訊息:', data.type);
        
        switch (data.type) {
            case 'heartbeat':
                // 心跳訊息，保持連接
                break;
                
            case 'start':
                updateProgressStatus('🚀 分析開始', '正在初始化...');
                $('.analysis-starting').remove();
                break;
                
            case 'module_start':
                updateProgressStatus(`🔍 分析模組: ${data.module}`, '準備搜尋關鍵字...');
                break;
                
            case 'file_start':
                updateProgressStatus(`📂 分析檔案: ${data.module}`, `正在處理: ${data.file.split('/').pop()}`);
                break;
                
            case 'matches_found':
                handleMatchesFound(data);
                break;
                
            case 'progress':
                updateProgress(data.progress);
                break;
                
            case 'module_complete':
                updateModuleComplete(data);
                break;
                
            case 'complete':
                handleAnalysisComplete(data);
                break;
                
            case 'error':
            case 'timeout':
                handleAnalysisError(data);
                break;
                
            default:
                console.log('🤔 未知訊息類型:', data.type);
        }
    } catch (e) {
        console.error('❌ 處理流式訊息時發生錯誤:', e, data);
    }
}

function handleMatchesFound(data) {
    try {
        console.log('🎯 發現匹配 - 模組:', data.module, '檔案:', data.file.split('/').pop(), '匹配數:', data.matches.length);
        
        // 更新統計
        updateStatsLightweight(data.total_matches);
        
        // 更新圖表
        updateModuleChart(data.module, data.total_matches);
        
        // 根據當前檢視模式更新結果
        if (currentViewMode === 'module') {
            updateModuleViewResults(data);
        } else if (currentViewMode === 'file') {
            updateFileViewResults(data);
        } else if (currentViewMode === 'tab') {
            updateTabViewResults(data);
        }
        
    } catch (e) {
        console.error('❌ 處理匹配結果時發生錯誤:', e, data);
    }
}

function updateModuleChart(moduleName, totalMatches) {
    if (!moduleChart) return;
    
    const labels = moduleChart.data.labels;
    const data = moduleChart.data.datasets[0].data;
    
    const index = labels.indexOf(moduleName);
    if (index !== -1) {
        data[index] = totalMatches;
    } else {
        labels.push(moduleName);
        data.push(totalMatches);
    }
    
    // 更新圖表摘要
    $('#total-modules').text(labels.length);
    $('#total-matches-chart').text(data.reduce((a, b) => a + b, 0));
    $('#total-files-chart').text(selectedFiles.length);
    
    moduleChart.update('none');
}

function updateStatsLightweight(totalMatches) {
    const statsElement = $('#stat-matches');
    if (statsElement.length > 0) {
        const currentValue = parseInt(statsElement.text()) || 0;
        if (totalMatches > currentValue) {
            animateNumber(statsElement, totalMatches);
        }
    }
}

function updateProgressStatus(moduleText, fileText) {
    $('#current-module-display').html(`
        <div class="small">${moduleText}</div>
        <div class="text-muted" style="font-size: 0.75rem;">${fileText}</div>
    `);
    $('#progress-text').text('分析中...');
}

function updateProgress(progress) {
    $('#progress-bar').css('width', progress + '%');
    $('#progress-text').text(`${progress}% 完成`);
}

function updateModuleComplete(data) {
    console.log('✅ 模組完成:', data.module);
    
    // 更新完成模組計數
    const completedModules = Object.keys(keywords).length; // 假設所有模組都完成
    animateNumber($('#stat-modules'), `${completedModules}/${Object.keys(keywords).length}`);
}

function handleAnalysisComplete(data) {
    console.log('🎉 分析完成:', data);
    
    // 關閉 EventSource
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // 更新統計
    animateNumber($('#stat-modules'), `${Object.keys(keywords).length}/${Object.keys(keywords).length}`);
    $('#progress-bar').css('width', '100%');
    $('#progress-text').text('100% 完成');
    $('#current-module-display').html('<div class="text-success"><i class="fas fa-check-circle me-2"></i>分析完成</div>');
    
    // 隱藏停止按鈕
    $('#stop-analysis-inline').hide();
    
    // 顯示報告按鈕
    $('#report-btn').show();
    
    // 播放完成音效
    playNotificationSound('complete');
    
    // 顯示完成訊息
    showAlert(`🎉 分析完成！總共找到 ${data.total_matches || 0} 次匹配，耗時 ${data.total_time?.toFixed(2) || 0} 秒`, 'success');
    
    // 重置分析按鈕
    updateAnalysisButtonState('idle');
    
    // 清理分析狀態
    currentAnalysisId = null;
}

function handleAnalysisError(data) {
    console.error('❌ 分析錯誤:', data);
    
    // 關閉 EventSource
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // 更新狀態顯示
    $('#current-module-display').html('<div class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>分析錯誤</div>');
    $('#stop-analysis-inline').hide();
    
    // 顯示錯誤訊息
    showAlert(`❌ 分析過程中發生錯誤：${data.message || '未知錯誤'}`, 'danger');
    
    // 重置分析按鈕
    updateAnalysisButtonState('idle');
    
    // 清理分析狀態
    currentAnalysisId = null;
}

function stopStreamAnalysis() {
    console.log('⏹️ 手動停止分析');
    
    try {
        // 關閉 EventSource
        if (eventSource) {
            console.log('🔌 關閉 EventSource 連接');
            eventSource.close();
            eventSource = null;
        }
        
        // 清理分析資料
        if (currentAnalysisId) {
            $.ajax({
                url: `/api/analysis_cleanup/${currentAnalysisId}`,
                method: 'DELETE',
                timeout: 5000
            });
            
            currentAnalysisId = null;
        }
        
        // 更新UI狀態
        updateProgressStatus('⏹️ 分析已停止', '用戶手動停止分析');
        $('#stop-analysis-inline').hide();
        updateAnalysisButtonState('idle');
        
        showAlert('⏹️ 分析已手動停止', 'warning');
        
    } catch (e) {
        console.error('❌ 停止分析時發生錯誤:', e);
        showAlert('❌ 停止分析時發生錯誤', 'danger');
    }
}

// 檢視模式管理
function setViewMode(mode) {
    if (currentViewMode === mode) return;
    
    currentViewMode = mode;
    
    // 更新按鈕狀態
    $('#view-controls .btn').removeClass('active');
    $(`#${mode}-view-btn`).addClass('active');
    
    // 切換檢視
    if (mode === 'tab') {
        $('#tab-view-container').show();
        $('#stream-results').hide();
    } else {
        $('#tab-view-container').hide();
        $('#stream-results').show();
    }
    
    showAlert(`🔄 已切換到${mode === 'module' ? '模組' : mode === 'file' ? '檔案' : '標籤'}檢視模式`, 'info');
}

function toggleViewMode() {
    const modes = ['module', 'file', 'tab'];
    const currentIndex = modes.indexOf(currentViewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
}

// 區塊最小化管理
function minimizeBlock(blockId, blockName) {
    const block = $(`#${blockId}`);
    block.hide();
    minimizedBlocks.add(blockId);
    
    // 添加到最小化容器
    const minimizedContainer = $('#minimized-blocks');
    const minimizedItem = $(`
        <div class="minimized-block" data-block="${blockId}" onclick="restoreBlock('${blockId}')">
            <i class="fas fa-window-restore me-1"></i>${blockName}
        </div>
    `);
    
    minimizedContainer.append(minimizedItem);
    showAlert(`📦 已最小化: ${blockName}`, 'info');
}

function restoreBlock(blockId) {
    const block = $(`#${blockId}`);
    block.show();
    minimizedBlocks.delete(blockId);
    
    // 從最小化容器移除
    $(`.minimized-block[data-block="${blockId}"]`).remove();
    
    // 滾動到區塊
    $('html, body').animate({
        scrollTop: block.offset().top - 100
    }, 500);
}

// 報告生成
function generateReport() {
    if (!currentAnalysisId) {
        showAlert('⚠️ 沒有可用的分析結果', 'warning');
        return;
    }
    
    const reportUrl = `/analysis_report/${currentAnalysisId}`;
    window.open(reportUrl, '_blank');
    showAlert('📄 正在生成分析報告...', 'info');
}

// 聊天室功能
function openChat() {
    if (!socket) {
        showAlert('⚠️ 聊天功能不可用', 'warning');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('chatModal'));
    modal.show();
    
    // 初始化聊天介面
    initializeChatInterface();
}

function initializeChatInterface() {
    const chatInterface = $('#chat-interface');
    chatInterface.html(`
        <div class="row">
            <div class="col-md-3">
                <h6>聊天室列表</h6>
                <div id="room-list">
                    <div class="list-group">
                        <a href="#" class="list-group-item list-group-item-action" onclick="joinRoom('general')">
                            <i class="fas fa-comments me-2"></i>一般討論
                        </a>
                        <a href="#" class="list-group-item list-group-item-action" onclick="joinRoom('analysis')">
                            <i class="fas fa-chart-line me-2"></i>分析討論
                        </a>
                        <a href="#" class="list-group-item list-group-item-action" onclick="createRoom()">
                            <i class="fas fa-plus me-2"></i>創建聊天室
                        </a>
                    </div>
                </div>
            </div>
            <div class="col-md-9">
                <div id="chat-area" style="display: none;">
                    <div class="chat-header mb-3">
                        <h6 id="current-room-name">請選擇聊天室</h6>
                    </div>
                    <div id="chat-messages" style="height: 300px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; margin-bottom: 10px;">
                        <!-- 聊天訊息 -->
                    </div>
                    <div class="input-group">
                        <input type="text" class="form-control" id="chat-input" placeholder="輸入訊息...">
                        <button class="btn btn-primary" onclick="sendMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function joinRoom(roomId) {
    currentRoom = roomId;
    
    if (socket) {
        socket.emit('join_room', {
            room_id: roomId,
            user_name: userName
        });
    }
    
    $('#chat-area').show();
    $('#current-room-name').text(roomId);
    $('#chat-messages').empty();
    
    showAlert(`✅ 已加入聊天室: ${roomId}`, 'success');
}

function sendMessage() {
    const message = $('#chat-input').val().trim();
    if (!message || !currentRoom || !socket) return;
    
    socket.emit('send_message', {
        room_id: currentRoom,
        message: message
    });
    
    $('#chat-input').val('');
}

function displayChatMessage(data) {
    const messagesContainer = $('#chat-messages');
    const messageElement = $(`
        <div class="chat-message mb-2">
            <small class="text-muted">${data.timestamp}</small>
            <strong>${data.user_name}:</strong>
            <span>${data.message}</span>
        </div>
    `);
    
    messagesContainer.append(messageElement);
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

// 幸運轉盤功能
function openLottery() {
    const modal = new bootstrap.Modal(document.getElementById('lotteryModal'));
    modal.show();
    
    initializeLotteryWheel();
}

function initializeLotteryWheel() {
    const wheelContainer = $('#lottery-wheel');
    wheelContainer.html(`
        <div class="wheel-container" style="position: relative; display: inline-block;">
            <div class="wheel" id="wheel" style="width: 300px; height: 300px; border-radius: 50%; border: 5px solid #333; position: relative; background: conic-gradient(#ff6b6b 0deg 60deg, #4ecdc4 60deg 120deg, #45b7d1 120deg 180deg, #96ceb4 180deg 240deg, #ffeaa7 240deg 300deg, #dda0dd 300deg 360deg);">
                <div class="wheel-pointer" style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 20px solid #333; z-index: 10;"></div>
            </div>
        </div>
        <div class="mt-3">
            <button class="btn btn-primary btn-lg" onclick="spinWheel()">
                <i class="fas fa-sync-alt me-2"></i>開始轉盤
            </button>
        </div>
        <div id="lottery-result" class="mt-3" style="display: none;">
            <h5>結果：<span id="lottery-winner"></span></h5>
        </div>
    `);
}

function spinWheel() {
    const wheel = $('#wheel');
    const options = ['選項1', '選項2', '選項3', '選項4', '選項5', '選項6'];
    const randomIndex = Math.floor(Math.random() * options.length);
    const rotation = 360 * 5 + (randomIndex * 60); // 多轉5圈 + 隨機角度
    
    wheel.css({
        'transition': 'transform 3s ease-out',
        'transform': `rotate(${rotation}deg)`
    });
    
    setTimeout(() => {
        $('#lottery-winner').text(options[randomIndex]);
        $('#lottery-result').show();
        showAlert(`🎉 轉盤結果: ${options[randomIndex]}`, 'success');
    }, 3000);
}

// 廣播系統
function openBroadcast() {
    showAlert('📢 廣播功能開發中...', 'info');
}

// 輔助函數
function animateNumber(selector, newValue) {
    const element = $(selector);
    const isNumeric = !isNaN(newValue) && newValue !== '';
    
    if (isNumeric) {
        const oldValue = parseInt(element.text()) || 0;
        const targetValue = parseInt(newValue);
        
        if (targetValue > oldValue) {
            element.addClass('animate__animated animate__pulse');
            
            $({ counter: oldValue }).animate({ counter: targetValue }, {
                duration: 800,
                easing: 'easeOutQuart',
                step: function() {
                    element.text(Math.ceil(this.counter));
                },
                complete: function() {
                    element.text(targetValue);
                    setTimeout(() => {
                        element.removeClass('animate__animated animate__pulse');
                    }, 500);
                }
            });
        }
    } else {
        element.text(newValue);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function playNotificationSound(type) {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        const soundMap = {
            'success': { freq: 800, duration: 0.2 },
            'start': { freq: 600, duration: 0.3 },
            'complete': { freq: [800, 1000, 1200], duration: 0.5 }
        };
        
        const sound = soundMap[type] || soundMap['success'];
        
        if (Array.isArray(sound.freq)) {
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
        console.log('🔇 播放音效失敗:', e);
    }
}

function showAlert(message, type) {
    // 移除舊的提示
    $('.floating-alert').remove();
    
    const alertClass = {
        'success': 'alert-success',
        'info': 'alert-info',
        'warning': 'alert-warning',
        'danger': 'alert-danger'
    }[type] || 'alert-info';
    
    const alertHtml = `
        <div class="alert ${alertClass} floating-alert position-fixed animate__animated animate__fadeInDown" 
             style="top: 20px; right: 20px; z-index: 9999; max-width: 350px; box-shadow: 0 8px 25px rgba(0,0,0,0.12);">
            ${message}
            <button type="button" class="btn-close" onclick="$(this).parent().remove()"></button>
        </div>
    `;
    
    $('body').append(alertHtml);
    
    setTimeout(() => {
        $('.floating-alert').addClass('animate__fadeOutUp');
        setTimeout(() => {
            $('.floating-alert').remove();
        }, 500);
    }, 4000);
}

function scrollToTop() {
    $('html, body').animate({
        scrollTop: 0
    }, 500);
}

function exportResults() {
    showAlert('🔄 匯出功能開發中...', 'info');
}

function addCustomStyles() {
    if ($('#custom-enhanced-styles-v5').length > 0) {
        return;
    }
    
    const styles = `
        <style id="custom-enhanced-styles-v5">
        /* 自定義樣式增強 */
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
        }
        
        .dropped-files-list {
            text-align: left;
            background: rgba(255,255,255,0.9);
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
            border: 1px solid #dee2e6;
        }
        
        .dropped-file-item {
            background: rgba(102, 126, 234, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            transition: all 0.3s ease;
            border-left: 3px solid #667eea;
        }
        
        .dropped-file-item:hover {
            background: rgba(102, 126, 234, 0.1);
            transform: translateX(5px);
        }
        
        .quick-analysis-options {
            background: rgba(255,255,255,0.9);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #dee2e6;
            height: fit-content;
        }
        
        .analysis-summary {
            background: rgba(102, 126, 234, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }
        
        .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 4px 0;
        }
        
        .summary-item.total-summary {
            border-top: 1px solid rgba(102, 126, 234, 0.2);
            margin-top: 10px;
            padding-top: 10px;
            font-weight: 600;
        }
        
        /* 響應式設計 */
        @media (max-width: 768px) {
            .floating-actions {
                bottom: 20px;
                right: 20px;
            }
            
            .floating-btn {
                width: 50px;
                height: 50px;
                font-size: 1rem;
            }
        }
        </style>
    `;
    
    $('head').append(styles);
    console.log('🎨 自定義樣式已載入');
}

// 初始化 jQuery UI easing
if (typeof $.easing.easeOutQuart === 'undefined') {
    $.easing.easeOutQuart = function (x, t, b, c, d) {
        return -c * ((t=t/d-1)*t*t*t - 1) + b;
    };
}