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
        // 添加樣式
        this.addStyles();        
    }

    addStyles() {
        if (document.getElementById('fullscreen-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'fullscreen-styles';
        style.innerHTML = `
            .fullscreen-toolbar-wrapper {
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            
            .fullscreen-mobile-show-btn {
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .fullscreen-mobile-show-btn:active {
                transform: scale(0.95);
            }
            
            /* 手機版優化 */
            @media (max-width: 768px) {
                .fullscreen-toolbar {
                    padding: 8px 15px !important;
                }
                
                .fullscreen-toolbar > div:first-child {
                    font-size: 13px !important;
                }
                
                .fullscreen-toolbar button {
                    font-size: 13px !important;
                    padding: 5px 12px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 切換全屏
    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    // 分割視窗專用的全屏切換
    togglePaneFullscreen(pane) {
        if (!window.splitView) {
            window.showToast('請先開啟分割視窗模式', 'error');
            return;
        }
        
        // 記錄當前是哪個面板要全屏
        this.currentPane = pane;
        if (!this.isFullscreen) {
            this.enterPaneFullscreen(pane);
        } else {
            this.exitFullscreen();
        }
    }

    // 進入分割視窗全屏
    enterPaneFullscreen(pane) {
        const paneElement = document.getElementById(`split-${pane}`);
        if (!paneElement) {
            window.showToast('找不到指定的視窗', 'error');
            return;
        }
        
        // 只複製 pane 的內容，而不是移動整個 pane
        const paneContent = paneElement.querySelector('.split-pane-content');
        const paneToolbar = paneElement.querySelector('.split-pane-toolbar');
        
        if (!paneContent) {
            window.showToast('找不到視窗內容', 'error');
            return;
        }
        
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

        // 創建頂部工具列容器
        const toolbarWrapper = document.createElement('div');
        toolbarWrapper.className = 'fullscreen-toolbar-wrapper';
        toolbarWrapper.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10001;
            transform: translateY(0);
            transition: transform 0.3s ease;
        `;

        // 創建觸發區域
        const triggerArea = document.createElement('div');
        triggerArea.className = 'fullscreen-trigger-area';
        triggerArea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 10px;
            z-index: 10002;
            cursor: ns-resize;
        `;

        // 創建頂部工具列
        const toolbar = document.createElement('div');
        toolbar.className = 'fullscreen-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 20px;
            background: rgba(248, 249, 250, 0.95);
            border-bottom: 1px solid #e0e0e0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        `;

        // 標題 - 使用分割視窗的標題
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; color: #333; font-size: 14px;';
        const paneTitle = document.getElementById(`split-${pane}-title`);
        const fileName = paneTitle ? paneTitle.textContent : `${pane === 'left' ? '左側' : '右側'}視窗`;
        title.textContent = `全屏模式 - ${fileName}`;
        toolbar.appendChild(title);

        // 退出按鈕
        const exitBtn = document.createElement('button');
        exitBtn.innerHTML = '<i class="fas fa-compress"></i> 退出全屏 (ESC)';
        exitBtn.onclick = () => this.exitFullscreen();
        exitBtn.style.cssText = `
            padding: 6px 16px;
            border-radius: 8px;
            border: 2px solid #dc3545;
            background: #dc3545;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            min-height: 32px;
        `;

        exitBtn.onmouseover = () => {
            exitBtn.style.background = '#c82333';
            exitBtn.style.borderColor = '#c82333';
        };

        exitBtn.onmouseout = () => {
            exitBtn.style.background = '#dc3545';
            exitBtn.style.borderColor = '#dc3545';
        };

        toolbar.appendChild(exitBtn);
        toolbarWrapper.appendChild(toolbar);

        // 創建內容包裝器
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = 'flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column;';
        
        // 複製原本的 pane 結構
        const fullscreenPane = document.createElement('div');
        fullscreenPane.className = 'split-pane fullscreen-pane';
        fullscreenPane.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column;';
        
        // 複製工具列
        if (paneToolbar) {
            const clonedToolbar = paneToolbar.cloneNode(true);
            fullscreenPane.appendChild(clonedToolbar);
        }
        
        // 複製內容區域
        const clonedContent = paneContent.cloneNode(true);
        clonedContent.style.flex = '1';
        fullscreenPane.appendChild(clonedContent);
        
        contentWrapper.appendChild(fullscreenPane);

        // 手機版的顯示工具列按鈕
        const mobileShowBtn = document.createElement('button');
        mobileShowBtn.className = 'fullscreen-mobile-show-btn';
        mobileShowBtn.innerHTML = '<i class="fas fa-angle-down"></i>';
        mobileShowBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            border: none;
            font-size: 20px;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        // 保存原始元素和父元素
        this.originalPane = paneElement;
        this.originalContent = paneContent;
        this.fullscreenElement = fullscreenPane;
        
        // 隱藏原始內容
        paneElement.style.visibility = 'hidden';
        
        // 組裝全屏容器
        fullscreenContainer.appendChild(toolbarWrapper);
        fullscreenContainer.appendChild(triggerArea);
        fullscreenContainer.appendChild(contentWrapper);
        fullscreenContainer.appendChild(mobileShowBtn);
        document.body.appendChild(fullscreenContainer);

        this.isFullscreen = true;
        this.fullscreenContainer = fullscreenContainer;

        // 自動隱藏工具列的函數
        let hideTimeout;
        let isToolbarVisible = true;

        const hideToolbar = () => {
            toolbarWrapper.style.transform = 'translateY(-100%)';
            isToolbarVisible = false;
            
            if (window.innerWidth <= 768) {
                mobileShowBtn.style.display = 'flex';
            }
        };

        const showToolbar = () => {
            toolbarWrapper.style.transform = 'translateY(0)';
            isToolbarVisible = true;
            mobileShowBtn.style.display = 'none';
            
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideToolbar, 3000);
        };

        // 設置自動隱藏
        hideTimeout = setTimeout(hideToolbar, 3000);

        // 滑鼠事件（桌面版）
        if (window.innerWidth > 768) {
            triggerArea.addEventListener('mouseenter', showToolbar);
            
            toolbarWrapper.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
            });
            
            toolbarWrapper.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(hideToolbar, 3000);
            });
        }

        // 手機版事件
        mobileShowBtn.addEventListener('click', showToolbar);

        // 觸控事件（手機版）
        if (window.innerWidth <= 768) {
            let touchStartY = 0;
            
            contentWrapper.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            });
            
            contentWrapper.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchStartY;
                
                if (deltaY > 50 && touchStartY < 100 && !isToolbarVisible) {
                    showToolbar();
                }
            });
        }

        // 使用瀏覽器原生全屏 API
        if (fullscreenContainer.requestFullscreen) {
            fullscreenContainer.requestFullscreen();
        } else if (fullscreenContainer.webkitRequestFullscreen) {
            fullscreenContainer.webkitRequestFullscreen();
        } else if (fullscreenContainer.mozRequestFullScreen) {
            fullscreenContainer.mozRequestFullScreen();
        } else if (fullscreenContainer.msRequestFullscreen) {
            fullscreenContainer.msRequestFullscreen();
        }

        window.showToast(`已進入${pane === 'left' ? '左側' : '右側'}視窗全屏模式，按 ESC 退出`, 'info');
        
        // 更新分割視窗工具列的圖標
        const paneToolbarBtn = paneElement.querySelector('.split-pane-btn[onclick*="togglePaneFullscreen"]');
        if (paneToolbarBtn) {
            const icon = paneToolbarBtn.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-compress-arrows-alt';
            }
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

        // 創建頂部工具列容器（用於動畫）
        const toolbarWrapper = document.createElement('div');
        toolbarWrapper.className = 'fullscreen-toolbar-wrapper';
        toolbarWrapper.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10001;
            transform: translateY(0);
            transition: transform 0.3s ease;
        `;

        // 創建觸發區域（隱藏的，在頂部）
        const triggerArea = document.createElement('div');
        triggerArea.className = 'fullscreen-trigger-area';
        triggerArea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 10px;
            z-index: 10002;
            cursor: ns-resize;
        `;

        // 創建頂部工具列
        const toolbar = document.createElement('div');
        toolbar.className = 'fullscreen-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 20px;
            background: rgba(248, 249, 250, 0.95);
            border-bottom: 1px solid #e0e0e0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        `;

        // 標題
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; color: #333; font-size: 14px;';
        
        // 檢查是否為分割視窗模式
        if (window.splitView) {
            const pane = element.id.includes('left') ? '左側' : '右側';
            const paneTitle = document.getElementById(`split-${pane}-title`);
            const fileName = paneTitle ? paneTitle.textContent : pane + '視窗';
            title.textContent = `全屏模式 - ${fileName}`;
        } else {
            // 從標籤頁獲取當前檔案名稱
            const activeTab = document.querySelector('.file-tab.active .tab-title');
            const fileName = activeTab ? activeTab.textContent : '檔案';
            title.textContent = `全屏模式 - ${fileName}`;
        }
        toolbar.appendChild(title);

        // 退出按鈕
        const exitBtn = document.createElement('button');
        exitBtn.innerHTML = '<i class="fas fa-compress"></i> 退出全屏 (ESC)';
        exitBtn.onclick = () => this.exitFullscreen();
        exitBtn.style.cssText = `
            padding: 6px 16px;
            border-radius: 8px;
            border: 2px solid #dc3545;
            background: #dc3545;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            min-height: 32px;
        `;

        // 添加 hover 效果
        exitBtn.onmouseover = () => {
            exitBtn.style.background = '#c82333';
            exitBtn.style.borderColor = '#c82333';
        };

        exitBtn.onmouseout = () => {
            exitBtn.style.background = '#dc3545';
            exitBtn.style.borderColor = '#dc3545';
        };

        toolbar.appendChild(exitBtn);
        toolbarWrapper.appendChild(toolbar);

        // 內容區域
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = 'flex: 1; overflow: hidden; position: relative;';
        
        // 手機版的顯示工具列按鈕
        const mobileShowBtn = document.createElement('button');
        mobileShowBtn.className = 'fullscreen-mobile-show-btn';
        mobileShowBtn.innerHTML = '<i class="fas fa-angle-down"></i>';
        mobileShowBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            border: none;
            font-size: 20px;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        // 保存原始父元素
        this.originalParent = element.parentNode;
        this.fullscreenElement = element;
        
        // 移動元素到全屏容器
        contentWrapper.appendChild(element);
        fullscreenContainer.appendChild(toolbarWrapper);
        fullscreenContainer.appendChild(triggerArea);
        fullscreenContainer.appendChild(contentWrapper);
        fullscreenContainer.appendChild(mobileShowBtn);
        document.body.appendChild(fullscreenContainer);

        // 設置全屏樣式
        element.style.width = '100%';
        element.style.height = '100%';

        this.isFullscreen = true;
        this.fullscreenContainer = fullscreenContainer;

        // 自動隱藏工具列的函數
        let hideTimeout;
        let isToolbarVisible = true;

        const hideToolbar = () => {
            toolbarWrapper.style.transform = 'translateY(-100%)';
            isToolbarVisible = false;
            
            // 手機版顯示下拉按鈕
            if (window.innerWidth <= 768) {
                mobileShowBtn.style.display = 'flex';
            }
        };

        const showToolbar = () => {
            toolbarWrapper.style.transform = 'translateY(0)';
            isToolbarVisible = true;
            mobileShowBtn.style.display = 'none';
            
            // 重置自動隱藏計時器
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideToolbar, 3000);
        };

        // 設置自動隱藏
        hideTimeout = setTimeout(hideToolbar, 3000);

        // 滑鼠事件（桌面版）
        if (window.innerWidth > 768) {
            // 滑鼠移到頂部觸發區域時顯示工具列
            triggerArea.addEventListener('mouseenter', showToolbar);
            
            // 滑鼠在工具列上時保持顯示
            toolbarWrapper.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
            });
            
            // 滑鼠離開工具列時重新計時
            toolbarWrapper.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(hideToolbar, 3000);
            });
        }

        // 手機版事件
        mobileShowBtn.addEventListener('click', showToolbar);

        // 觸控事件（手機版）
        if (window.innerWidth <= 768) {
            let touchStartY = 0;
            
            contentWrapper.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            });
            
            contentWrapper.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - touchStartY;
                
                // 從頂部向下滑動超過 50px 時顯示工具列
                if (deltaY > 50 && touchStartY < 100 && !isToolbarVisible) {
                    showToolbar();
                }
            });
        }

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

        // 恢復原始 pane 的可見性
        if (this.originalPane) {
            this.originalPane.style.visibility = '';
        }

        // 移除全屏容器
        if (this.fullscreenContainer) {
            this.fullscreenContainer.remove();
        }

        // 恢復分割視窗工具列的圖標
        if (this.currentPane && this.originalPane) {
            const paneToolbarBtn = this.originalPane.querySelector('.split-pane-btn[onclick*="togglePaneFullscreen"]');
            if (paneToolbarBtn) {
                const icon = paneToolbarBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-maximize';
                }
            }
            this.currentPane = null;
        }

        this.isFullscreen = false;
        this.fullscreenElement = null;
        this.originalPane = null;
        this.originalContent = null;
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

window.togglePaneFullscreen = function(pane) {
    window.fullscreenHandler.togglePaneFullscreen(pane);
};