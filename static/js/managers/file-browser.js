// Enhanced Log 分析平台 v6 - 檔案瀏覽器
// static/js/managers/file-browser.js

window.fileBrowser = {
    // 瀏覽歷史
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    
    // 路徑建議快取
    pathSuggestions: new Map(),
    
    init: function() {
        console.log('📁 初始化檔案瀏覽器');
        
        // 載入瀏覽歷史
        this.loadHistory();
        
        // 設置事件監聽器
        this.setupEventListeners();
        
        // 初始化路徑建議
        this.initPathSuggestions();
    },
    
    // 載入瀏覽歷史
    loadHistory: function() {
        const savedHistory = utils.loadLocal('fileBrowserHistory', []);
        this.history = savedHistory.slice(-this.maxHistory);
        this.historyIndex = this.history.length - 1;
    },
    
    // 儲存瀏覽歷史
    saveHistory: function() {
        utils.saveLocal('fileBrowserHistory', this.history.slice(-this.maxHistory));
    },
    
    // 添加到歷史
    addToHistory: function(path) {
        // 如果在歷史中間，刪除後面的項目
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 避免重複
        if (this.history[this.history.length - 1] !== path) {
            this.history.push(path);
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
            this.historyIndex = this.history.length - 1;
            this.saveHistory();
        }
        
        this.updateNavigationButtons();
    },
    
    // 返回上一個路徑
    goBack: function() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const path = this.history[this.historyIndex];
            this.loadDirectory(path, false);
        }
    },
    
    // 前進到下一個路徑
    goForward: function() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const path = this.history[this.historyIndex];
            this.loadDirectory(path, false);
        }
    },
    
    // 更新導航按鈕狀態
    updateNavigationButtons: function() {
        const backBtn = document.getElementById('nav-back-btn');
        const forwardBtn = document.getElementById('nav-forward-btn');
        
        if (backBtn) {
            backBtn.disabled = this.historyIndex <= 0;
        }
        if (forwardBtn) {
            forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
    },
    
    // 初始化路徑建議
    initPathSuggestions: function() {
        const pathInput = document.getElementById('path-input');
        const suggestionsList = document.getElementById('path-suggestions');
        
        if (!pathInput || !suggestionsList) return;
        
        // 輸入時顯示建議 - 修改為即時載入
        pathInput.addEventListener('input', (e) => {
            const value = e.target.value;
            this.showPathSuggestions(value);
        });
        
        // 焦點時顯示建議
        pathInput.addEventListener('focus', () => {
            const value = pathInput.value;
            this.showPathSuggestions(value);
        });
        
        // 失焦時隱藏建議（延遲以允許點擊）
        pathInput.addEventListener('blur', () => {
            setTimeout(() => {
                suggestionsList.style.display = 'none';
            }, 200);
        });
        
        // Enter 鍵立即隱藏建議並導航
        pathInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                suggestionsList.style.display = 'none';
                this.navigateToPath();
            }
        });
    },
    
    // 顯示路徑建議 - 修改為即時載入
    showPathSuggestions: async function(currentPath) {
        const suggestionsList = document.getElementById('path-suggestions');
        if (!suggestionsList) return;
        
        suggestionsList.innerHTML = '';
        
        // 如果路徑為空，不顯示建議
        if (!currentPath || currentPath.trim() === '') {
            suggestionsList.style.display = 'none';
            return;
        }
        
        // 每次都載入新的建議
        const suggestions = await this.loadPathSuggestions(currentPath);
        
        if (suggestions.length === 0) {
            suggestionsList.style.display = 'none';
            return;
        }
        
        // 顯示建議
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'path-suggestion-item';
            item.innerHTML = `
                <i class="fas ${suggestion.type === 'directory' ? 'fa-folder' : 'fa-file'} me-2"></i>
                ${suggestion.name}
                <span class="text-muted ms-2">${suggestion.path}</span>
            `;
            
            item.addEventListener('click', () => {
                document.getElementById('path-input').value = suggestion.path;
                if (suggestion.type === 'directory') {
                    this.loadDirectory(suggestion.path);
                }
                suggestionsList.style.display = 'none';
            });
            
            suggestionsList.appendChild(item);
        });
        
        suggestionsList.style.display = 'block';
    },
    
    // 載入路徑建議
    loadPathSuggestions: async function(basePath) {
        try {
            const response = await $.get(appConfig.api.browse, { path: basePath });
            if (response.error || !response.items) return [];
            
            return response.items
                .filter(item => !item.is_parent && item.type === 'directory')
                .slice(0, 10)
                .map(item => ({
                    name: item.name,
                    path: item.path,
                    type: item.type
                }));
        } catch (error) {
            console.error('載入路徑建議失敗:', error);
            return [];
        }
    },
    
    // 載入目錄
    loadDirectory: function(path, addHistory = true) {
        console.log('📂 載入目錄:', path);
        
        utils.showLoading('#file-list', '載入檔案列表中...');
        
        $.get(appConfig.api.browse, { path: path })
            .done((response) => {
                console.log('📂 目錄載入回應:', response);
                
                if (response.error) {
                    utils.showError('#file-list', response.error, `fileBrowser.loadDirectory('${appConfig.state.currentPath}')`);
                    return;
                }
                
                appConfig.state.currentPath = response.current_path;
                $('#path-input').val(appConfig.state.currentPath);
                
                // 添加到歷史
                if (addHistory) {
                    this.addToHistory(appConfig.state.currentPath);
                }
                
                this.updateBreadcrumb();
                this.renderFileList(response.items);
                
                // 更新路徑建議快取
                this.updatePathSuggestionsCache(path, response.items);
            })
            .fail((xhr, status, error) => {
                console.error('❌ 載入目錄失敗:', status, error);
                utils.showError('#file-list', '載入失敗，請檢查網路連接', `fileBrowser.loadDirectory('${appConfig.state.currentPath}')`);
            });
    },
    
    // 更新路徑建議快取
    updatePathSuggestionsCache: function(path, items) {
        const directories = items
            .filter(item => !item.is_parent && item.type === 'directory')
            .slice(0, 10)
            .map(item => ({
                name: item.name,
                path: item.path,
                type: item.type
            }));
        
        this.pathSuggestions.set(path, directories);
    },
    
    // 渲染檔案列表
    renderFileList: function(items) {
        console.log('📋 渲染檔案列表:', items.length, '個項目');
        
        const fileList = $('#file-list');
        fileList.empty();
        
        if (items.length === 0) {
            utils.showEmpty('#file-list', '此目錄為空', 'fa-folder-open');
            return;
        }
        
        items.forEach((item, index) => {
            // 跳過 "." 項目
            if (item.name === '.') return;
            
            const isParent = item.is_parent || item.name === '..';
            const isSelected = !isParent && appConfig.state.selectedFiles.includes(item.path);
            
            const fileItem = $(`
                <div class="file-item ${isSelected ? 'selected' : ''} ${isParent ? 'parent-item' : ''} animate__animated animate__fadeInUp" 
                     data-path="${item.path}" 
                     data-type="${item.type}"
                     data-name="${item.name}"
                     data-is-parent="${isParent}"
                     style="animation-delay: ${Math.min(index * 0.05, 1)}s">
                    <div class="d-flex align-items-center">
                        ${!isParent ? 
                            `<input type="checkbox" class="form-check-input me-3" ${isSelected ? 'checked' : ''}>` : 
                            '<div style="width: 38px;"></div>'
                        }
                        <div class="file-icon me-3">
                            ${this.getItemIcon(item)}
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${item.name}</h6>
                            <small class="text-muted">
                                ${item.size && !isParent ? item.size + ' • ' : ''}${item.modified || ''}
                            </small>
                        </div>
                        ${item.type === 'directory' && !isParent ? 
                            '<i class="fas fa-chevron-right text-muted"></i>' : ''
                        }
                    </div>
                </div>
            `);
            
            // 綁定事件
            this.bindFileItemEvents(fileItem, item);
            
            fileList.append(fileItem);
        });
        
        console.log('✅ 檔案列表渲染完成');
        
        // 更新選擇計數
        this.updateSelectedCount();
    },
    
    // 取得項目圖示 (美化版)
    getItemIcon: function(item) {
        if (item.is_parent || item.name === '..') {
            return '<i class="fas fa-level-up-alt"></i>';
        }
        
        if (item.type === 'directory') {
            return '<i class="fas fa-folder"></i>';
        }
        
        // 檔案類型圖示
        const ext = item.name.split('.').pop().toLowerCase();
        const iconMap = {
            // 日誌檔案
            'log': { icon: 'fa-file-alt', color: '#667eea' },
            'txt': { icon: 'fa-file-alt', color: '#667eea' },
            'out': { icon: 'fa-file-export', color: '#17a2b8' },
            'err': { icon: 'fa-file-exclamation', color: '#dc3545' },
            
            // 資料檔案
            'csv': { icon: 'fa-file-csv', color: '#28a745' },
            'json': { icon: 'fa-file-code', color: '#e83e8c' },
            'xml': { icon: 'fa-file-code', color: '#fd7e14' },
            'yaml': { icon: 'fa-file-code', color: '#6f42c1' },
            'yml': { icon: 'fa-file-code', color: '#6f42c1' },
            
            // 壓縮檔案
            'zip': { icon: 'fa-file-archive', color: '#6c757d' },
            '7z': { icon: 'fa-file-archive', color: '#6c757d' },
            'tar': { icon: 'fa-file-archive', color: '#6c757d' },
            'gz': { icon: 'fa-file-archive', color: '#6c757d' },
            'rar': { icon: 'fa-file-archive', color: '#6c757d' },
            
            // 圖片檔案
            'jpg': { icon: 'fa-file-image', color: '#20c997' },
            'jpeg': { icon: 'fa-file-image', color: '#20c997' },
            'png': { icon: 'fa-file-image', color: '#20c997' },
            'gif': { icon: 'fa-file-image', color: '#20c997' },
            'svg': { icon: 'fa-file-image', color: '#20c997' },
            
            // 文件檔案
            'pdf': { icon: 'fa-file-pdf', color: '#dc3545' },
            'doc': { icon: 'fa-file-word', color: '#0062cc' },
            'docx': { icon: 'fa-file-word', color: '#0062cc' },
            'xls': { icon: 'fa-file-excel', color: '#28a745' },
            'xlsx': { icon: 'fa-file-excel', color: '#28a745' },
            'ppt': { icon: 'fa-file-powerpoint', color: '#fd7e14' },
            'pptx': { icon: 'fa-file-powerpoint', color: '#fd7e14' }
        };
        
        const fileType = iconMap[ext] || { icon: 'fa-file', color: '#6c757d' };
        
        return `<i class="fas ${fileType.icon}" style="color: ${fileType.color};"></i>`;
    },
    
    // 綁定檔案項目事件 - 修改為只有點擊 checkbox 才選擇
    bindFileItemEvents: function(fileItem, item) {
        const isParent = item.is_parent || item.name === '..';
        
        // 點擊項目事件 - 只處理目錄導航，不處理選擇
        fileItem.on('click', (e) => {
            // 如果點擊的是 checkbox，不做任何處理
            if ($(e.target).is('input[type="checkbox"]')) {
                return;
            }
            
            console.log('👆 點擊項目:', item.name, item.type);
            
            // 只處理目錄的導航
            if (item.type === 'directory') {
                this.loadDirectory(item.path);
            }
            // 檔案點擊不做任何事情
        });
        
        // Checkbox 變更事件 - 只有這裡處理選擇邏輯
        if (!isParent) {
            const checkbox = fileItem.find('input[type="checkbox"]');
            checkbox.on('click', (e) => {
                e.stopPropagation(); // 防止觸發父元素的點擊事件
            });
            
            checkbox.on('change', (e) => {
                e.stopPropagation();
                
                const isChecked = $(e.target).is(':checked');
                
                console.log('☑️ 檔案選擇狀態改變:', item.path, isChecked);
                
                if (isChecked) {
                    if (!appConfig.state.selectedFiles.includes(item.path)) {
                        appConfig.state.selectedFiles.push(item.path);
                    }
                    fileItem.addClass('selected');
                } else {
                    appConfig.state.selectedFiles = appConfig.state.selectedFiles.filter(f => f !== item.path);
                    fileItem.removeClass('selected');
                }
                
                this.updateSelectedCount();
            });
        }
        
        // 雙擊事件
        fileItem.on('dblclick', (e) => {
            e.preventDefault();
            if (item.type === 'file' && !isParent) {
                window.open(`/file_viewer?path=${encodeURIComponent(item.path)}`, '_blank');
            } else if (item.type === 'directory') {
                this.loadDirectory(item.path);
            }
        });
        
        // 右鍵選單
        fileItem.on('contextmenu', (e) => {
            e.preventDefault();
            if (!isParent) {
                this.showFileContextMenu(e, item);
            }
        });
    },
    
    // 顯示檔案右鍵選單
    showFileContextMenu: function(event, item) {
        // 移除現有選單
        $('.file-context-menu').remove();
        
        const menu = $(`
            <div class="file-context-menu dropdown-menu show" style="position: fixed; z-index: 1100;">
                <h6 class="dropdown-header">${item.name}</h6>
                <div class="dropdown-divider"></div>
        `);
        
        if (item.type === 'file') {
            menu.append(`
                <a class="dropdown-item" href="#" data-action="view">
                    <i class="fas fa-eye me-2"></i>檢視檔案
                </a>
                <a class="dropdown-item" href="#" data-action="copy-path">
                    <i class="fas fa-copy me-2"></i>複製路徑
                </a>
                <a class="dropdown-item" href="#" data-action="select">
                    <i class="fas fa-check me-2"></i>選擇/取消選擇
                </a>
            `);
        } else if (item.type === 'directory') {
            menu.append(`
                <a class="dropdown-item" href="#" data-action="open">
                    <i class="fas fa-folder-open me-2"></i>開啟目錄
                </a>
                <a class="dropdown-item" href="#" data-action="copy-path">
                    <i class="fas fa-copy me-2"></i>複製路徑
                </a>
            `);
        }
        
        menu.append(`
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" href="#" data-action="refresh">
                <i class="fas fa-sync-alt me-2"></i>重新整理
            </a>
        `);
        
        // 定位選單
        menu.css({
            left: event.pageX,
            top: event.pageY
        });
        
        // 添加到頁面
        $('body').append(menu);
        
        // 處理選單項目點擊
        menu.find('a').on('click', (e) => {
            e.preventDefault();
            const action = $(e.target).closest('a').data('action');
            
            switch (action) {
                case 'view':
                    window.open(`/file_viewer?path=${encodeURIComponent(item.path)}`, '_blank');
                    break;
                case 'copy-path':
                    utils.copyToClipboard(item.path);
                    break;
                case 'select':
                    const fileItem = $(`.file-item[data-path="${item.path}"]`);
                    const checkbox = fileItem.find('input[type="checkbox"]');
                    checkbox.prop('checked', !checkbox.prop('checked'));
                    checkbox.trigger('change');
                    break;
                case 'open':
                    this.loadDirectory(item.path);
                    break;
                case 'refresh':
                    this.refreshBrowser();
                    break;
            }
            
            menu.remove();
        });
        
        // 點擊其他地方關閉選單
        $(document).one('click', () => {
            menu.remove();
        });
    },
    
    // 更新麵包屑導航
    updateBreadcrumb: function() {
        const breadcrumb = $('#breadcrumb');
        const pathParts = appConfig.state.currentPath.split('/').filter(part => part);
        
        breadcrumb.empty();
        
        // 根目錄
        const rootItem = $(`
            <li class="breadcrumb-item">
                <a href="#" onclick="fileBrowser.loadDirectory('/'); return false;">
                    <i class="fas fa-home"></i>
                </a>
            </li>
        `);
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
                breadcrumb.append(`
                    <li class="breadcrumb-item">
                        <a href="#" onclick="fileBrowser.loadDirectory('${pathToNavigate}'); return false;">${part}</a>
                    </li>
                `);
            }
        });
        
        console.log('🧭 面包屑導航已更新:', appConfig.state.currentPath);
    },
    
    // 導航到路徑 - 修復此函數
    navigateToPath: function() {
        const path = $('#path-input').val().trim();
        if (path) {
            console.log('🎯 導航到路徑:', path);
            this.loadDirectory(path);
        }
    },
    
    // 重新整理瀏覽器
    refreshBrowser: function() {
        console.log('🔄 刷新瀏覽器');
        this.loadDirectory(appConfig.state.currentPath);
    },
    
    // 切換全選
    toggleSelectAll: function() {
        appConfig.state.allSelectMode = !appConfig.state.allSelectMode;
        console.log('🔄 切換全選模式:', appConfig.state.allSelectMode);
        
        $('.file-item[data-type="file"]:not(.parent-item)').each(function() {
            const checkbox = $(this).find('input[type="checkbox"]');
            const path = $(this).data('path');
            
            if (appConfig.state.allSelectMode) {
                checkbox.prop('checked', true);
                $(this).addClass('selected');
                if (!appConfig.state.selectedFiles.includes(path)) {
                    appConfig.state.selectedFiles.push(path);
                }
            } else {
                checkbox.prop('checked', false);
                $(this).removeClass('selected');
                appConfig.state.selectedFiles = appConfig.state.selectedFiles.filter(f => f !== path);
            }
        });
        
        this.updateSelectedCount();
        
        // 更新按鈕文字
        const btn = $('button[onclick="fileBrowser.toggleSelectAll()"]');
        if (appConfig.state.allSelectMode) {
            btn.html('<i class="fas fa-times me-1"></i>取消全選');
        } else {
            btn.html('<i class="fas fa-check-square me-1"></i>全選');
        }
    },
    
    // 更新選擇計數 (排除父目錄)
    updateSelectedCount: function() {
        const validFiles = appConfig.state.selectedFiles.filter(f => {
            const item = $(`.file-item[data-path="${f}"]`);
            return item.length > 0 && !item.hasClass('parent-item');
        });
        
        // 更新實際的選擇列表
        appConfig.state.selectedFiles = validFiles;
        
        const browserFiles = validFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        $('#selected-count').text(browserFiles.length);
        
        const analyzeBtn = $('#analyze-btn');
        const totalFiles = validFiles.length;
        
        if (totalFiles > 0 && Object.keys(appConfig.state.keywords).length > 0) {
            analyzeBtn.prop('disabled', false);
        } else {
            analyzeBtn.prop('disabled', true);
        }
        
        // 更新快速分析計數
        if (window.quickAnalysis && window.quickAnalysis.updateAnalysisCount) {
            quickAnalysis.updateAnalysisCount();
        }
        
        console.log('📊 已選擇檔案數量:', totalFiles);
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 路徑輸入框 Enter 鍵已在 initPathSuggestions 中處理
        
        // 快捷鍵
        $(document).on('keydown', (e) => {
            // F5 重新整理
            if (e.which === 116) {
                e.preventDefault();
                this.refreshBrowser();
            }
            
            // Ctrl + A 全選
            if (e.ctrlKey && e.which === 65 && $('#file-list').is(':visible')) {
                e.preventDefault();
                this.toggleSelectAll();
            }
            
            // Alt + Left 返回
            if (e.altKey && e.which === 37) {
                e.preventDefault();
                this.goBack();
            }
            
            // Alt + Right 前進
            if (e.altKey && e.which === 39) {
                e.preventDefault();
                this.goForward();
            }
        });
    },
    
    // 選擇特定類型的檔案
    selectFilesByType: function(extension) {
        $('.file-item[data-type="file"]:not(.parent-item)').each(function() {
            const path = $(this).data('path');
            const checkbox = $(this).find('input[type="checkbox"]');
            
            if (path.endsWith(extension)) {
                checkbox.prop('checked', true);
                $(this).addClass('selected');
                if (!appConfig.state.selectedFiles.includes(path)) {
                    appConfig.state.selectedFiles.push(path);
                }
            }
        });
        
        this.updateSelectedCount();
        utils.showAlert(`✅ 已選擇所有 ${extension} 檔案`, 'success');
    },
    
    // 反向選擇
    invertSelection: function() {
        $('.file-item[data-type="file"]:not(.parent-item)').each(function() {
            const checkbox = $(this).find('input[type="checkbox"]');
            checkbox.prop('checked', !checkbox.prop('checked'));
            checkbox.trigger('change');
        });
        
        utils.showAlert('✅ 已反向選擇', 'success');
    }
};