// 側邊欄滑動刪除功能
class SwipeDelete {
    
    constructor() {
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.currentItem = null;
        this.isSwipeEnabled = true;
        this.deleteThreshold = 80; // 滑動閾值
        this.init();
    }
    
    init() {
        // 檢測是否為觸控設備
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (this.isTouchDevice) {
            this.setupTouchEvents();
        } else {
            this.setupMouseEvents();
        }
        
        // 監聽動態添加的元素
        this.observeNewItems();
    }
    
    setupTouchEvents() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }
    
    setupMouseEvents() {
        // 為桌面版添加右鍵選單
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    }
    
    handleTouchStart(e) {
        const item = this.getSwipeableItem(e.target);
        if (!item) return;
        
        this.currentItem = item;
        this.touchStartX = e.touches[0].clientX;
        
        // 重置之前的滑動狀態
        this.resetAllItems();
    }
    
    handleTouchMove(e) {
        if (!this.currentItem) return;
        
        const touchX = e.touches[0].clientX;
        const deltaX = this.touchStartX - touchX;
        
        if (deltaX > 10) {
            e.preventDefault();
            
            // 限制滑動距離
            const translateX = Math.min(deltaX, this.deleteThreshold);
            this.currentItem.style.transform = `translateX(-${translateX}px)`;
            
            // 顯示刪除按鈕
            this.showDeleteButton(this.currentItem, translateX);
        }
    }
    
    handleTouchEnd(e) {
        if (!this.currentItem) return;
        
        this.touchEndX = e.changedTouches[0].clientX;
        const deltaX = this.touchStartX - this.touchEndX;
        
        if (deltaX > this.deleteThreshold / 2) {
            // 保持在刪除狀態
            this.currentItem.style.transform = `translateX(-${this.deleteThreshold}px)`;
            this.showDeleteButton(this.currentItem, this.deleteThreshold);
        } else {
            // 恢復原狀
            this.resetItem(this.currentItem);
        }
        
        this.currentItem = null;
    }
    
    handleContextMenu(e) {
        const item = this.getSwipeableItem(e.target);
        if (!item) return;
        
        e.preventDefault();
        this.showContextMenu(e, item);
    }
    
    getSwipeableItem(target) {
        // 找到可滑動刪除的項目
        return target.closest('.recent-file, .workspace-item, .file-item:not(.active), .folder-item');
    }
    
    showDeleteButton(item, offset) {
        let deleteBtn = item.querySelector('.swipe-delete-btn');
        
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'swipe-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 刪除';
            deleteBtn.onclick = () => this.deleteItem(item);
            item.appendChild(deleteBtn);
        }
        
        deleteBtn.style.opacity = Math.min(offset / this.deleteThreshold, 1);
        deleteBtn.style.width = `${offset}px`;
    }
    
    showContextMenu(e, item) {
        // 創建右鍵選單
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 刪除
            </div>
        `;
        
        // 定位選單
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        
        document.body.appendChild(menu);
        
        // 處理選單點擊
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action === 'delete') {
                this.deleteItem(item);
            }
            menu.remove();
        });
        
        // 點擊其他地方關閉選單
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }
    
    deleteItem(item) {
        // 判斷項目類型並執行相應的刪除操作
        if (item.classList.contains('recent-file')) {
            this.deleteRecentFile(item);
        } else if (item.classList.contains('workspace-item')) {
            this.deleteWorkspace(item);
        } else if (item.classList.contains('file-item') || item.classList.contains('folder-item')) {
            this.deleteFileItem(item);
        }
    }
    
    deleteRecentFile(item) {
        const fileName = item.querySelector('.recent-file-name')?.textContent;
        const filePath = item.querySelector('.recent-file-path')?.textContent;
        
        if (confirm(`確定要從最近檔案中移除 "${fileName}" 嗎？`)) {
            // 從記憶體中移除
            window.recentFiles = window.recentFiles.filter(f => f.path !== filePath);
            
            // 更新 localStorage
            if (document.getElementById('remember-recent')?.checked !== false) {
                localStorage.setItem('recentFiles', JSON.stringify(window.recentFiles));
            }
            
            // 動畫移除
            item.style.transition = 'all 0.3s ease';
            item.style.transform = 'translateX(-100%)';
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                window.updateRecentCount();
            }, 300);
            
            window.showToast('已移除最近檔案', 'success');
        }
    }
    
    async deleteWorkspace(item) {
        const workspaceName = item.querySelector('.workspace-name')?.textContent;
        const workspaceId = item.dataset.workspaceId;
        
        if (!workspaceId) return;
        
        if (confirm(`確定要刪除工作區 "${workspaceName}" 嗎？`)) {
            try {
                const response = await fetch(`/api/multi_viewer/delete/${workspaceId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    // 動畫移除
                    item.style.transition = 'all 0.3s ease';
                    item.style.transform = 'translateX(-100%)';
                    item.style.opacity = '0';
                    setTimeout(() => {
                        item.remove();
                        window.updateSavedCount();
                    }, 300);
                    
                    window.showToast('工作區已刪除', 'success');
                } else {
                    throw new Error('刪除失敗');
                }
            } catch (error) {
                window.showToast('刪除工作區失敗', 'error');
            }
        }
    }
    
    deleteFileItem(item) {
        const fileName = item.querySelector('.item-name')?.textContent;
        
        if (confirm(`確定要從列表中移除 "${fileName}" 嗎？`)) {
            // 動畫移除
            item.style.transition = 'all 0.3s ease';
            item.style.transform = 'translateX(-100%)';
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                // 更新檔案計數
                const currentCount = parseInt(document.getElementById('files-count').textContent) || 0;
                document.getElementById('files-count').textContent = Math.max(0, currentCount - 1);
            }, 300);
            
            window.showToast('已移除檔案', 'success');
        }
    }
    
    resetItem(item) {
        item.style.transform = '';
        const deleteBtn = item.querySelector('.swipe-delete-btn');
        if (deleteBtn) {
            deleteBtn.style.opacity = '0';
            setTimeout(() => deleteBtn.remove(), 200);
        }
    }
    
    resetAllItems() {
        document.querySelectorAll('.swipe-delete-btn').forEach(btn => {
            const item = btn.parentElement;
            this.resetItem(item);
        });
    }
    
    observeNewItems() {
        // 監聽動態添加的元素
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // 重新初始化事件監聽
                        if (this.isTouchDevice) {
                            this.setupTouchEvents();
                        }
                    }
                });
            });
        });
        
        const container = document.getElementById('groups-container');
        if (container) {
            observer.observe(container, { childList: true, subtree: true });
        }
    }
}

// 初始化滑動刪除功能
document.addEventListener('DOMContentLoaded', () => {
    window.swipeDelete = new SwipeDelete();
});


/* ------------------------------------ */

// 側邊欄項目的滑動刪除功能
let touchStartX = null;
let currentSwipeTarget = null;
let currentExpandedItem = null;
let swipeThreshold = 50;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initSwipeDelete();
    initContextMenu();
});

// 檢測是否為手機設備
function isMobile() {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
}

// 初始化滑動刪除
function initSwipeDelete() {
    if (!isMobile()) return;
    
    // 綁定觸控事件
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// 處理觸控開始
function handleTouchStart(e) {
    const target = e.target.closest('.recent-file, .workspace-item');
    if (!target) return;
    
    touchStartX = e.touches[0].clientX;
    currentSwipeTarget = target;
}

// 處理觸控移動
function handleTouchMove(e) {
    if (!touchStartX || !currentSwipeTarget) return;
    
    const touch = e.touches[0];
    const touchEndX = touch.clientX;
    const diffX = touchStartX - touchEndX;
    
    // 獲取圓形刪除按鈕
    const circleDeleteBtn = currentSwipeTarget.querySelector('.delete-btn-circle');
    
    if (diffX > 10) {
        // 向左滑動 - 顯示滑動刪除按鈕
        e.preventDefault();
        
        // 隱藏圓形刪除按鈕
        if (circleDeleteBtn) {
            circleDeleteBtn.style.display = 'none';
        }
        
        // 限制滑動距離
        const swipeDistance = Math.min(diffX, 100);
        currentSwipeTarget.style.transform = `translateX(-${swipeDistance}px)`;
        currentSwipeTarget.style.transition = 'none';
        
        // 顯示滑動刪除按鈕
        if (swipeDistance > swipeThreshold) {
            showSwipeDeleteButton(currentSwipeTarget);
        }
        
    } else if (diffX < -10) {
        // 向右滑動 - 隱藏滑動刪除按鈕
        e.preventDefault();
        
        // 顯示圓形刪除按鈕
        if (circleDeleteBtn && isMobile()) {
            circleDeleteBtn.style.display = 'flex';
        }
        
        // 重置位置
        currentSwipeTarget.style.transform = 'translateX(0)';
        currentSwipeTarget.style.transition = 'transform 0.3s ease';
        
        // 隱藏滑動刪除按鈕
        hideSwipeDeleteButton(currentSwipeTarget);
    }
}

// 處理觸控結束
function handleTouchEnd(e) {
    if (!currentSwipeTarget) return;
    
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const diffX = touchStartX - touchEndX;
    
    const circleDeleteBtn = currentSwipeTarget.querySelector('.delete-btn-circle');
    
    currentSwipeTarget.style.transition = 'transform 0.3s ease';
    
    if (diffX > swipeThreshold) {
        // 保持滑動狀態 - 顯示滑動刪除按鈕
        currentSwipeTarget.style.transform = 'translateX(-80px)';
        showSwipeDeleteButton(currentSwipeTarget);
        
        // 確保圓形刪除按鈕隱藏
        if (circleDeleteBtn) {
            circleDeleteBtn.style.display = 'none';
        }
        
        // 記錄當前展開的項目
        if (currentExpandedItem && currentExpandedItem !== currentSwipeTarget) {
            resetSwipeState(currentExpandedItem);
        }
        currentExpandedItem = currentSwipeTarget;
        
    } else {
        // 重置狀態
        resetSwipeState(currentSwipeTarget);
    }
    
    touchStartX = null;
    currentSwipeTarget = null;
}

// 顯示滑動刪除按鈕
function showSwipeDeleteButton(item) {
    // 確保圓形刪除按鈕隱藏
    const circleDeleteBtn = item.querySelector('.delete-btn-circle');
    if (circleDeleteBtn) {
        circleDeleteBtn.style.display = 'none';
    }
    
    // 檢查是否已經有刪除按鈕
    let deleteBtn = item.querySelector('.swipe-delete-btn');
    if (deleteBtn) {
        deleteBtn.style.opacity = '1';
        deleteBtn.style.width = '80px';
        return;
    }
    
    // 創建新的刪除按鈕
    deleteBtn = document.createElement('button');
    deleteBtn.className = 'swipe-delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 刪除';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        handleSwipeDelete(item);
    };
    
    item.appendChild(deleteBtn);
    
    // 動畫顯示
    setTimeout(() => {
        deleteBtn.style.opacity = '1';
        deleteBtn.style.width = '80px';
    }, 10);
}

// 隱藏滑動刪除按鈕
function hideSwipeDeleteButton(item) {
    const deleteBtn = item.querySelector('.swipe-delete-btn');
    if (deleteBtn) {
        deleteBtn.style.opacity = '0';
        deleteBtn.style.width = '0';
        setTimeout(() => {
            deleteBtn.remove();
        }, 300);
    }
    
    // 恢復圓形刪除按鈕
    const circleDeleteBtn = item.querySelector('.delete-btn-circle');
    if (circleDeleteBtn && isMobile()) {
        circleDeleteBtn.style.display = 'flex';
    }
}

// 重置滑動狀態
function resetSwipeState(element) {
    if (!element) return;
    
    element.style.transform = 'translateX(0)';
    hideSwipeDeleteButton(element);
    
    // 恢復圓形刪除按鈕顯示
    const circleDeleteBtn = element.querySelector('.delete-btn-circle');
    if (circleDeleteBtn && isMobile()) {
        circleDeleteBtn.style.display = 'flex';
    }
    
    if (element === currentExpandedItem) {
        currentExpandedItem = null;
    }
}

// 處理滑動刪除
function handleSwipeDelete(item) {
    // 判斷是最近檔案還是工作區
    if (item.classList.contains('recent-file')) {
        // 獲取索引
        const recentFiles = document.querySelectorAll('.recent-file');
        const index = Array.from(recentFiles).indexOf(item);
        if (index !== -1 && window.deleteRecentFile) {
            window.deleteRecentFile(event, index);
        }
    } else if (item.classList.contains('workspace-item')) {
        // 獲取工作區 ID
        const workspaceId = item.dataset.workspaceId;
        if (workspaceId && window.deleteWorkspace) {
            window.deleteWorkspace(event, workspaceId);
        }
    }
}

// 點擊其他地方時重置所有滑動狀態
document.addEventListener('click', (e) => {
    if (currentExpandedItem && !currentExpandedItem.contains(e.target)) {
        resetSwipeState(currentExpandedItem);
    }
});

// 初始化右鍵選單
function initContextMenu() {
    // 只在電腦版啟用右鍵選單
    if (isMobile()) return;
    
    // 防止預設右鍵選單
    document.addEventListener('contextmenu', (e) => {
        const target = e.target.closest('.recent-file, .workspace-item, .file-item, .folder-item');
        if (target) {
            e.preventDefault();
            showContextMenu(e, target);
        }
    });
    
    // 點擊其他地方關閉選單
    document.addEventListener('click', hideContextMenu);
}

// 顯示右鍵選單
function showContextMenu(e, target) {
    hideContextMenu();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // 根據目標類型添加選項
    if (target.classList.contains('recent-file')) {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="open">
                <i class="fas fa-folder-open"></i> 開啟
            </div>
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 刪除
            </div>
        `;
    } else if (target.classList.contains('workspace-item')) {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="open">
                <i class="fas fa-folder-open"></i> 開啟
            </div>
            <div class="context-menu-item" data-action="share">
                <i class="fas fa-share"></i> 分享
            </div>
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 刪除
            </div>
        `;
    } else if (target.classList.contains('file-item')) {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="open">
                <i class="fas fa-file"></i> 開啟
            </div>
            <div class="context-menu-item" data-action="open-new-tab">
                <i class="fas fa-external-link-alt"></i> 在新標籤開啟
            </div>
        `;
    } else if (target.classList.contains('folder-item')) {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="expand">
                <i class="fas fa-folder-open"></i> 展開
            </div>
            <div class="context-menu-item" data-action="collapse">
                <i class="fas fa-folder"></i> 收合
            </div>
        `;
    }
    
    // 綁定選單項目事件
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            handleContextMenuAction(item.dataset.action, target);
            hideContextMenu();
        });
    });
    
    document.body.appendChild(menu);
    
    // 調整位置以防超出視窗
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
}

// 隱藏右鍵選單
function hideContextMenu() {
    const menu = document.querySelector('.context-menu');
    if (menu) {
        menu.remove();
    }
}

// 處理右鍵選單動作
function handleContextMenuAction(action, target) {
    switch (action) {
        case 'open':
            target.click();
            break;
        case 'delete':
            if (target.classList.contains('recent-file')) {
                const recentFiles = document.querySelectorAll('.recent-file');
                const index = Array.from(recentFiles).indexOf(target);
                if (index !== -1 && window.deleteRecentFile) {
                    window.deleteRecentFile(event, index);
                }
            } else if (target.classList.contains('workspace-item')) {
                const workspaceId = target.dataset.workspaceId;
                if (workspaceId && window.deleteWorkspace) {
                    window.deleteWorkspace(event, workspaceId);
                }
            }
            break;
        case 'share':
            // 實現分享功能
            if (window.shareWorkspace) {
                const workspaceId = target.dataset.workspaceId;
                window.shareWorkspace(workspaceId);
            }
            break;
        case 'open-new-tab':
            // 在新標籤頁開啟
            const fileData = target.onclick.toString();
            // 這裡需要根據實際實現調整
            break;
        case 'expand':
            const folderToggle = target.querySelector('.folder-toggle');
            if (folderToggle && !folderToggle.classList.contains('expanded')) {
                folderToggle.click();
            }
            break;
        case 'collapse':
            const expandedToggle = target.querySelector('.folder-toggle.expanded');
            if (expandedToggle) {
                expandedToggle.click();
            }
            break;
    }
}

/*--------------------------------*/