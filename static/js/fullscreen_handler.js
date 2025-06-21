// 全屏功能處理器
class FullscreenHandler {
    constructor() {
        this.isFullscreen = false;
        this.fullscreenElement = null;
        this.originalParent = null;
        this.init();
    }

    init() {
        // 監聽全屏變化事件
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());

        // 監聽 ESC 鍵
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });
    }

    // 切換全屏
    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    // 進入全屏
    enterFullscreen() {
        let elementToFullscreen = null;
        
        if (window.splitView) {
            // 分割視窗模式，檢查焦點
            const activeElement = document.activeElement;
            const leftPane = document.getElementById('split-left');
            const rightPane = document.getElementById('split-right');
            
            if (leftPane && leftPane.contains(activeElement)) {
                elementToFullscreen = leftPane;
            } else if (rightPane && rightPane.contains(activeElement)) {
                elementToFullscreen = rightPane;
            } else {
                // 預設使用左側
                elementToFullscreen = leftPane || document.getElementById('file-viewer');
            }
        } else {
            // 一般模式，使用整個檢視器
            elementToFullscreen = document.getElementById('file-viewer');
        }

        if (elementToFullscreen) {
            this.requestFullscreen(elementToFullscreen);
        }
    }

    // 請求全屏
    requestFullscreen(element) {
        // 創建全屏容器
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.className = 'fullscreen-container';
        fullscreenContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 9999;
            display: flex;
            flex-direction: column;
        `;

        // 創建頂部工具列
        const toolbar = document.createElement('div');
        toolbar.className = 'fullscreen-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        // 標題
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; color: #333;';
        
        // 檢查是否為分割視窗模式
        if (window.splitView) {
            const pane = element.id.includes('left') ? '左側' : '右側';
            const paneTitle = document.getElementById(`split-${pane}-title`);
            const fileName = paneTitle ? paneTitle.textContent : pane + '視窗';
            title.textContent = `全屏模式 - ${fileName}`;
        } else {
            // 嘗試獲取當前檔案名稱
            const viewerContainer = document.getElementById('file-viewer');
            if (viewerContainer) {
                // 從標籤頁獲取當前檔案名稱
                const activeTab = document.querySelector('.file-tab.active .tab-title');
                const fileName = activeTab ? activeTab.textContent : '檔案';
                title.textContent = `全屏模式 - ${fileName}`;
            } else {
                title.textContent = '全屏模式';
            }
        }
        toolbar.appendChild(title);

        // 退出按鈕
        const exitBtn = document.createElement('button');
        exitBtn.className = 'fullscreen-exit-btn';
        exitBtn.innerHTML = '<i class="fas fa-compress"></i> 退出全屏 (ESC)';
        exitBtn.onclick = () => this.exitFullscreen();
        exitBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #ddd;
            background: #667eea;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        `;

        // 添加 hover 效果
        exitBtn.onmouseover = () => {
            exitBtn.style.background = '#5968d9';
            exitBtn.style.transform = 'translateY(-1px)';
            exitBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
        };

        exitBtn.onmouseout = () => {
            exitBtn.style.background = '#667eea';
            exitBtn.style.transform = 'translateY(0)';
            exitBtn.style.boxShadow = 'none';
        };

        toolbar.appendChild(exitBtn);

        fullscreenContainer.appendChild(toolbar);

        // 內容區域
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = 'flex: 1; overflow: hidden; position: relative;';
        
        // 保存原始父元素
        this.originalParent = element.parentNode;
        this.fullscreenElement = element;
        
        // 移動元素到全屏容器
        contentWrapper.appendChild(element);
        fullscreenContainer.appendChild(contentWrapper);
        document.body.appendChild(fullscreenContainer);

        // 設置全屏樣式
        element.style.width = '100%';
        element.style.height = '100%';

        this.isFullscreen = true;
        this.fullscreenContainer = fullscreenContainer;

        // 使用瀏覽器原生全屏 API（如果支援）
        if (fullscreenContainer.requestFullscreen) {
            fullscreenContainer.requestFullscreen();
        } else if (fullscreenContainer.webkitRequestFullscreen) {
            fullscreenContainer.webkitRequestFullscreen();
        } else if (fullscreenContainer.mozRequestFullScreen) {
            fullscreenContainer.mozRequestFullScreen();
        } else if (fullscreenContainer.msRequestFullscreen) {
            fullscreenContainer.msRequestFullscreen();
        }

        window.showToast('已進入全屏模式，按 ESC 退出', 'info');
    }

    // 退出全屏
    exitFullscreen() {
        if (!this.isFullscreen) return;

        // 退出瀏覽器全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        // 恢復元素
        if (this.fullscreenElement && this.originalParent) {
            this.originalParent.appendChild(this.fullscreenElement);
            this.fullscreenElement.style.width = '';
            this.fullscreenElement.style.height = '';
        }

        // 移除全屏容器
        if (this.fullscreenContainer) {
            this.fullscreenContainer.remove();
        }

        this.isFullscreen = false;
        this.fullscreenElement = null;
        this.originalParent = null;
        this.fullscreenContainer = null;

        window.showToast('已退出全屏模式', 'info');
    }

    // 處理全屏狀態變化
    handleFullscreenChange() {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            // 瀏覽器退出全屏，確保清理
            if (this.isFullscreen) {
                this.exitFullscreen();
            }
        }
    }
}

// 初始化全屏處理器
window.fullscreenHandler = new FullscreenHandler();

// 全局函數
window.toggleFullscreen = function() {
    window.fullscreenHandler.toggleFullscreen();
};