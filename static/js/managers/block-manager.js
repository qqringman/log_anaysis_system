// Enhanced Log 分析平台 v6 - 區塊管理器
// static/js/managers/block-manager.js

window.blockManager = {
    init: function() {
        console.log('📦 初始化區塊管理器');
        
        // 載入最小化的區塊
        this.loadMinimizedBlocks();
        
        // 設置區塊相關的事件監聽器
        this.setupEventListeners();
    },
    
    // 最小化區塊
    minimizeBlock: function(blockId, blockName) {
        console.log('📦 最小化區塊:', blockId);
        
        const block = $(`#${blockId}`);
        if (!block.length) return;
        
        // 隱藏區塊
        block.hide('fade', 300);
        
        // 添加到最小化集合
        appConfig.state.minimizedBlocks.add(blockId);
        
        // 創建最小化圖標
        const minimizedContainer = $('#minimized-blocks');
        const minimizedItem = $(`
            <div class="minimized-block animate__animated animate__fadeInUp" 
                 data-block="${blockId}" 
                 title="點擊恢復: ${blockName}">
                <i class="fas fa-window-restore"></i>
                <span>${blockName}</span>
            </div>
        `);
        
        // 添加點擊事件
        minimizedItem.on('click', () => {
            this.restoreBlock(blockId);
        });
        
        minimizedContainer.append(minimizedItem);
        
        // 儲存狀態
        this.saveMinimizedState();
        
        utils.showAlert(`📦 已最小化: ${blockName}`, 'info', 2000);
        utils.playNotificationSound('notification');
    },
    
    // 恢復區塊
    restoreBlock: function(blockId) {
        console.log('📦 恢復區塊:', blockId);
        
        const block = $(`#${blockId}`);
        if (!block.length) return;
        
        // 顯示區塊
        block.show('fade', 300);
        
        // 從最小化集合移除
        appConfig.state.minimizedBlocks.delete(blockId);
        
        // 從最小化容器移除圖標
        $(`.minimized-block[data-block="${blockId}"]`).fadeOut(300, function() {
            $(this).remove();
        });
        
        // 儲存狀態
        this.saveMinimizedState();
        
        // 滾動到區塊
        setTimeout(() => {
            utils.scrollToElement(`#${blockId}`, 100);
        }, 350);
        
        utils.playNotificationSound('success');
    },
    
    // 恢復所有區塊
    restoreAllBlocks: function() {
        const minimizedBlocks = Array.from(appConfig.state.minimizedBlocks);
        
        minimizedBlocks.forEach(blockId => {
            this.restoreBlock(blockId);
        });
        
        if (minimizedBlocks.length > 0) {
            utils.showAlert('✅ 已恢復所有區塊', 'success');
        }
    },
    
    // 切換區塊顯示狀態
    toggleBlock: function(blockId) {
        const block = $(`#${blockId}`);
        if (!block.length) return;
        
        if (block.is(':visible')) {
            const blockName = block.find('h4').first().text().trim();
            this.minimizeBlock(blockId, blockName);
        } else {
            this.restoreBlock(blockId);
        }
    },
    
    // 儲存最小化狀態
    saveMinimizedState: function() {
        const minimizedArray = Array.from(appConfig.state.minimizedBlocks);
        utils.saveLocal('minimizedBlocks', minimizedArray);
    },
    
    // 載入最小化的區塊
    loadMinimizedBlocks: function() {
        const savedMinimized = utils.loadLocal('minimizedBlocks', []);
        
        // 清空已儲存的最小化狀態，讓所有區塊預設顯示
        utils.clearLocal('minimizedBlocks');
        
        console.log('📂 已清除最小化區塊設定，所有區塊將顯示');
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 雙擊標題最小化
        $('.dashboard-block .card-body > h4, .dashboard-block .card-body > h3').on('dblclick', function(e) {
            e.preventDefault();
            const blockId = $(this).closest('.dashboard-block').attr('id');
            const blockName = $(this).text().trim();
            blockManager.minimizeBlock(blockId, blockName);
        });
        
        // 右鍵選單
        $('.dashboard-block').on('contextmenu', function(e) {
            e.preventDefault();
            const blockId = $(this).attr('id');
            blockManager.showBlockContextMenu(e, blockId);
        });
    },
    
    // 顯示區塊右鍵選單
    showBlockContextMenu: function(event, blockId) {
        // 移除現有選單
        $('.block-context-menu').remove();
        
        const block = $(`#${blockId}`);
        const blockName = block.find('h4, h3').first().text().trim();
        
        const menu = $(`
            <div class="block-context-menu dropdown-menu show" style="position: fixed; z-index: 1100;">
                <h6 class="dropdown-header">${blockName}</h6>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item" href="#" data-action="minimize">
                    <i class="fas fa-window-minimize me-2"></i>最小化
                </a>
                <a class="dropdown-item" href="#" data-action="duplicate">
                    <i class="fas fa-clone me-2"></i>複製區塊
                </a>
                <a class="dropdown-item" href="#" data-action="export">
                    <i class="fas fa-download me-2"></i>匯出設定
                </a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item text-danger" href="#" data-action="remove">
                    <i class="fas fa-trash me-2"></i>移除區塊
                </a>
            </div>
        `);
        
        // 定位選單
        menu.css({
            left: event.pageX,
            top: event.pageY
        });
        
        // 添加到頁面
        $('body').append(menu);
        
        // 處理選單項目點擊
        menu.find('a').on('click', function(e) {
            e.preventDefault();
            const action = $(this).data('action');
            
            switch (action) {
                case 'minimize':
                    blockManager.minimizeBlock(blockId, blockName);
                    break;
                case 'duplicate':
                    blockManager.duplicateBlock(blockId);
                    break;
                case 'export':
                    blockManager.exportBlockConfig(blockId);
                    break;
                case 'remove':
                    blockManager.removeBlock(blockId);
                    break;
            }
            
            menu.remove();
        });
        
        // 點擊其他地方關閉選單
        $(document).one('click', function() {
            menu.remove();
        });
    },
    
    // 複製區塊
    duplicateBlock: function(blockId) {
        const originalBlock = $(`#${blockId}`);
        if (!originalBlock.length) return;
        
        const newId = utils.generateId('block');
        const clonedBlock = originalBlock.clone();
        
        // 更新ID
        clonedBlock.attr('id', newId);
        
        // 更新標題
        const title = clonedBlock.find('h4, h3').first();
        title.text(title.text() + ' (複製)');
        
        // 插入到原區塊後面
        originalBlock.after(clonedBlock);
        
        // 重新初始化拖動功能
        if (appConfig.state.currentLayout === 'default') {
            layoutManager.initDraggable();
        }
        
        utils.showAlert('✅ 區塊已複製', 'success');
    },
    
    // 匯出區塊配置
    exportBlockConfig: function(blockId) {
        const block = $(`#${blockId}`);
        if (!block.length) return;
        
        const config = {
            blockId: blockId,
            blockName: block.find('h4, h3').first().text().trim(),
            html: block.html(),
            css: {
                position: block.css('position'),
                top: block.css('top'),
                left: block.css('left'),
                width: block.css('width'),
                height: block.css('height')
            },
            timestamp: new Date().toISOString()
        };
        
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `block_${blockId}_${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        utils.showAlert('✅ 區塊配置已匯出', 'success');
    },
    
    // 移除區塊
    removeBlock: function(blockId) {
        if (!confirm('確定要移除此區塊嗎？此操作無法復原。')) return;
        
        const block = $(`#${blockId}`);
        if (!block.length) return;
        
        // 移除區塊
        block.fadeOut(300, function() {
            $(this).remove();
        });
        
        // 從最小化集合移除
        appConfig.state.minimizedBlocks.delete(blockId);
        $(`.minimized-block[data-block="${blockId}"]`).remove();
        
        // 儲存狀態
        this.saveMinimizedState();
        layoutManager.saveDashboardLayout();
        
        utils.showAlert('✅ 區塊已移除', 'success');
    },
    
    // 獲取區塊統計
    getBlockStats: function() {
        const totalBlocks = $('.dashboard-block').length;
        const visibleBlocks = $('.dashboard-block:visible').length;
        const minimizedBlocks = appConfig.state.minimizedBlocks.size;
        
        return {
            total: totalBlocks,
            visible: visibleBlocks,
            minimized: minimizedBlocks,
            hidden: totalBlocks - visibleBlocks - minimizedBlocks
        };
    }
};