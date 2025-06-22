// ===== 標籤捲軸功能增強 =====

// 檢測標籤容器是否可以滾動
function checkTabsScrollable() {
    const tabsContainer = document.getElementById('file-tabs');
    if (!tabsContainer) return;
    
    const canScrollLeft = tabsContainer.scrollLeft > 0;
    const canScrollRight = tabsContainer.scrollLeft < tabsContainer.scrollWidth - tabsContainer.clientWidth;
    
    // 更新類別
    if (canScrollLeft) {
        tabsContainer.classList.add('can-scroll-left');
    } else {
        tabsContainer.classList.remove('can-scroll-left');
    }
    
    if (canScrollRight) {
        tabsContainer.classList.add('can-scroll-right');
    } else {
        tabsContainer.classList.remove('can-scroll-right');
    }
    
    // 手機版提示
    if (window.innerWidth <= 768) {
        const hasScroll = tabsContainer.scrollWidth > tabsContainer.clientWidth;
        if (hasScroll && currentTabs.length > 3) {
            // 初次顯示滑動提示
            if (!tabsContainer.dataset.hintShown) {
                tabsContainer.classList.add('show-hint');
                setTimeout(() => {
                    tabsContainer.classList.remove('show-hint');
                    tabsContainer.dataset.hintShown = 'true';
                }, 3000);
            }
        }
    }
}

// 滾動到活動標籤
function scrollToActiveTab() {
    const tabsContainer = document.getElementById('file-tabs');
    const activeTab = tabsContainer?.querySelector('.file-tab.active');
    
    if (!tabsContainer || !activeTab) return;
    
    // 計算活動標籤的位置
    const containerRect = tabsContainer.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    
    // 如果標籤不在視窗內，滾動到中心
    if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        const scrollLeft = activeTab.offsetLeft - (tabsContainer.clientWidth / 2) + (activeTab.clientWidth / 2);
        tabsContainer.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
    }
}

// 改進的渲染標籤函數
function renderTabsEnhanced() {
    const tabsContainer = document.getElementById('file-tabs');
    
    // 保存當前滾動位置
    const currentScrollLeft = tabsContainer.scrollLeft;
    
    // 調用原本的 renderTabs
    renderTabs();
    
    // 恢復滾動位置
    tabsContainer.scrollLeft = currentScrollLeft;
    
    // 檢查可滾動狀態
    setTimeout(() => {
        checkTabsScrollable();
        // 如果是新增標籤，滾動到最後
        if (tabsContainer.dataset.scrollToEnd) {
            tabsContainer.scrollLeft = tabsContainer.scrollWidth;
            delete tabsContainer.dataset.scrollToEnd;
        }
    }, 100);
}

// 改進的標籤列表顯示（手機版）
function showTabsListEnhanced() {
    // 如果沒有標籤，不顯示
    if (currentTabs.length === 0) {
        showToast('沒有開啟的檔案', 'info');
        return;
    }
    
    // 創建標籤列表 modal
    const modal = document.createElement('div');
    modal.className = 'tabs-list-modal';
    modal.innerHTML = `
        <div class="tabs-list-content">
            <div class="tabs-list-header">
                <h5>開啟的檔案 (${currentTabs.length})</h5>
                <button onclick="this.closest('.tabs-list-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tabs-list-body">
                ${currentTabs.length > 0 ? currentTabs.map(tab => `
                    <div class="tabs-list-item" onclick="switchTabFromList('${tab.id}')">
                        <div class="tab-color-indicator" style="background: ${tab.color}"></div>
                        <div class="tab-info">
                            <div class="tab-name">${tab.name}</div>
                            <div class="tab-path">${tab.path}</div>
                        </div>
                        <button class="tab-close-btn" onclick="event.stopPropagation(); closeTabFromList('${tab.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('') : `
                    <div class="tabs-list-empty">
                        <i class="fas fa-folder-open"></i>
                        <p>沒有開啟的檔案</p>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 點擊背景關閉
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });
}

// 從列表切換標籤
window.switchTabFromList = function(tabId) {
    switchTab(tabId);
    document.querySelector('.tabs-list-modal')?.remove();
    
    // 滾動到該標籤
    setTimeout(() => {
        scrollToActiveTab();
    }, 100);
};

// 從列表關閉標籤
window.closeTabFromList = function(tabId) {
    const tabsModal = document.querySelector('.tabs-list-modal');
    
    // 先關閉標籤
    const event = { stopPropagation: () => {} };
    closeTab(tabId, event);
    
    // 如果沒有標籤了，關閉 modal
    if (currentTabs.length === 0) {
        tabsModal?.remove();
    } else {
        // 更新列表
        showTabsListEnhanced();
        
        // 移除舊的 modal
        const oldModal = Array.from(document.querySelectorAll('.tabs-list-modal')).slice(0, -1);
        oldModal.forEach(m => m.remove());
    }
};

// 設置標籤容器事件
function setupTabsContainerEvents() {
    const tabsContainer = document.getElementById('file-tabs');
    if (!tabsContainer) return;
    
    // 滾動事件
    tabsContainer.addEventListener('scroll', () => {
        checkTabsScrollable();
    });
    
    // 觸控滾動（手機版）
    let touchStartX = 0;
    let touchEndX = 0;
    
    tabsContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    
    tabsContainer.addEventListener('touchmove', (e) => {
        // 防止垂直滾動
        if (Math.abs(e.touches[0].clientY - touchStartX) < 10) {
            e.preventDefault();
        }
    }, { passive: false });
    
    tabsContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        
        // 檢測滑動方向
        const swipeDistance = touchEndX - touchStartX;
        if (Math.abs(swipeDistance) > 50) {
            // 可以在這裡加入快速切換標籤的功能
        }
    }, { passive: true });
    
    // 滑鼠滾輪橫向滾動（桌面版）
    tabsContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            tabsContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
    
    // 監聽視窗大小變化
    window.addEventListener('resize', () => {
        checkTabsScrollable();
    });
}

// 覆寫原本的 renderTabs 函數
const originalRenderTabs = window.renderTabs;
window.renderTabs = function() {
    originalRenderTabs();
    
    // 加入捲軸檢測
    setTimeout(() => {
        checkTabsScrollable();
    }, 50);
};

// 覆寫原本的 openFile 函數
const originalOpenFile = window.openFile;
window.openFile = function(file, switchToTab = true) {
    const result = originalOpenFile(file, switchToTab);
    
    // 如果是新增標籤，標記需要滾動到最後
    const tabsContainer = document.getElementById('file-tabs');
    if (tabsContainer && result) {
        tabsContainer.dataset.scrollToEnd = 'true';
    }
    
    return result;
};

// 覆寫標籤列表顯示函數
window.showTabsList = showTabsListEnhanced;

// 初始化時設置事件
document.addEventListener('DOMContentLoaded', function() {
    // 延遲初始化，確保其他元件已載入
    setTimeout(() => {
        setupTabsContainerEvents();
        checkTabsScrollable();
    }, 500);
});

// 新增滑動提示元素
function addSwipeHint() {
    const tabsContainer = document.getElementById('file-tabs');
    if (!tabsContainer || tabsContainer.querySelector('.file-tabs-hint')) return;
    
    const hint = document.createElement('div');
    hint.className = 'file-tabs-hint';
    hint.textContent = '滑動查看更多';
    tabsContainer.appendChild(hint);
}

// 在手機版初始化時加入提示
if (window.innerWidth <= 768) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(addSwipeHint, 1000);
    });
}