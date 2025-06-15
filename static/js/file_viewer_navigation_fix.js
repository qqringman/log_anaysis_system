// Enhanced File Viewer Navigation History Fix v2
// 修復返回和前進功能，保留完整的瀏覽歷史

(function() {
    'use strict';
    
    // 導航歷史管理器
    const NavigationManager = {
        // 使用 sessionStorage 儲存完整的導航歷史
        STORAGE_KEY: 'fileViewerNavHistory',
        CURRENT_INDEX_KEY: 'fileViewerNavIndex',
        MAX_HISTORY_SIZE: 50, // 最大歷史記錄數
        isNavigating: false, // 標記是否正在進行導航
        
        // 初始化
        init: function() {
            this.loadHistory();
            this.checkAndUpdateCurrentPage();
            this.updateNavigationButtons();
            this.setupEventListeners();
        },
        
        // 載入歷史記錄
        loadHistory: function() {
            const savedHistory = sessionStorage.getItem(this.STORAGE_KEY);
            const savedIndex = sessionStorage.getItem(this.CURRENT_INDEX_KEY);
            
            if (savedHistory) {
                try {
                    window.navigationHistory = JSON.parse(savedHistory);
                    window.historyIndex = parseInt(savedIndex) || 0;
                } catch (e) {
                    console.error('載入導航歷史失敗:', e);
                    this.resetHistory();
                }
            } else {
                this.resetHistory();
            }
        },
        
        // 重置歷史記錄
        resetHistory: function() {
            window.navigationHistory = [];
            window.historyIndex = -1;
        },
        
        // 檢查並更新當前頁面
        checkAndUpdateCurrentPage: function() {
            const currentUrl = window.location.href;
            const urlParams = new URLSearchParams(window.location.search);
            
            // 建立當前頁面的記錄
            const pageInfo = {
                url: currentUrl,
                line: parseInt(urlParams.get('line')) || currentTargetLine,
                startLine: currentStartLine,
                endLine: currentEndLine,
                timestamp: Date.now(),
                title: document.title,
                filePath: currentFilePath
            };
            
            // 檢查是否是導航操作（從歷史中跳轉）
            const isNavAction = urlParams.get('nav_action') === 'true';
            
            if (isNavAction) {
                // 如果是導航操作，不需要添加新記錄，只需更新索引
                this.saveToStorage();
            } else {
                // 檢查當前 URL 是否已在當前索引位置
                if (window.historyIndex >= 0 && 
                    window.historyIndex < window.navigationHistory.length &&
                    window.navigationHistory[window.historyIndex].url === currentUrl) {
                    // URL 相同，不需要添加
                    return;
                }
                
                // 如果不是在歷史末尾，需要處理分支
                if (window.historyIndex < window.navigationHistory.length - 1) {
                    // 保留到當前位置的歷史，刪除後面的
                    window.navigationHistory = window.navigationHistory.slice(0, window.historyIndex + 1);
                }
                
                // 添加新頁面到歷史
                this.addToHistory(pageInfo);
            }
            
            this.saveToStorage();
            this.updateNavigationButtons();
        },
        
        // 添加到歷史記錄
        addToHistory: function(pageInfo) {
            // 檢查是否與最後一條記錄相同
            const lastItem = window.navigationHistory[window.navigationHistory.length - 1];
            if (lastItem && lastItem.url === pageInfo.url) {
                return; // 不添加重複的記錄
            }
            
            // 添加新記錄
            window.navigationHistory.push(pageInfo);
            window.historyIndex = window.navigationHistory.length - 1;
            
            // 限制歷史大小
            if (window.navigationHistory.length > this.MAX_HISTORY_SIZE) {
                window.navigationHistory.shift();
                window.historyIndex = Math.max(0, window.historyIndex - 1);
            }
        },
        
        // 儲存到 sessionStorage
        saveToStorage: function() {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(window.navigationHistory));
            sessionStorage.setItem(this.CURRENT_INDEX_KEY, window.historyIndex.toString());
        },
        
        // 更新導航按鈕狀態
        updateNavigationButtons: function() {
            const backBtn = $('.btn-back');
            const historyBtn = $('.btn-history');
            const forwardBtn = $('#forward-btn');
            
            // 檢查是否有歷史記錄
            const hasHistory = window.navigationHistory.length > 1;
            
            // 返回按鈕
            const canGoBack = window.historyIndex > 0;
            if (hasHistory && canGoBack) {
                if (backBtn.length === 0) {
                    // 創建返回按鈕
                    const btn = $('<button class="btn btn-back btn-nav-gradient" onclick="NavigationManager.goBack()"><i class="fas fa-arrow-left me-1"></i>返回</button>');
                    $('.btn-group-aligned').prepend(btn);
                }
                $('.btn-back').show().prop('disabled', false);
                const prevPage = window.navigationHistory[window.historyIndex - 1];
                if (prevPage) {
                    $('.btn-back').attr('title', `返回到第 ${prevPage.line} 行`);
                }
            } else if (hasHistory && !canGoBack) {
                $('.btn-back').show().prop('disabled', true).attr('title', '沒有上一頁');
            } else {
                $('.btn-back').hide();
            }
            
            // 歷史按鈕
            if (hasHistory) {
                if (historyBtn.length === 0) {
                    // 創建歷史按鈕
                    const btn = $('<button class="btn btn-history btn-nav-gradient-alt" onclick="showHistoryPanel()" title="瀏覽歷史 (Ctrl+H)"><i class="fas fa-history me-1"></i>歷史</button>');
                    if ($('.btn-back').length > 0) {
                        $('.btn-back').after(btn);
                    } else {
                        $('.btn-group-aligned').prepend(btn);
                    }
                }
                $('.btn-history').show();
                $('.btn-history').attr('title', `瀏覽歷史 (${window.navigationHistory.length} 項)`);
            } else {
                $('.btn-history').hide();
            }
            
            // 前進按鈕
            const canGoForward = window.historyIndex < window.navigationHistory.length - 1;
            if (canGoForward) {
                if (forwardBtn.length === 0) {
                    // 創建前進按鈕
                    const btn = $('<button id="forward-btn" class="btn btn-forward btn-nav-gradient" onclick="NavigationManager.goForward()" title="前進到下一頁"><i class="fas fa-arrow-right me-1"></i>前進</button>');
                    if ($('.btn-history').length > 0) {
                        $('.btn-history').after(btn);
                    } else if ($('.btn-back').length > 0) {
                        $('.btn-back').after(btn);
                    } else {
                        $('.btn-group-aligned').prepend(btn);
                    }
                }
                const nextPage = window.navigationHistory[window.historyIndex + 1];
                if (nextPage) {
                    $('#forward-btn').attr('title', `前進到第 ${nextPage.line} 行`);
                }
                $('#forward-btn').prop('disabled', false).show();
            } else {
                $('#forward-btn').prop('disabled', true).hide();
            }
            
            // 更新歷史面板（如果開啟）
            if ($('.history-panel').is(':visible')) {
                this.updateHistoryPanel();
            }
        },
        
        // 返回
        goBack: function() {
            if (window.historyIndex > 0) {
                window.historyIndex--;
                const targetPage = window.navigationHistory[window.historyIndex];
                
                if (targetPage) {
                    this.saveToStorage();
                    // 添加導航標記，避免重複記錄
                    const url = new URL(targetPage.url);
                    url.searchParams.set('nav_action', 'true');
                    this.isNavigating = true;
                    window.location.href = url.toString();
                }
            } else {
                showToast('info', '沒有更早的歷史記錄了');
            }
        },
        
        // 前進
        goForward: function() {
            if (window.historyIndex < window.navigationHistory.length - 1) {
                window.historyIndex++;
                const targetPage = window.navigationHistory[window.historyIndex];
                
                if (targetPage) {
                    this.saveToStorage();
                    // 添加導航標記，避免重複記錄
                    const url = new URL(targetPage.url);
                    url.searchParams.set('nav_action', 'true');
                    this.isNavigating = true;
                    window.location.href = url.toString();
                }
            } else {
                showToast('info', '沒有更晚的歷史記錄了');
            }
        },
        
        // 跳轉到指定歷史位置
        goToHistory: function(index) {
            if (index >= 0 && index < window.navigationHistory.length && index !== window.historyIndex) {
                window.historyIndex = index;
                const targetPage = window.navigationHistory[index];
                
                if (targetPage) {
                    this.saveToStorage();
                    const url = new URL(targetPage.url);
                    url.searchParams.set('nav_action', 'true');
                    this.isNavigating = true;
                    window.location.href = url.toString();
                }
            }
        },
        
        // 設置事件監聽器
        setupEventListeners: function() {
            // 監聽行號雙擊事件
            $(document).on('dblclick', '.line-number', (e) => {
                if (!this.isNavigating) {
                    // 在跳轉前確保當前頁面已保存
                    this.saveToStorage();
                }
            });
            
            // 監聽頁面卸載事件
            window.addEventListener('beforeunload', () => {
                if (!this.isNavigating) {
                    this.saveToStorage();
                }
            });
            
            // 清理 URL 中的導航標記
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('nav_action') === 'true') {
                urlParams.delete('nav_action');
                const newUrl = window.location.pathname + '?' + urlParams.toString();
                window.history.replaceState({}, '', newUrl);
            }
        },
        
        // 更新歷史面板
        updateHistoryPanel: function() {
            const body = $('.history-panel-body');
            if (body.length === 0) return;
            
            body.empty();
            
            window.navigationHistory.forEach((item, index) => {
                const isActive = index === window.historyIndex;
                const isFuture = index > window.historyIndex;
                const isPast = index < window.historyIndex;
                
                const historyItem = $(`
                    <div class="history-item ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''} ${isPast ? 'past' : ''}" 
                         data-index="${index}">
                        <div class="history-item-indicator">
                            ${isPast ? '<i class="fas fa-arrow-left"></i>' : ''}
                            ${isActive ? '<i class="fas fa-dot-circle"></i>' : ''}
                            ${isFuture ? '<i class="fas fa-arrow-right"></i>' : ''}
                        </div>
                        <div class="history-item-info">
                            <div class="history-item-line">第 ${item.line} 行</div>
                            <div class="history-item-range">顯示: ${item.startLine}-${item.endLine}</div>
                        </div>
                        <div class="history-item-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
                    </div>
                `);
                
                historyItem.click(() => {
                    this.goToHistory(index);
                });
                
                body.append(historyItem);
            });
            
            // 滾動到當前項目
            const activeItem = body.find('.history-item.active');
            if (activeItem.length > 0) {
                body.scrollTop(activeItem.position().top - body.height() / 2 + activeItem.height() / 2);
            }
        },
        
        // 獲取歷史資訊（用於調試）
        getHistoryInfo: function() {
            return {
                history: window.navigationHistory,
                currentIndex: window.historyIndex,
                canGoBack: window.historyIndex > 0,
                canGoForward: window.historyIndex < window.navigationHistory.length - 1,
                totalItems: window.navigationHistory.length
            };
        },
        
        // 顯示導航提示
        showNavigationHint: function(message) {
            const hint = $('#nav-hint');
            if (hint.length === 0) {
                $('body').append('<div class="nav-hint" id="nav-hint"></div>');
            }
            
            $('#nav-hint').text(message).addClass('show');
            setTimeout(() => {
                $('#nav-hint').removeClass('show');
            }, 2000);
        }
    };
    
    // 覆蓋原有的 goBack 和 goForward 函數
    window.goBack = function() {
        NavigationManager.goBack();
    };
    
    window.goForward = function() {
        NavigationManager.goForward();
    };
    
    // 修復 handleLineDoubleClick 函數
    window.handleLineDoubleClick = function(lineNumber) {
        showToast('info', `正在載入第 ${lineNumber} 行的上下文...`);
        
        // 確保當前頁面已保存到歷史
        NavigationManager.saveToStorage();
        
        const url = new URL(window.location);
        url.searchParams.set('line', lineNumber);
        url.searchParams.set('start', Math.max(1, lineNumber - 200));
        url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
        url.searchParams.set('context', 200);
        url.searchParams.set('from', currentTargetLine);
        
        // 使用 location.href 而不是 location.replace
        window.location.href = url.toString();
    };
    
    // 修復 jumpToLine 函數
    const originalJumpToLine = window.jumpToLine;
    window.jumpToLine = function(lineNumber, addToHistory = true) {
        lineNumber = lineNumber || parseInt($('#jump-line').val());
        
        if (lineNumber && lineNumber >= 1 && lineNumber <= totalLines) {
            // 如果行在當前顯示範圍內，只需滾動
            const lineElement = $(`#line-${lineNumber}`);
            if (lineElement.length > 0 && lineNumber >= currentStartLine && lineNumber <= currentEndLine) {
                scrollToElement(lineElement);
                return;
            }
            
            // 確保當前頁面已保存到歷史
            if (addToHistory) {
                NavigationManager.saveToStorage();
            }
            
            const url = new URL(window.location);
            url.searchParams.set('line', lineNumber);
            url.searchParams.set('start', Math.max(1, lineNumber - 200));
            url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
            url.searchParams.set('from', currentTargetLine);
            
            window.location.href = url.toString();
        } else {
            showToast('warning', `請輸入有效的行號 (1-${totalLines})`);
        }
    };
    
    // 創建歷史面板
    function createHistoryPanel() {
        const panel = $(`
            <div class="history-panel" style="display: none;">
                <div class="history-panel-header">
                    <h5>瀏覽歷史</h5>
                    <span class="history-counter">
                        ${window.historyIndex + 1} / ${window.navigationHistory.length}
                    </span>
                    <button class="history-panel-close" onclick="$('.history-panel').hide()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="history-panel-body"></div>
                <div class="history-panel-footer">
                    <button class="btn btn-sm btn-outline-danger" onclick="NavigationManager.clearHistory()">
                        <i class="fas fa-trash me-1"></i>清除歷史
                    </button>
                </div>
            </div>
        `);
        
        $('body').append(panel);
    }
    
    // 顯示歷史面板
    window.showHistoryPanel = function() {
        NavigationManager.updateHistoryPanel();
        $('.history-panel').show();
        $('.history-counter').text(`${window.historyIndex + 1} / ${window.navigationHistory.length}`);
    };
    
	// 清除歷史 - 使用美化的確認對話框
	NavigationManager.clearHistory = function() {
		// 檢查是否有 showConfirmDialog 函數
		if (typeof showConfirmDialog === 'function') {
			showConfirmDialog(
				'清除瀏覽歷史',
				`確定要清除所有 ${window.navigationHistory.length} 筆瀏覽歷史嗎？此操作無法復原。`,
				function() {
					// 只保留當前頁面
					const currentPage = window.navigationHistory[window.historyIndex];
					window.navigationHistory = currentPage ? [currentPage] : [];
					window.historyIndex = 0;
					NavigationManager.saveToStorage();
					NavigationManager.updateNavigationButtons();
					NavigationManager.updateHistoryPanel();
					showToast('success', '已清除瀏覽歷史');
				}
			);
		} else {
			// 如果美化對話框不可用，使用原生 confirm
			if (confirm(`確定要清除所有 ${window.navigationHistory.length} 筆瀏覽歷史嗎？`)) {
				const currentPage = window.navigationHistory[window.historyIndex];
				window.navigationHistory = currentPage ? [currentPage] : [];
				window.historyIndex = 0;
				this.saveToStorage();
				this.updateNavigationButtons();
				this.updateHistoryPanel();
				showToast('success', '已清除瀏覽歷史');
			}
		}
	};
    
    // 初始化
    $(document).ready(function() {
        // 延遲初始化，確保其他腳本已載入
        setTimeout(() => {
            // 先隱藏可能存在的靜態按鈕
            $('.btn-back').hide();
            $('.btn-history').hide();
            
            NavigationManager.init();
            createHistoryPanel();
            
            // 添加提示標籤
            if ($('.nav-buttons-hint').length === 0) {
                $('.btn-group-aligned').css('position', 'relative');
                $('.btn-group-aligned').prepend('<div class="nav-buttons-hint">使用 Alt+← / Alt+→ 快速導航</div>');
            }
            
            // 添加鍵盤快捷鍵
            $(document).on('keydown', function(e) {
                // Alt + 左箭頭：返回
                if (e.altKey && e.which === 37) {
                    e.preventDefault();
                    NavigationManager.goBack();
                    NavigationManager.showNavigationHint('返回上一頁');
                }
                // Alt + 右箭頭：前進
                if (e.altKey && e.which === 39) {
                    e.preventDefault();
                    NavigationManager.goForward();
                    NavigationManager.showNavigationHint('前進到下一頁');
                }
                // Ctrl + H：顯示歷史
                if (e.ctrlKey && e.which === 72) {
                    e.preventDefault();
                    showHistoryPanel();
                }
            });
            
            console.log('Navigation History Manager v2 initialized');
            console.log('Current history:', NavigationManager.getHistoryInfo());
        }, 200);
    });
    
    // 導出到全域
    window.NavigationManager = NavigationManager;
    
})();