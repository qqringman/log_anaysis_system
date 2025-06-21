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