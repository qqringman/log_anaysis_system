// Enhanced Log 分析平台 v6 - 佈局管理器
// static/js/managers/layout-manager.js

window.layoutManager = {
    init: function() {
        console.log('🎨 初始化佈局管理器');
        
        // 載入儲存的佈局
        this.loadSavedLayout();
        
        // 初始化拖動功能
        this.initDraggable();
        
        // 綁定鍵盤快捷鍵
        this.bindKeyboardShortcuts();
    },
    
    // 初始化拖動功能
    initDraggable: function() {
        console.log('🔧 初始化拖動功能');
        
        const currentLayout = appConfig.state.currentLayout;
        
        if (currentLayout === 'default') {
            // 啟用拖動功能
            $('.dashboard-block').draggable({
                handle: '.drag-handle',
                revert: 'invalid',
                containment: 'parent',
                start: function(event, ui) {
                    $(this).addClass('ui-draggable-dragging');
                },
                stop: function(event, ui) {
                    $(this).removeClass('ui-draggable-dragging');
                    layoutManager.saveDashboardLayout();
                }
            });
            
            // 使容器可排序
            $('#dashboard-container').sortable({
                items: '.dashboard-block',
                handle: '.drag-handle',
                placeholder: 'ui-sortable-placeholder',
                tolerance: 'pointer',
                forcePlaceholderSize: true,
                revert: 300,
                update: function(event, ui) {
                    layoutManager.saveDashboardLayout();
                }
            });
            
            // 啟用 drop zone
            $('#dashboard-container').droppable({
                accept: '.dashboard-block',
                tolerance: 'pointer'
            });
        }
    },
    
    // 設置佈局
    setLayout: function(layout) {
        console.log('🔄 切換佈局:', layout);
        
        appConfig.state.currentLayout = layout;
        const container = $('#dashboard-container');
        
        // 移除所有佈局類別
        container.removeClass('layout-default layout-grid layout-masonry');
        
        // 添加新的佈局類別
        container.addClass(`layout-${layout}`);
        
        // 更新按鈕狀態
        $('.layout-btn').removeClass('active');
        $(`.layout-btn[data-layout="${layout}"]`).addClass('active');
        
        // 更新滑動背景位置
        this.updateLayoutSlider();
        
        // 根據佈局類型重新初始化拖動功能
        if (layout === 'default') {
            // 銷毀現有的拖動功能
            if ($('.dashboard-block').data('ui-draggable')) {
                $('.dashboard-block').draggable('destroy');
            }
            if (container.data('ui-sortable')) {
                container.sortable('destroy');
            }
            
            // 重新初始化拖動功能
            setTimeout(() => {
                this.initDraggable();
            }, 100);
        } else {
            // 其他佈局禁用拖動
            if ($('.dashboard-block').data('ui-draggable')) {
                $('.dashboard-block').draggable('destroy');
            }
            if (container.data('ui-sortable')) {
                container.sortable('destroy');
            }
        }
        
        // 儲存佈局設定
        utils.saveLocal('currentLayout', layout);
        
        utils.showAlert(`🔄 已切換到${layout === 'default' ? '預設' : layout === 'grid' ? '網格' : '瀑布流'}佈局`, 'info');
    },
    
    // 更新佈局滑動背景
    updateLayoutSlider: function() {
        const activeBtn = $('.layout-btn.active');
        const slider = $('.layout-slider');
        
        if (activeBtn.length && slider.length) {
            const btnWidth = activeBtn.outerWidth();
            const btnLeft = activeBtn.position().left;
            
            slider.css({
                width: btnWidth + 'px',
                left: btnLeft + 'px'
            });
        }
    },
    
    // 設置設備視圖
    setDeviceView: function(device) {
        if (device === 'mobile') {
            $('body').addClass('mobile-view');
            // 調整視口
            $('meta[name="viewport"]').attr('content', 'width=375, initial-scale=1.0');
            utils.showAlert('📱 已切換到手機視圖', 'info');
        } else {
            $('body').removeClass('mobile-view');
            // 恢復視口
            $('meta[name="viewport"]').attr('content', 'width=device-width, initial-scale=1.0');
            utils.showAlert('💻 已切換到桌面視圖', 'info');
        }
        
        // 儲存設定
        utils.saveLocal('deviceView', device);
    },
    
    // 儲存儀表板佈局
    saveDashboardLayout: function() {
        const layout = [];
        $('.dashboard-block').each(function(index) {
            const block = $(this);
            layout.push({
                id: block.attr('id'),
                order: index,
                position: {
                    top: block.css('top'),
                    left: block.css('left')
                }
            });
        });
        
        utils.saveLocal('dashboardLayout', layout);
        console.log('💾 佈局已儲存');
    },
    
    // 載入儲存的佈局
    loadSavedLayout: function() {
        // 載入佈局類型
        const savedLayout = utils.loadLocal('currentLayout', 'default');
        if (savedLayout !== 'default') {
            this.setLayout(savedLayout);
        }
        
        // 載入手機視圖設定
        const mobileView = utils.loadLocal('mobileView', false);
        if (mobileView) {
            $('#mobile-view-toggle').prop('checked', true);
            this.toggleMobileView();
        }
        
        // 載入區塊順序和位置
        const dashboardLayout = utils.loadLocal('dashboardLayout');
        if (dashboardLayout && appConfig.state.currentLayout === 'default') {
            const container = $('#dashboard-container');
            
            // 按照儲存的順序重新排列區塊
            dashboardLayout.forEach(item => {
                const block = $(`#${item.id}`);
                if (block.length) {
                    container.append(block);
                    
                    // 恢復位置（如果有）
                    if (item.position && item.position.top !== 'auto') {
                        block.css({
                            position: 'relative',
                            top: item.position.top,
                            left: item.position.left
                        });
                    }
                }
            });
        }
        
        console.log('📂 佈局載入完成');
    },
    
    // 重置佈局
    resetLayout: function() {
        if (confirm('確定要重置佈局嗎？這將清除所有自定義設定。')) {
            // 清除儲存的佈局
            utils.clearLocal('dashboardLayout');
            utils.clearLocal('currentLayout');
            utils.clearLocal('mobileView');
            
            // 重新載入頁面
            location.reload();
        }
    },
    
    // 匯出佈局配置
    exportLayout: function() {
        const config = {
            version: appConfig.version,
            layout: appConfig.state.currentLayout,
            mobileView: $('#mobile-view-toggle').is(':checked'),
            blocks: []
        };
        
        $('.dashboard-block').each(function() {
            const block = $(this);
            config.blocks.push({
                id: block.attr('id'),
                visible: block.is(':visible'),
                minimized: appConfig.state.minimizedBlocks.has(block.attr('id'))
            });
        });
        
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `layout_config_${new Date().getTime()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        utils.showAlert('✅ 佈局配置已匯出', 'success');
    },
    
    // 匯入佈局配置
    importLayout: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    
                    // 驗證配置
                    if (!config.version || !config.layout) {
                        throw new Error('無效的配置檔案');
                    }
                    
                    // 應用配置
                    this.setLayout(config.layout);
                    
                    if (config.mobileView) {
                        $('#mobile-view-toggle').prop('checked', true);
                        this.toggleMobileView();
                    }
                    
                    // 恢復區塊狀態
                    config.blocks.forEach(blockConfig => {
                        const block = $(`#${blockConfig.id}`);
                        if (block.length) {
                            if (blockConfig.minimized) {
                                blockManager.minimizeBlock(blockConfig.id, block.find('h4').text());
                            } else if (!blockConfig.visible) {
                                block.hide();
                            }
                        }
                    });
                    
                    utils.showAlert('✅ 佈局配置已匯入', 'success');
                    
                } catch (error) {
                    utils.showAlert('❌ 匯入失敗：' + error.message, 'danger');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    },
    
    // 全螢幕模式
    toggleFullscreen: function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            utils.showAlert('🖥️ 進入全螢幕模式', 'info');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                utils.showAlert('🖥️ 退出全螢幕模式', 'info');
            }
        }
    },
    
    // 綁定鍵盤快捷鍵
    bindKeyboardShortcuts: function() {
        $(document).on('keydown', function(e) {
            // F11 - 全螢幕
            if (e.which === 122) {
                e.preventDefault();
                layoutManager.toggleFullscreen();
            }
            
            // Ctrl + L - 切換佈局
            if (e.ctrlKey && e.which === 76) {
                e.preventDefault();
                const layouts = ['default', 'grid', 'masonry'];
                const currentIndex = layouts.indexOf(appConfig.state.currentLayout);
                const nextLayout = layouts[(currentIndex + 1) % layouts.length];
                layoutManager.setLayout(nextLayout);
            }
            
            // Ctrl + M - 切換手機視圖
            if (e.ctrlKey && e.which === 77) {
                e.preventDefault();
                $('#mobile-view-toggle').prop('checked', !$('#mobile-view-toggle').is(':checked'));
                layoutManager.toggleMobileView();
            }
        });
    }
};