// Enhanced Log 分析平台 v6 - 檔案瀏覽器
// static/js/managers/file-browser.js

window.fileBrowser = {
    init: function() {
        console.log('📁 初始化檔案瀏覽器');
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 載入目錄
    loadDirectory: function(path) {
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
                this.updateBreadcrumb();
                this.renderFileList(response.items);
            })
            .fail((xhr, status, error) => {
                console.error('❌ 載入目錄失敗:', status, error);
                utils.showError('#file-list', '載入失敗，請檢查網路連接', `fileBrowser.loadDirectory('${appConfig.state.currentPath}')`);
            });
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
            const isSelected = appConfig.state.selectedFiles.includes(item.path);
            
            const fileItem = $(`
                <div class="file-item ${isSelected ? 'selected' : ''} animate__animated animate__fadeInUp" 
                     data-path="${item.path}" 
                     data-type="${item.type}" 
                     style="animation-delay: ${Math.min(index * 0.05, 1)}s">
                    <div class="d-flex align-items-center">
                        ${item.type === 'file' && !item.is_parent ? 
                            `<input type="checkbox" class="form-check-input me-3" ${isSelected ? 'checked' : ''}>` : 
                            '<div class="me-3" style="width: 20px;"></div>'
                        }
                        <div class="file-icon me-3">
                            <i class="fas ${this.getItemIcon(item)} fa-lg"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${item.name}</h6>
                            <small class="text-muted">
                                ${item.size ? item.size + ' • ' : ''}${item.modified}
                            </small>
                        </div>
                        ${item.type === 'directory' ? 
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
    
    // 綁定檔案項目事件
    bindFileItemEvents: function(fileItem, item) {
        // 點擊事件
        fileItem.on('click', (e) => {
            console.log('👆 點擊項目:', item.name, item.type);
            
            if (item.type === 'directory') {
                this.loadDirectory(item.path);
            } else if (item.type === 'file' && !item.is_parent) {
                // 如果點擊的不是 checkbox，則切換選擇狀態
                if (e.target.type !== 'checkbox') {
                    const checkbox = fileItem.find('input[type="checkbox"]');
                    checkbox.prop('checked', !checkbox.prop('checked'));
                    checkbox.trigger('change');
                }
            }
        });
        
        // Checkbox 變更事件
        const checkbox = fileItem.find('input[type="checkbox"]');
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
        
        // 雙擊事件
        fileItem.on('dblclick', (e) => {
            e.preventDefault();
            if (item.type === 'file') {
                window.open(`/file_viewer?path=${encodeURIComponent(item.path)}`, '_blank');
            }
        });
        
        // 右鍵選單
        fileItem.on('contextmenu', (e) => {
            e.preventDefault();
            this.showFileContextMenu(e, item);
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
            `);
            
            if (!item.is_parent) {
                menu.append(`
                    <a class="dropdown-item" href="#" data-action="select">
                        <i class="fas fa-check me-2"></i>選擇/取消選擇
                    </a>
                `);
            }
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
    
    // 導航到路徑
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
        
        $('.file-item[data-type="file"]').each(function() {
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
    
    // 更新選擇計數
    updateSelectedCount: function() {
        const browserFiles = appConfig.state.selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        $('#selected-count').text(browserFiles.length);
        
        const analyzeBtn = $('#analyze-btn');
        const totalFiles = appConfig.state.selectedFiles.length;
        
        if (totalFiles > 0 && Object.keys(appConfig.state.keywords).length > 0) {
            analyzeBtn.prop('disabled', false);
        } else {
            analyzeBtn.prop('disabled', true);
        }
        
        // 更新快速分析計數
        quickAnalysis.updateAnalysisCount();
        
        console.log('📊 已選擇檔案數量:', totalFiles);
    },
    
    // 取得項目圖示
    getItemIcon: function(item) {
        if (item.is_parent) {
            return 'fa-arrow-left';
        } else if (item.type === 'directory') {
            return 'fa-folder';
        } else {
            return utils.getFileIcon(item.name);
        }
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 路徑輸入框 Enter 鍵
        $('#path-input').on('keypress', (e) => {
            if (e.which === 13) {
                this.navigateToPath();
            }
        });
        
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
        });
    },
    
    // 選擇特定類型的檔案
    selectFilesByType: function(extension) {
        $('.file-item[data-type="file"]').each(function() {
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
        $('.file-item[data-type="file"]').each(function() {
            const checkbox = $(this).find('input[type="checkbox"]');
            checkbox.prop('checked', !checkbox.prop('checked'));
            checkbox.trigger('change');
        });
        
        utils.showAlert('✅ 已反向選擇', 'success');
    }
};