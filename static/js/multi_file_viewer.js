// 全域變數
let groups = [];
let currentTabs = [];
let activeTabId = null;
let sidebarCollapsed = false;
let currentWorkspaceId = null;
let uploadedFiles = [];
let recentFiles = [];
let savedWorkspaces = [];
let splitView = false;
let tabCounter = 0;
let tabColors = ['#e74c3c', '#f39c12', '#27ae60', '#3498db', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
let currentView = 'files';
let isDragging = false;
let loadingTimeouts = {};
let currentUploadPane = null;
let diffMode = false;
let syncScroll = false;
let currentSearchPane = null;
let searchResults = { left: [], right: [] };
let splitViewState = { left: null, right: null };
let tabDragData = null;
let dragCounter = 0; // 防止重複拖放
let isProcessingDrop = false; // 防止重複處理拖放
// 搜尋結果導航函數
let currentSearchIndex = 0;
let searchResultsData = [];
let pendingFileForPane = null; // 等待選擇面板的檔案

// 初始化
document.addEventListener('DOMContentLoaded', function() {

    // 等待一下確保所有元素都載入
    setTimeout(() => {
        // 檢查是否有儲存的狀態
        let stateData = window.initialStateData || null;
        
        if (stateData) {
            try {
                if (typeof stateData === 'string') {
                    stateData = JSON.parse(stateData);
                }
                
                // 驗證狀態資料
                if (stateData && typeof stateData === 'object') {
                    console.log('載入工作區狀態');
                    loadWorkspaceState(stateData);
                } else {
                    console.error('工作區狀態格式不正確');
                    loadDefaultGroups();
                }
            } catch (e) {
                console.error('載入工作區狀態失敗', e);
                showToast('載入工作區失敗，載入預設狀態', 'error');
                loadDefaultGroups();
            }
        } else {
            // 從 URL 參數載入資料
            const urlParams = new URLSearchParams(window.location.search);
            const groupsData = urlParams.get('groups');
            
            if (groupsData) {
                try {
                    groups = JSON.parse(decodeURIComponent(groupsData));
                    
                    // 確保檔案都有正確的名稱
                    groups.forEach(group => {
                        if (group.items) {
                            group.items.forEach(item => {
                                processFileNames(item);
                            });
                        }
                    });
                    
                    renderGroups();
                    
                    // 自動開啟第一個檔案
                    setTimeout(() => {
                        const firstFile = findFirstFile(groups);
                        if (firstFile) {
                            openFile(firstFile);
                        } else {
                            showToast('沒有找到可開啟的檔案', 'info');
                        }
                    }, 500);
                    
                } catch (e) {
                    console.error('解析群組資料失敗', e);
                    showToast('無法載入檔案資料，請重新嘗試', 'error');
                }
            } else {
                // 載入預設資料
                loadDefaultGroups();
            }
        }

        // 檢測並修復分割視窗狀態
        setTimeout(() => {
            // 檢測是否有分割視窗容器
            const splitContainer = document.querySelector('.split-container');
            const fileViewer = document.getElementById('file-viewer');
            
            if (splitContainer && fileViewer && fileViewer.contains(splitContainer)) {
                console.log('檢測到分割視窗容器，修復狀態');
                
                // 強制設置分割視窗狀態
                window.splitView = true;
                splitView = true;
                
                // 從 DOM 恢復視窗狀態
                const leftContent = document.getElementById('split-left-content');
                const rightContent = document.getElementById('split-right-content');
                
                window.splitViewState = {
                    left: leftContent?.dataset.filePath || null,
                    right: rightContent?.dataset.filePath || null
                };
                
                splitViewState = window.splitViewState;
                
                // 更新工具列顯示
                document.getElementById('main-toolbar').style.display = 'none';
                document.getElementById('split-toolbar').style.display = 'flex';
                
                // 更新按鈕狀態
                const splitBtn = document.querySelector('.btn-split');
                if (splitBtn) {
                    splitBtn.style.background = '#28a745';
                    splitBtn.innerHTML = '<i class="fas fa-times"></i> <span>關閉分割</span>';
                }
                
                console.log('分割視窗狀態已修復:', {
                    splitView: window.splitView,
                    splitViewState: window.splitViewState
                });
                
                // 確保 iframe 通信已設置
                if (leftContent && leftContent.querySelector('iframe')) {
                    const iframe = leftContent.querySelector('iframe');
                    setupIframeCommunication(iframe, 'left');
                }
                
                if (rightContent && rightContent.querySelector('iframe')) {
                    const iframe = rightContent.querySelector('iframe');
                    setupIframeCommunication(iframe, 'right');
                }
            }
        }, 500); // 增加延遲確保 DOM 完全載入
                
        // 初始化拖放事件
        setupGlobalDragAndDrop();
        setupTabDragAndDrop();
        
        // 初始化鍵盤快捷鍵
        setupKeyboardShortcuts();
        
        // 載入最近檔案和已儲存的工作區
        loadRecentFiles();
        loadSavedWorkspaces();

        // 初始化搜尋相關
        window.searchResultsData = [];
        window.currentSearchIndex = 0;
        
        // 設置搜尋鍵盤快捷鍵
        setupSearchModalKeyboard();

        // 設置全域拖放標記
        window.globalDropHandled = false;

        // 修復重複拖放事件
        isDragging = false;
    }, 100); // 延遲 100ms 確保 DOM 完全載入
});

// 載入工作區狀態
function loadWorkspaceState(state) {
    console.log('載入工作區狀態:', state);
    
    // 重置狀態
    currentTabs = [];
    activeTabId = null;
    splitView = false;
    splitViewState = { left: null, right: null };
    tabCounter = 0;
    
    // 載入群組
    if (state.groups) {
        groups = state.groups;
        // 確保檔案都有正確的名稱
        groups.forEach(group => {
            if (group.items) {
                group.items.forEach(item => {
                    processFileNames(item);
                });
            }
        });
        renderGroups();
    }
    
    // 載入側邊欄狀態
    if (state.sidebarCollapsed !== undefined) {
        sidebarCollapsed = state.sidebarCollapsed;
        const sidebar = document.getElementById('sidebar');
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
    
    // 載入當前檢視
    if (state.currentView) {
        // 確保 DOM 已載入
        setTimeout(() => {
            currentView = state.currentView;
            showView(currentView);
        }, 100);
    }
    
    // 載入標籤（延遲執行以確保 DOM 準備好）
    setTimeout(() => {
        if (state.tabs && state.tabs.length > 0) {
            const tabPromises = [];
            
            state.tabs.forEach((tabData, index) => {
                const promise = new Promise((resolve) => {
                    // 重建檔案物件
                    const file = {
                        name: tabData.name,
                        path: tabData.path,
                        type: 'file',
                        isLocal: tabData.path.startsWith('/temp/') || tabData.path.startsWith('blob:'),
                        isEditable: tabData.isEditable || false,
                        color: tabData.color
                    };
                    
                    // 開啟檔案但不切換標籤（第二個參數為 false）
                    const tab = openFile(file, false);
                    
                    if (tab) {
                        // 恢復標籤狀態
                        tab.splitPane = tabData.splitPane || null;
                        tab.color = tabData.color || tabColors[index % tabColors.length];
                        
                        // 如果是可編輯檔案且有內容，恢復內容
                        if (tabData.isEditable && tabData.content) {
                            tab.content = tabData.content;
                        }
                        
                        setTimeout(() => {
                            resolve(tab);
                        }, 100);
                    } else {
                        resolve(null);
                    }
                });
                
                tabPromises.push(promise);
            });
            
            // 等待所有標籤載入完成
            Promise.all(tabPromises).then((loadedTabs) => {
                console.log('所有標籤載入完成:', loadedTabs);
                
                // 恢復分割視窗狀態
                if (state.splitView && state.splitViewState) {
                    
                    // 先設置全域變數
                    window.splitView = true;
                    window.splitViewState = state.splitViewState || { left: null, right: null };

                    // 先切換到分割視窗模式
                    splitView = true;
                    const splitBtn = document.querySelector('.btn-split');
                    if (splitBtn) {
                        splitBtn.style.background = '#28a745';
                        splitBtn.innerHTML = '<i class="fas fa-times"></i> <span>關閉分割</span>';
                    }
                    
                    createSplitView();
                    document.getElementById('main-toolbar').style.display = 'none';
                    document.getElementById('split-toolbar').style.display = 'flex';
                    
                    // 載入分割視窗內容
                    setTimeout(() => {
                        if (state.splitViewState.left) {
                            const leftTab = currentTabs.find(t => t.path === state.splitViewState.left);
                            if (leftTab) {
                                leftTab.splitPane = 'left';
                                loadFileToPane(leftTab, 'left');
                            }
                        }
                        
                        if (state.splitViewState.right) {
                            const rightTab = currentTabs.find(t => t.path === state.splitViewState.right);
                            if (rightTab) {
                                rightTab.splitPane = 'right';
                                loadFileToPane(rightTab, 'right');
                            }
                        }
                        
                        renderTabs();
                    }, 500);
                } else {
                    // 非分割視窗模式，恢復活動標籤
                    if (state.activeTabPath) {
                        const activeTab = currentTabs.find(t => t.path === state.activeTabPath);
                        if (activeTab) {
                            switchTab(activeTab.id);
                        }
                    } else if (currentTabs.length > 0) {
                        // 如果沒有指定活動標籤，預設第一個
                        switchTab(currentTabs[0].id);
                    }
                }
            });
        }
    }, 500);
}

// 處理拖放的檔案
function handleFilesDropped(files) {
    // 防止空檔案陣列
    if (!files || files.length === 0) return;
    
    files.forEach((file, index) => {
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        openFile(virtualFile, index === 0);
    });
    
    showToast(`已開啟 ${files.length} 個檔案`, 'success');
}

// 設置鍵盤快捷鍵
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: 儲存工作區
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveWorkspace();
        }
        
        // Ctrl/Cmd + O: 開啟檔案
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            openUploadModal();
        }
        
        // Ctrl/Cmd + F: 搜尋
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            
            // 檢查是否已經有搜尋視窗開啟
            const searchModal = document.getElementById('search-modal');
            const paneSearchModal = document.getElementById('pane-search-modal');
            
            // 關閉所有現有的搜尋視窗
            if (searchModal && searchModal.classList.contains('show')) {
                closeSearchModal();
            }
            if (paneSearchModal && paneSearchModal.classList.contains('show')) {
                closePaneSearchModal();
            }
            
            // 延遲開啟新的搜尋視窗
            setTimeout(() => {
                openSearchModal();
            }, 100);
        }
        
        // F5: 重新整理
        if (e.key === 'F5') {
            e.preventDefault();
            refreshContent();
        }
    });
}

// 設置標籤拖放
function setupTabDragAndDrop() {
    const tabsContainer = document.getElementById('file-tabs');
    let draggedTab = null;
    
    // 委託事件處理，因為標籤是動態創建的
    tabsContainer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('file-tab')) {
            draggedTab = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            
            // 儲存拖曳的標籤資料
            const tabId = e.target.dataset.tabId;
            const tab = currentTabs.find(t => t.id === tabId);
            if (tab) {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'tab',
                    tabId: tabId,
                    path: tab.path,
                    name: tab.name
                }));
            }
        }
    });
    
    tabsContainer.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('file-tab')) {
            e.target.classList.remove('dragging');
            draggedTab = null;
            
            // 更新 currentTabs 陣列順序
            updateTabsOrder();
        }
    });
    
    tabsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedTab) return;
        
        const afterElement = getDragAfterElement(tabsContainer, e.clientX);
        if (afterElement == null) {
            // 如果沒有後續元素，檢查是否要插入到最後一個標籤之前
            const allTabs = [...tabsContainer.querySelectorAll('.file-tab:not(.dragging)')];
            const addBtn = tabsContainer.querySelector('.add-tab-btn');
            if (allTabs.length > 0 && addBtn) {
                tabsContainer.insertBefore(draggedTab, addBtn);
            }
        } else {
            tabsContainer.insertBefore(draggedTab, afterElement);
        }
    });
    
    // 防止拖曳到其他元素上
    tabsContainer.addEventListener('drop', (e) => {
        e.preventDefault();
    });
}

// 更新標籤順序
function updateTabsOrder() {
    const tabElements = document.querySelectorAll('.file-tab');
    const newOrder = [];
    
    tabElements.forEach(tabEl => {
        const tabId = tabEl.dataset.tabId;
        const tab = currentTabs.find(t => t.id === tabId);
        if (tab) {
            newOrder.push(tab);
        }
    });
    
    currentTabs = newOrder;
}

// 處理分割視窗的雙擊事件
function handleSplitPaneDoubleClick(pane) {

}


// 獲取拖放後的元素
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.file-tab:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 處理檔案名稱
function processFileNames(item) {
    if (!item.name && item.path) {
        item.name = item.path.split('/').pop() || 'Untitled';
    }
    
    if (item.type === 'folder' && item.children) {
        item.children.forEach(child => {
            processFileNames(child);
        });
    }
}

// 找到第一個檔案
function findFirstFile(groups) {
    for (let group of groups) {
        if (group.items) {
            for (let item of group.items) {
                if (item.type === 'file') {
                    return item;
                } else if (item.type === 'folder' && item.children) {
                    for (let child of item.children) {
                        if (child.type === 'file') {
                            return child;
                        }
                    }
                }
            }
        }
    }
    return null;
}

// 載入預設群組
function loadDefaultGroups() {
    groups = [
        {
            name: '範例檔案',
            icon: 'fa-folder',
            items: []
        }
    ];
    renderGroups();
}

// 渲染群組
function renderGroups() {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';
    
    let totalFiles = 0;
    let totalFolders = 0;
    
    groups.forEach((group, groupIndex) => {
        if (group.items && group.items.length > 0) {
            group.items.forEach(item => {
                if (item.type === 'folder') {
                    const folderGroup = {
                        name: item.name,
                        icon: 'fa-folder',
                        path: item.path,
                        type: 'folder',
                        expanded: item.expanded !== false,
                        children: item.children || []
                    };
                    const folderDiv = createFolderTreeElement(folderGroup);
                    container.appendChild(folderDiv);
                    totalFolders++;
                } else if (item.type === 'group') {
                    const groupDiv = createGroupElement(item, `${groupIndex}-${item.name}`);
                    container.appendChild(groupDiv);
                    if (item.items) {
                        totalFiles += item.items.length;
                    }
                } else if (item.type === 'file') {
                    const fileGroupDiv = createSingleFileElement(item);
                    container.appendChild(fileGroupDiv);
                    totalFiles++;
                }
            });
        } else {
            const groupDiv = createGroupElement(group, groupIndex);
            container.appendChild(groupDiv);
            
            if (group.items) {
                totalFiles += countFiles(group.items);
            }
        }
    });
    
    const countText = totalFiles + totalFolders;
    document.getElementById('files-count').textContent = countText;
}

// 計算檔案數量
function countFiles(items) {
    let count = 0;
    items.forEach(item => {
        if (item.type === 'file') {
            count++;
        } else if (item.type === 'folder' && item.children) {
            count += countFiles(item.children);
        }
    });
    return count;
}

// 創建群組元素
function createGroupElement(group, groupIndex) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group-item';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    header.onclick = () => toggleGroup(groupIndex);
    header.setAttribute('data-tooltip', group.name);

    const icon = document.createElement('i');
    icon.className = `fas ${group.icon || 'fa-folder'} group-icon`;
    header.appendChild(icon);
    
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.name;
    header.appendChild(name);
    
    const count = document.createElement('span');
    count.className = 'group-count';
    const fileCount = group.items ? countFiles(group.items) : 0;
    count.textContent = fileCount;
    
    groupDiv.appendChild(header);
    
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'folder-tree';
    itemsContainer.id = `group-${typeof groupIndex === 'string' ? groupIndex : `group-${groupIndex}`}`;
    
    if (group.items) {
        group.items.forEach(item => {
            const itemElement = createItemElement(item);
            itemsContainer.appendChild(itemElement);
        });
    }
    
    groupDiv.appendChild(itemsContainer);
    
    return groupDiv;
}

// 創建資料夾樹元素
function createFolderTreeElement(folder) {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'group-item folder-tree-root';
    folderDiv.dataset.path = folder.path;
    
    const header = document.createElement('div');
    header.className = 'group-header folder-header';
    header.onclick = () => toggleFolderTree(folder.path);
    header.setAttribute('data-tooltip', folder.name);

    const toggleIcon = document.createElement('i');
    toggleIcon.className = `fas fa-chevron-${folder.expanded ? 'down' : 'right'} folder-tree-toggle`;
    header.appendChild(toggleIcon);
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-folder group-icon-orange';
    header.appendChild(icon);
    
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = folder.name;
    name.title = folder.path;
    header.appendChild(name);
    
    const count = document.createElement('span');
    count.className = 'group-count';
    count.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>';
    //header.appendChild(count);
    
    folderDiv.appendChild(header);
    
    const treeContainer = document.createElement('div');
    treeContainer.className = 'folder-tree';
    treeContainer.id = `folder-tree-${folder.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    treeContainer.style.display = folder.expanded ? 'block' : 'none';
    
    folderDiv.appendChild(treeContainer);
    
    if (folder.expanded) {
        loadFolderContents(folder.path, treeContainer, count);
    }
    
    return folderDiv;
}

// 創建單獨檔案元素
function createSingleFileElement(file) {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'group-item single-file-item';
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item standalone-file';
    fileItem.onclick = () => openFile(file);
    fileItem.setAttribute('data-tooltip', file.name);

    const mainContainer = document.createElement('div');
    mainContainer.style.display = 'flex';
    mainContainer.style.alignItems = 'center';
    mainContainer.style.width = '100%';
    mainContainer.style.gap = '10px';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-alt item-icon';
    icon.style.color = '#667eea';
    mainContainer.appendChild(icon);
    
    if (!sidebarCollapsed) {
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = file.name;
        name.title = file.path;
        mainContainer.appendChild(name);
    }
    
    fileItem.appendChild(mainContainer);
    fileDiv.appendChild(fileItem);
    
    return fileDiv;
}

// 切換資料夾樹
function toggleFolderTree(folderPath) {
    const treeId = `folder-tree-${folderPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const treeContainer = document.getElementById(treeId);
    const header = treeContainer.previousElementSibling;
    const toggleIcon = header.querySelector('.folder-tree-toggle');
    const count = header.querySelector('.group-count');
    
    if (treeContainer) {
        if (treeContainer.style.display === 'none') {
            treeContainer.style.display = 'block';
            toggleIcon.className = 'fas fa-chevron-down folder-tree-toggle';
            
            if (treeContainer.innerHTML === '') {
                loadFolderContents(folderPath, treeContainer, count);
            }
        } else {
            treeContainer.style.display = 'none';
            toggleIcon.className = 'fas fa-chevron-right folder-tree-toggle';
        }
    }
}

// 載入資料夾內容
async function loadFolderContents(folderPath, container, countElement) {
    try {
        container.innerHTML = `
            <div class="loading-folder">
                <i class="fas fa-spinner fa-spin"></i> 載入中...
            </div>
        `;
        
        const response = await fetch(`/api/browse?path=${encodeURIComponent(folderPath)}`);
        const data = await response.json();
        
        if (data.error) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i> ${data.error}
                </div>
            `;
            countElement.textContent = '!';
            return;
        }
        
        container.innerHTML = '';
        let fileCount = 0;
        
        if (data.items && data.items.length > 0) {
            const items = data.items.filter(item => !item.is_parent);
            
            items.forEach(item => {
                const itemElement = createItemElement(item);
                container.appendChild(itemElement);
                
                if (item.type === 'file') {
                    fileCount++;
                }
            });
            
            countElement.textContent = fileCount;
        } else {
            container.innerHTML = `
                <div class="empty-folder-message">
                    <i class="fas fa-folder-open"></i> 空資料夾
                </div>
            `;
            countElement.textContent = '0';
        }
        
    } catch (error) {
        console.error('載入資料夾內容失敗:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i> 載入失敗
            </div>
        `;
        countElement.textContent = '!';
    }
}

// 創建項目元素
function createItemElement(item, level = 0) {
    const itemDiv = document.createElement('div');
    
    if (item.type === 'folder') {
        itemDiv.className = 'folder-item';
        const hasChildren = item.children && item.children.length > 0;
        
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.width = '100%';
        
        if (hasChildren) {
            const toggleBtn = document.createElement('i');
            toggleBtn.className = 'fas fa-chevron-right folder-toggle';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFolder(toggleBtn);
            };
            mainContainer.appendChild(toggleBtn);
        } else {
            const spacer = document.createElement('span');
            spacer.style.width = '20px';
            mainContainer.appendChild(spacer);
        }
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-folder item-icon';
        icon.style.color = '#f39c12';
        mainContainer.appendChild(icon);
        
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.name;
        mainContainer.appendChild(name);
        
        itemDiv.appendChild(mainContainer);
        
        if (hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'folder-children';
            
            item.children.forEach(child => {
                const childElement = createItemElement(child, level + 1);
                childrenDiv.appendChild(childElement);
            });
            
            itemDiv.appendChild(childrenDiv);
        }
        // 資料夾也可以拖曳（用於打開）
        itemDiv.draggable = true;
        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'folder',
                path: item.path,
                name: item.name
            }));
            e.dataTransfer.effectAllowed = 'copy';
        });        
    } else {
        itemDiv.className = 'file-item';
        itemDiv.onclick = () => openFile(item);
        itemDiv.draggable = true;

        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.width = '100%';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-file-alt item-icon';
        icon.style.color = '#667eea';
        mainContainer.appendChild(icon);
        
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.name;
        mainContainer.appendChild(name);
        
        itemDiv.appendChild(mainContainer);

        // 檔案拖曳事件
        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'file',
                path: item.path,
                name: item.name
            }));
            e.dataTransfer.effectAllowed = 'copy';
            itemDiv.style.opacity = '0.5';
        });
        
        itemDiv.addEventListener('dragend', (e) => {
            itemDiv.style.opacity = '1';
        });        
    }
    
    return itemDiv;
}

// 切換群組
function toggleGroup(groupIndex) {
    const itemsContainer = document.getElementById(`group-${typeof groupIndex === 'string' ? groupIndex : `group-${groupIndex}`}`);
    if (itemsContainer) {
        itemsContainer.style.display = itemsContainer.style.display === 'none' ? 'block' : 'none';
    }
}

// 切換資料夾
function toggleFolder(element) {
    const folderItem = element.closest('.folder-item');
    const childrenDiv = folderItem.querySelector('.folder-children');
    
    if (childrenDiv) {
        childrenDiv.classList.toggle('expanded');
        element.classList.toggle('expanded');
    }
}

// 開啟檔案 - 優化版本
function openFile(file, switchToTab = true) {
    console.log('開啟檔案:', file, 'switchToTab:', switchToTab, 'splitView:', splitView);
    
    if (!file || !file.path) {
        console.error('檔案資料不完整:', file);
        showToast('檔案資料不完整', 'error');
        return null;
    }
    
    // 清理檔案名稱（移除可能的 * 標記）
    if (file.name && file.name.endsWith('*')) {
        file.name = file.name.slice(0, -1);
    }
    
    // 檢查是否為臨時檔案
    if (file.path.startsWith('/temp/')) {
        file.isLocal = true;
        file.isEditable = true;
    }
    
    const existingTab = currentTabs.find(tab => tab.path === file.path);
    
    if (existingTab) {
        if (switchToTab && !splitView) {
            switchTab(existingTab.id);
        }
        return existingTab;
    }

    // === 新增：分割視窗智能載入邏輯 ===
    if (splitView && switchToTab !== false) {
        console.log('分割視窗模式處理');
        
        // 檢查兩個視窗的狀態
        const leftContent = document.getElementById('split-left-content');
        const rightContent = document.getElementById('split-right-content');
        
        // 檢查是否有檔案載入
        const leftHasFile = leftContent && (
            leftContent.dataset.filePath || 
            (leftContent.querySelector('.empty-state')?.style.display === 'none')
        );
        const rightHasFile = rightContent && (
            rightContent.dataset.filePath || 
            (rightContent.querySelector('.empty-state')?.style.display === 'none')
        );
        
        console.log('視窗狀態:', { leftHasFile, rightHasFile });
        
        if (!leftHasFile && !rightHasFile) {
            // 兩個視窗都空：顯示選擇對話框
            console.log('兩個視窗都空，顯示選擇對話框');
            pendingFileForPane = file;
            
            // 確保對話框元素存在
            const modal = document.getElementById('pane-select-modal');
            if (modal) {
                modal.classList.add('show');
                return null;
            } else {
                console.error('找不到選擇對話框元素');
                // 預設載入到左側
                const tab = createAndLoadTab(file, 'left');
                showToast(`已載入到左側視窗: ${file.name}`, 'success');
                return tab;
            }
        } else if (!leftHasFile && rightHasFile) {
            // 只有左側空：自動載入到左側
            const tab = createAndLoadTab(file, 'left');
            showToast(`已載入到左側視窗: ${file.name}`, 'success');
            return tab;
        } else if (leftHasFile && !rightHasFile) {
            // 只有右側空：自動載入到右側
            const tab = createAndLoadTab(file, 'right');
            showToast(`已載入到右側視窗: ${file.name}`, 'success');
            return tab;
        } else {
            // 兩個視窗都滿：顯示選擇對話框讓使用者選擇要替換哪個
            console.log('兩個視窗都有檔案，顯示選擇對話框');
            pendingFileForPane = file;
            showPaneSelectModal();
            return null;
        }
    }
    // === 結束新增 ===

    const tabId = generateTabId();
    const colorIndex = file.color ? tabColors.indexOf(file.color) : tabCounter % tabColors.length;
    const tab = {
        id: tabId,
        name: file.name || file.path.split('/').pop() || 'Untitled',
        path: file.path,
        content: null,
        loading: true,
        color: file.color || tabColors[colorIndex >= 0 ? colorIndex : tabCounter % tabColors.length],
        isLocal: file.isLocal || false,
        isEditable: file.isEditable || false,
        loadStartTime: Date.now(),
        splitPane: file.splitPane || null
    };
    
    console.log('創建新標籤:', tab);
    
    tabCounter++;
    currentTabs.push(tab);

    // 只在非分割視窗模式下，或明確要求切換時才更新 activeTabId
    if ((switchToTab && !splitView) || !activeTabId) {
        activeTabId = tab.id;
    }
    
    renderTabs();
    
    // 只在非分割視窗模式且要切換標籤時才更新主視窗內容
    if (switchToTab && !splitView) {
        const viewerContainer = document.getElementById('file-viewer');
        viewerContainer.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        
        // 載入檔案內容到主視窗
        loadFileContentOptimized(file.path, tabId, file.isLocal);
    } else if (!splitView) {
        // 非分割視窗模式但不切換標籤，仍需要載入內容
        loadFileContentOptimized(file.path, tabId, file.isLocal);
    }
    // 如果是分割視窗模式，不在這裡載入內容，等待後續指定到特定面板

    // 修復：即使在分割視窗模式下，也需要載入內容到標籤
    if (splitView && !switchToTab) {
        // 背景載入內容，但不顯示
        setTimeout(() => {
            loadFileContentOptimized(file.path, tabId, file.isLocal);
        }, 100);
    }

    addToRecentFiles(file);
    
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    return tab;
}

// 創建並載入標籤到指定面板
function createAndLoadTab(file, pane) {
    console.log('創建並載入標籤:', file, '到面板:', pane);
    
    const tabId = generateTabId();
    const colorIndex = tabCounter % tabColors.length;
    const tab = {
        id: tabId,
        name: file.name || file.path.split('/').pop() || 'Untitled',
        path: file.path,
        content: null,
        loading: true,
        color: file.color || tabColors[colorIndex],
        isLocal: file.isLocal || false,
        isEditable: file.isEditable || false,
        loadStartTime: Date.now(),
        splitPane: pane
    };
    
    tabCounter++;
    currentTabs.push(tab);
    renderTabs();
    
    // 確保載入到指定面板
    setTimeout(() => {
        loadFileToPane(tab, pane);
    }, 100);
    
    addToRecentFiles(file);
    
    return tab;
}

// 只創建標籤，不載入內容
function createTabOnly(file) {
    const tabId = generateTabId();
    const colorIndex = tabCounter % tabColors.length;
    const tab = {
        id: tabId,
        name: file.name || file.path.split('/').pop() || 'Untitled',
        path: file.path,
        content: null,
        loading: false, // 不設為 loading
        color: file.color || tabColors[colorIndex],
        isLocal: file.isLocal || false,
        isEditable: file.isEditable || false,
        loadStartTime: Date.now(),
        splitPane: null
    };
    
    tabCounter++;
    currentTabs.push(tab);
    renderTabs();
    
    addToRecentFiles(file);
    
    return tab;
}

// 顯示面板選擇對話框
function showPaneSelectModal() {
    document.getElementById('pane-select-modal').classList.add('show');
}

// 關閉面板選擇對話框
function closePaneSelectModal() {
    const modal = document.getElementById('pane-select-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 選擇面板
function selectPane(pane) {
    console.log('選擇面板:', pane, '待載入檔案:', pendingFileForPane);
    
    // 先保存檔案資訊，避免被清空
    const fileToLoad = pendingFileForPane;
    const replaceFunc = window.selectPaneForReplace;
    
    // 關閉對話框
    closePaneSelectModal();
    
    if (fileToLoad) {
        // 如果是替換模式
        if (replaceFunc) {
            replaceFunc(pane);
        } else {
            // 正常載入模式
            console.log('開始載入檔案:', fileToLoad.name, '到', pane, '面板');
            const tab = createAndLoadTab(fileToLoad, pane);
            if (tab) {
                showToast(`已載入到${pane === 'left' ? '左側' : '右側'}視窗: ${fileToLoad.name}`, 'success');
            } else {
                console.error('創建標籤失敗');
                showToast('載入檔案失敗', 'error');
            }
        }
    } else {
        console.error('沒有待載入的檔案');
        showToast('沒有選擇檔案', 'error');
    }
    
    // 在處理完成後才清空
    pendingFileForPane = null;
    window.selectPaneForReplace = null;
}

// 優化的載入檔案內容函數
async function loadFileContentOptimized(filePath, tabId, isLocal = false) {
    console.log('開始載入檔案內容（優化版）:', { filePath, tabId, isLocal });
    
    try {
        const tab = currentTabs.find(t => t.id === tabId);
        if (!tab) {
            console.error('找不到標籤:', tabId);
            return;
        }
        
        tab.loading = true;
        tab.content = null;
        
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'iframe-loading';
        loadingDiv.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        container.appendChild(loadingDiv);
        
        const iframe = document.createElement('iframe');
        iframe.id = `iframe-${tabId}`;
        // 確保 iframe 可以接收拖放事件
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        
        // 檢查是否為可編輯檔案
        if (tab.isEditable) {
            window.textEditor.loadEditorToTab(tab);
            return;
        }        
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        
        if (isLocal) {
            iframe.src = filePath;
        } else {
            const encodedPath = encodeURIComponent(filePath);
            iframe.src = `/file_viewer?path=${encodedPath}`;
        }
        
        console.log('創建 iframe，src:', iframe.src);
        
        let loadingCheckInterval = null;
        let loadTimeout = null;
        
        iframe.onload = () => {
            console.log('iframe 載入完成');
            clearInterval(loadingCheckInterval);
            clearTimeout(loadTimeout);
            
            const loadTime = Date.now() - tab.loadStartTime;
            console.log(`檔案載入完成，耗時: ${loadTime}ms`);
            
            if (loadingDiv) {
                loadingDiv.classList.add('iframe-loaded');
                setTimeout(() => {
                    if (container.contains(loadingDiv)) {
                        container.removeChild(loadingDiv);
                    }
                }, 300);
            }
            
            tab.loading = false;
            tab.content = container;
            renderTabs();

            // 修復：確保在分割視窗模式下也更新標籤狀態
            if (splitView && tab.splitPane) {
                // 強制更新標籤狀態
                const tabToUpdate = currentTabs.find(t => t.id === tabId);
                if (tabToUpdate) {
                    tabToUpdate.loading = false;
                    renderTabs();
                }
            }

            if (loadTime > 3000) {
                showToast(`檔案載入完成 (${(loadTime/1000).toFixed(1)}秒)`, 'success');
            }
        };
        
        iframe.onerror = (error) => {
            console.error('iframe 載入失敗:', error);
            clearInterval(loadingCheckInterval);
            clearTimeout(loadTimeout);
            
            tab.loading = false;
            tab.content = null;
            renderTabs();
            
            // 如果是臨時檔案或可編輯檔案，嘗試使用文字編輯器
            if (tab.isEditable && window.textEditor) {
                console.log('嘗試使用文字編輯器載入');
                window.textEditor.loadEditorToTab(tab);
                return;
            }
            
            if (tabId === activeTabId) {
                showErrorState(filePath);
            }
        };
        
        container.appendChild(iframe);
        
        // 只在非分割視窗模式或是活動標籤時才更新主視窗
        if (tabId === activeTabId && !splitView) {
            const viewerContainer = document.getElementById('file-viewer');
            viewerContainer.innerHTML = '';
            viewerContainer.appendChild(container);
        }
        
        tab.content = container;
        
        loadTimeout = setTimeout(() => {
            if (tab.loading) {
                console.warn('載入時間過長，可能是大檔案');
                showToast('檔案較大，載入中...', 'info');
            }
        }, 10000);
        
        loadingTimeouts[tabId] = setTimeout(() => {
            if (tab.loading) {
                console.error('載入超時');
                clearInterval(loadingCheckInterval);
                clearTimeout(loadTimeout);
                
                tab.loading = false;
                renderTabs();
                if (tabId === activeTabId) {
                    showErrorState(filePath, '載入超時');
                }
            }
        }, 60000);
        
    } catch (error) {
        console.error('載入檔案內容失敗:', error);
        showToast('載入檔案失敗', 'error');
    }
}

// 載入檔案內容到特定面板
async function loadFileContentForPane(filePath, tabId, isLocal = false, pane) {
    console.log('載入檔案內容到面板:', { filePath, tabId, isLocal, pane });
    
    try {
        const content = document.getElementById(`split-${pane}-content`);
        const tab = currentTabs.find(t => t.id === tabId);
        
        if (!content) {
            console.error(`找不到面板內容元素: split-${pane}-content`);
            return;
        }
        
        if (!tab) {
            console.error('找不到標籤:', tabId);
            return;
        }
        
        // 如果是可編輯檔案，使用文字編輯器
        if (tab && tab.isEditable) {
            window.textEditor.loadEditorToPane(tab, pane);
            return;
        }
        
        const title = document.getElementById(`split-${pane}-title`);
        const emptyState = document.getElementById(`split-${pane}-empty`);
        
        // 移除空狀態
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // 顯示載入中
        content.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
            </div>
        `;

        // 更新標題
        if (title) {
            const fileName = filePath.split('/').pop();
            title.textContent = fileName;
            title.title = filePath;
        }

        const iframe = document.createElement('iframe');
        iframe.id = `iframe-${pane}-${tabId}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        
        if (isLocal) {
            iframe.src = filePath;
        } else {
            iframe.src = `/file_viewer?path=${encodeURIComponent(filePath)}`;
        }
        
        // 重要：確保 iframe 載入完成後設置通信
        iframe.onload = () => {
            console.log(`檔案載入完成到 ${pane} 面板`);
            
            content.dataset.tabId = tabId;
            content.dataset.filePath = filePath;
            
            // 更新全域狀態
            window.splitViewState = window.splitViewState || { left: null, right: null };
            window.splitViewState[pane] = filePath;
            splitViewState = window.splitViewState;
            
            // 確保標籤狀態正確更新
            if (tab) {
                tab.loading = false;
                tab.splitPane = pane;
                renderTabs();
            }
            
            // 設置 iframe 通信 - 重要！
            setupIframeCommunication(iframe, pane);
            
            // 延遲一下確保 iframe 內容完全載入
            setTimeout(() => {
                // 發送初始化訊息
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'init',
                        pane: pane
                    }, '*');
                }
                
                console.log(`${pane} 視窗已完全準備好`);
            }, 500);
        };
        
        iframe.onerror = () => {
            console.error('iframe 載入失敗');
            content.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>載入失敗</p>
                    <button class="btn btn-primary" onclick="refreshPane('${pane}')">
                        <i class="fas fa-redo"></i> 重試
                    </button>
                </div>
            `;
        };
        
        content.innerHTML = '';
        content.appendChild(iframe);
        
    } catch (error) {
        console.error('載入到面板失敗:', error);
        showToast('載入檔案失敗', 'error');
    }
}

// 設置 iframe 通信
function setupIframeCommunication(iframe, pane) {
    if (!iframe || !iframe.contentWindow) {
        console.error('無法設置 iframe 通信:', pane);
        return;
    }
    
    // 立即發送初始化訊息
    try {
        iframe.contentWindow.postMessage({
            type: 'init',
            pane: pane
        }, '*');
        console.log(`已設置 ${pane} 視窗的 iframe 通信`);
    } catch (error) {
        console.error(`設置 ${pane} 視窗通信失敗:`, error);
    }
}

// 生成標籤ID
function generateTabId() {
    return 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 渲染標籤
function renderTabs() {
    const tabsContainer = document.getElementById('file-tabs');

    // 保存當前顯示的顏色選擇器
    let activeColorPicker = null;
    let activeColorPickerTabId = null;
    if (window.currentColorPickerId) {
        const picker = document.getElementById(window.currentColorPickerId);
        if (picker && picker.classList.contains('show')) {
            activeColorPicker = {
                id: window.currentColorPickerId,
                style: {
                    position: picker.style.position,
                    left: picker.style.left,
                    top: picker.style.top,
                    transform: picker.style.transform,
                    zIndex: picker.style.zIndex,
                    display: picker.style.display
                }
            };
            // 從 ID 中提取 tab ID
            activeColorPickerTabId = window.currentColorPickerId.replace('color-picker-', '');
        }
    }

    // 檢查標籤數量，如果超過 10 個則加入特殊類別
    if (currentTabs.length > 10) {
        tabsContainer.classList.add('many-tabs');
        
        // 手機版顯示標籤計數器
        if (window.innerWidth <= 768) {
            showTabsCounter();
        }
    } else {
        tabsContainer.classList.remove('many-tabs');
        hideTabsCounter();
    }
    
    // 檢查是否可滾動
    setTimeout(() => {
        if (tabsContainer.scrollWidth > tabsContainer.clientWidth) {
            tabsContainer.classList.add('scrollable');
        } else {
            tabsContainer.classList.remove('scrollable');
        }
    }, 100);

    const mobileBtn = tabsContainer.querySelector('.mobile-menu-btn');
    const addBtn = tabsContainer.querySelector('.add-tab-btn');
    
    const existingTabs = tabsContainer.querySelectorAll('.file-tab');
    existingTabs.forEach(tab => tab.remove());
    
    currentTabs.forEach(tab => {
        const tabElement = createTabElement(tab);
        if (addBtn) {
            tabsContainer.insertBefore(tabElement, addBtn);
        } else {
            tabsContainer.appendChild(tabElement);
        }
    });

    // 在渲染完成後恢復顏色選擇器
    if (activeColorPicker && activeColorPickerTabId) {
        setTimeout(() => {
            const newPicker = document.getElementById(activeColorPicker.id);
            if (newPicker) {
                // 恢復樣式
                Object.assign(newPicker.style, activeColorPicker.style);
                newPicker.classList.add('show');
                
                // 重新設置關閉處理器
                const closeHandler = function(e) {
                    if (!e.target.closest('.color-picker') && !e.target.closest('.file-tab')) {
                        newPicker.classList.remove('show');
                        newPicker.style.display = 'none';
                        window.currentColorPickerId = null;
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }
        }, 50);
    }    
}

// 創建標籤元素
function createTabElement(tab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = `file-tab ${tab.id === activeTabId ? 'active' : ''}`;
    tabDiv.style.setProperty('--tab-color', tab.color);
    tabDiv.dataset.tabId = tab.id;
    tabDiv.draggable = true;
    
    // 拖放事件
    tabDiv.addEventListener('dragstart', (e) => {
        tabDiv.classList.add('dragging');
        tabDragData = tab;
        e.dataTransfer.effectAllowed = 'copy';
        // 設置拖曳資料
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'tab',
            tabId: tab.id,
            path: tab.path,
            name: tab.name
        }));
    });
    
    tabDiv.addEventListener('dragend', (e) => {
        tabDiv.classList.remove('dragging');
        
        // 重新排序 currentTabs
        const allTabs = document.querySelectorAll('.file-tab');
        const newOrder = [];
        allTabs.forEach(tabEl => {
            const tabId = tabEl.dataset.tabId;
            const tab = currentTabs.find(t => t.id === tabId);
            if (tab) newOrder.push(tab);
        });
        currentTabs = newOrder;
    });

    // 防止拖曳時選取文字
    tabDiv.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
    
    // 點擊事件
    tabDiv.onclick = (e) => {
        if (e.target.closest('.tab-close') || e.target.closest('.color-picker')) {
            return;
        }
        
        // 分割視窗模式下的特殊處理
        if (splitView) {
            // 如果標籤已經在某個面板顯示
            if (tab.splitPane) {
                // 不做任何事，保持當前狀態
                showToast(`檔案已在${tab.splitPane === 'left' ? '左側' : '右側'}視窗顯示`, 'info');
            } else {
                // 標籤還沒有載入到任何面板
                const leftEmpty = !splitViewState.left;
                const rightEmpty = !splitViewState.right;
                
                if (leftEmpty || rightEmpty) {
                    // 有空面板，載入到空面板
                    const targetPane = leftEmpty ? 'left' : 'right';
                    tab.splitPane = targetPane;
                    loadFileToPane(tab, targetPane);
                    showToast(`已載入到${targetPane === 'left' ? '左側' : '右側'}視窗`, 'success');
                } else {
                    // 沒有空面板，顯示選擇對話框
                    pendingFileForPane = {
                        name: tab.name,
                        path: tab.path,
                        isLocal: tab.isLocal,
                        isEditable: tab.isEditable
                    };
                    // 修改選擇後的行為，替換而不是新增
                    window.selectPaneForReplace = function(pane) {
                        closePaneSelectModal();
                        tab.splitPane = pane;
                        loadFileToPane(tab, pane);
                        showToast(`已替換${pane === 'left' ? '左側' : '右側'}視窗內容`, 'success');
                    };
                    showPaneSelectModal();
                }
            }
        } else {
            // 非分割視窗模式，正常切換
            switchTab(tab.id);
        }
    };

    // 確保 ondblclick 事件正確設置（雙擊顯示顏色選擇器）
    tabDiv.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 檢查是否為手機版
        if (window.innerWidth <= 768) {
            showTabContextMenu(e, tab);
        }
    };

    // 雙擊事件
    let tapTimeout = null;
    let tapCount = 0;

    tabDiv.addEventListener('click', (e) => {
        // 只在手機版處理
        if (window.innerWidth > 768) return;
        
        // 如果點擊的是關閉按鈕或顏色選擇器，不處理
        if (e.target.closest('.tab-close') || e.target.closest('.color-picker')) {
            return;
        }
        
        tapCount++;
        
        if (tapCount === 1) {
            tapTimeout = setTimeout(() => {
                tapCount = 0;
                // 單擊切換標籤的邏輯已在 onclick 處理
            }, 300);
        } else if (tapCount === 2) {
            clearTimeout(tapTimeout);
            tapCount = 0;
            
            // 真正的雙擊才顯示顏色選擇器
            e.preventDefault();
            e.stopPropagation();
            showTabContextMenu(e, tab);
        }
    });

    tabDiv.oncontextmenu = (e) => showTabContextMenu(e, tab);
    tabDiv.title = tab.path;
    
    // 圖標
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-alt tab-icon';
    tabDiv.appendChild(icon);
    
    // 如果是分割視窗的檔案，顯示特殊圖標
    if (tab.splitPane) {
        const splitIcon = document.createElement('i');
        splitIcon.className = 'fas fa-columns tab-split-icon';
        splitIcon.title = tab.splitPane === 'left' ? '左側視窗' : '右側視窗';
        tabDiv.appendChild(splitIcon);
    }
    
    // 標題
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.name;
    tabDiv.appendChild(title);
    
    // 載入中圖標
    if (tab.loading) {
        const loadingIcon = document.createElement('i');
        loadingIcon.className = 'fas fa-spinner fa-spin';
        loadingIcon.style.fontSize = '12px';
        loadingIcon.style.marginLeft = '6px';
        tabDiv.appendChild(loadingIcon);
    }
    
    // 關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.onclick = (e) => closeTab(tab.id, e);
    closeBtn.title = '關閉';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    tabDiv.appendChild(closeBtn);
    
    // 顏色選擇器
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    colorPicker.id = `color-picker-${tab.id}`;
    tabColors.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.setAttribute('data-color', index + 1);
        colorOption.style.background = color;
        
        // 修改點擊事件，支援觸控
        const handleColorSelect = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('選擇顏色:', color); // 除錯用
            
            changeTabColor(tab.id, color);
            colorPicker.classList.remove('show');
            colorPicker.style.display = 'none';
            
            // 清理事件監聽器
            if (window.colorPickerCloseHandler) {
                document.removeEventListener('click', window.colorPickerCloseHandler);
                document.removeEventListener('touchstart', window.colorPickerCloseHandler);
                window.colorPickerCloseHandler = null;
            }
        };
        
        // 同時支援點擊和觸控
        colorOption.onclick = handleColorSelect;
        colorOption.addEventListener('touchend', handleColorSelect);
        
        colorPicker.appendChild(colorOption);
    });
    tabDiv.appendChild(colorPicker);

    // 根據設備類型決定添加位置
    if (window.innerWidth <= 768) {
        // 手機版：添加到 body
        document.body.appendChild(colorPicker);
    } else {
        // 桌面版：添加到標籤
        tabDiv.appendChild(colorPicker);
    }

    return tabDiv;
}

// 顯示標籤右鍵選單
function showTabContextMenu(e, tab) {
    e.preventDefault();
    e.stopPropagation();
    
    // 先關閉所有顏色選擇器
    document.querySelectorAll('.color-picker').forEach(picker => {
        picker.classList.remove('show');
        picker.style.display = 'none';
    });
    
    const colorPicker = document.getElementById(`color-picker-${tab.id}`);
    if (colorPicker) {
        // 使用 fixed 定位，相對於視窗
        const tabElement = e.currentTarget;
        const rect = tabElement.getBoundingClientRect();
        
        // 檢測是否為手機版
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // 手機版：顯示在標籤下方
            colorPicker.style.position = 'fixed';
            colorPicker.style.left = '50%';
            colorPicker.style.top = '60px';
            colorPicker.style.bottom = 'auto';
            colorPicker.style.transform = 'translateX(-50%)';
            colorPicker.style.zIndex = '99999';
            
            // 確保顏色選擇器在最上層
            document.body.appendChild(colorPicker);
        } else {
            // 桌面版：保持原有邏輯
            let left = rect.left;
            let top = rect.bottom + 5;
            
            if (left + 160 > window.innerWidth) {
                left = window.innerWidth - 170;
            }
            
            if (top + 80 > window.innerHeight) {
                top = rect.top - 85;
            }
            
            colorPicker.style.position = 'fixed';
            colorPicker.style.left = `${left}px`;
            colorPicker.style.top = `${top}px`;
            colorPicker.style.transform = 'none';
            colorPicker.style.zIndex = '99999';
        }
        
        colorPicker.style.display = 'grid';
        colorPicker.classList.add('show');
        
        // 儲存當前顯示的顏色選擇器 ID
        window.currentColorPickerId = `color-picker-${tab.id}`;
        
        // 移除舊的事件監聽器
        if (window.colorPickerCloseHandler) {
            document.removeEventListener('click', window.colorPickerCloseHandler);
            document.removeEventListener('touchstart', window.colorPickerCloseHandler);
        }
        
        // 點擊其他地方關閉（支援觸控）
        window.colorPickerCloseHandler = function(e) {
            // 如果點擊的是顏色選擇器內部，不關閉
            if (e.target.closest('.color-picker')) {
                return;
            }
            
            // 如果點擊的是標籤，也不關閉（避免雙擊時立即關閉）
            if (e.target.closest('.file-tab')) {
                return;
            }
            
            // 關閉顏色選擇器
            colorPicker.classList.remove('show');
            colorPicker.style.display = 'none';
            window.currentColorPickerId = null;
            
            // 移除事件監聽器
            document.removeEventListener('click', window.colorPickerCloseHandler);
            document.removeEventListener('touchstart', window.colorPickerCloseHandler);
            window.colorPickerCloseHandler = null;
        };
        
        // 延遲添加事件監聽器，避免立即觸發
        setTimeout(() => {
            document.addEventListener('click', window.colorPickerCloseHandler);
            document.addEventListener('touchstart', window.colorPickerCloseHandler);
        }, 100);
    }
}

// 更改標籤顏色
function changeTabColor(tabId, color) {
    const tab = currentTabs.find(t => t.id === tabId);
    if (tab) {
        tab.color = color;
        
        // 不要立即渲染，只更新當前標籤的顏色
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.style.setProperty('--tab-color', color);
        }
        
        // 延遲渲染，避免顏色選擇器立即消失
        setTimeout(() => {
            renderTabs();
        }, 300);
    }
}

// 切換標籤
function switchTab(tabId) {
    console.log('切換到標籤:', tabId);
    
    activeTabId = tabId;
    renderTabs();
    
    const tab = currentTabs.find(t => t.id === tabId);
    if (tab) {
        const viewerContainer = document.getElementById('file-viewer');
        
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        if (splitView) {
            // 如果在分割視窗模式，不切換內容
            return;
        } else {
            viewerContainer.innerHTML = '';
            
            if (tab.content && !tab.loading) {
                console.log('顯示標籤內容');
                viewerContainer.appendChild(tab.content);
            } else if (tab.loading) {
                console.log('標籤還在載入中');
                if (tab.content) {
                    viewerContainer.appendChild(tab.content);
                } else {
                    viewerContainer.innerHTML = `
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>載入中...</p>
                            <div class="loading-progress">
                                <div class="loading-progress-bar"></div>
                            </div>
                        </div>
                    `;
                }
            } else {
                console.log('需要載入標籤內容');
                tab.loading = true;
                renderTabs();
                loadFileContentOptimized(tab.path, tab.id, tab.isLocal);
            }
        }
    }
}

// 關閉標籤
function closeTab(tabId, event) {
    event.stopPropagation();
    
    if (loadingTimeouts[tabId]) {
        clearTimeout(loadingTimeouts[tabId]);
        delete loadingTimeouts[tabId];
    }
    
    const index = currentTabs.findIndex(t => t.id === tabId);
    if (index > -1) {
        const tab = currentTabs[index];
        
        // 如果是可編輯檔案，檢查是否已儲存
        if (tab.isEditable && window.textEditor) {
            if (!window.textEditor.handleUnsavedFileClose(tab)) {
                return; // 用戶取消關閉
            }
        }
        
        // 如果是分割視窗的檔案，關閉對應的分割視窗
        if (tab.splitPane && splitView) {
            // 關閉分割視窗
            window.closeSplitPane(tab.splitPane);
            return; // closeSplitPane 會處理後續邏輯
        }
        
        currentTabs.splice(index, 1);
        
        if (activeTabId === tabId && currentTabs.length > 0) {
            const newIndex = Math.min(index, currentTabs.length - 1);
            switchTab(currentTabs[newIndex].id);
        } else if (currentTabs.length === 0) {
            activeTabId = null;
            const viewerContainer = document.getElementById('file-viewer');
            viewerContainer.innerHTML = '';
            
            const emptyState = createEmptyState();
            viewerContainer.appendChild(emptyState);
        }
        
        renderTabs();
    }
}

// 創建空狀態
function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = 'empty-state';
    div.innerHTML = `
        <i class="fas fa-file-alt"></i>
        <h5>選擇檔案開始瀏覽</h5>
        <p>從左側檔案樹選擇檔案，或拖曳檔案到此處</p>
        <button class="empty-state-btn" onclick="openUploadModal()">
            <i class="fas fa-upload"></i>
            上傳檔案
        </button>
    `;
    
    return div;
}

// 顯示錯誤狀態
function showErrorState(filePath, message = '載入檔案失敗') {
    const viewerContainer = document.getElementById('file-viewer');
    viewerContainer.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <p style="font-size: 12px; color: #999;">${filePath}</p>
            <button class="btn btn-primary" onclick="retryLoadFile('${filePath}')">
                <i class="fas fa-redo"></i> 重試
            </button>
        </div>
    `;
}

// 重試載入檔案
window.retryLoadFile = function(filePath) {
    const tab = currentTabs.find(t => t.path === filePath);
    if (tab) {
        tab.loading = true;
        tab.content = null;
        tab.loadStartTime = Date.now();
        renderTabs();
        loadFileContentOptimized(filePath, tab.id, tab.isLocal);
    }
};

// 切換側邊欄
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggle-icon');
    const backdrop = document.getElementById('sidebar-backdrop');
    const settings = document.querySelector('.sidebar-settings');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('show');
        backdrop.classList.toggle('show');
        
        if (settings) {
            if (sidebar.classList.contains('show')) {
                settings.style.left = '0';
            } else {
                settings.style.left = '-100%';
            }
        }
    } else {
        sidebarCollapsed = !sidebarCollapsed;
        
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            toggleIcon.className = 'fas fa-chevron-right';
        } else {
            sidebar.classList.remove('collapsed');
            toggleIcon.className = 'fas fa-chevron-left';
        }
        // 重新渲染當前視圖
        if (currentView === 'recent') {
            renderRecentFiles();
        } else if (currentView === 'saved') {
            renderSavedWorkspaces();
        }        
    }
}

// 搜尋檔案
function searchFiles(query) {
    // 這個函數只處理側邊欄的檔案搜尋，不是內容搜尋
    const allItems = document.querySelectorAll('.file-item, .folder-item');
    
    if (!query) {
        allItems.forEach(item => {
            item.style.display = 'flex';
        });
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    
    allItems.forEach(item => {
        const nameElement = item.querySelector('.item-name');
        if (!nameElement) return;
        
        const name = nameElement.textContent.toLowerCase();
        if (name.includes(lowerQuery)) {
            item.style.display = 'flex';
            
            // 展開包含匹配項目的資料夾
            let parent = item.parentElement;
            while (parent && parent.classList.contains('folder-children')) {
                parent.classList.add('expanded');
                const folderItem = parent.previousElementSibling;
                if (folderItem) {
                    const toggle = folderItem.querySelector('.folder-toggle');
                    if (toggle) {
                        toggle.classList.add('expanded');
                    }
                }
                parent = parent.parentElement.parentElement;
            }
        } else {
            item.style.display = 'none';
        }
    });
}

// 顯示視圖
function showView(view, targetElement = null) {
    currentView = view;
    
    // 移除所有 active 類
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 添加 active 類到正確的元素
    if (targetElement) {
        // 如果有指定元素（從點擊事件來）
        targetElement.classList.add('active');
    } else if (event && event.currentTarget) {
        // 如果有事件對象（向後相容）
        event.currentTarget.classList.add('active');
    } else {
        // 如果都沒有，根據 view 找到對應的導航項
        let navIndex = 0;
        switch(view) {
            case 'files':
                navIndex = 0;
                break;
            case 'recent':
                navIndex = 1;
                break;
            case 'saved':
                navIndex = 2;
                break;
        }
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[navIndex]) {
            navItems[navIndex].classList.add('active');
        }
    }
    
    const container = document.getElementById('groups-container');
    if (!container) {
        console.error('找不到 groups-container 元素');
        return;
    }
    
    switch(view) {
        case 'files':
            renderGroups();
            break;
        case 'recent':
            renderRecentFiles();
            break;
        case 'saved':
            renderSavedWorkspaces();
            break;
    }
}

// 渲染最近檔案
function renderRecentFiles() {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';
    
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
        // 收合模式 - 顯示圖標列表
        if (recentFiles.length === 0) {
            container.innerHTML = `
                <div class="empty-icon-state">
                    <i class="fas fa-clock" style="font-size: 24px; color: #999;"></i>
                </div>
            `;
        } else {
            // 只顯示前 5 個最近檔案
            const displayFiles = recentFiles.slice(0, 5);
            displayFiles.forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'group-item';
                
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item standalone-file recent-file-icon-item';
                fileItem.onclick = () => openFile(file);
                fileItem.setAttribute('data-tooltip', file.name);
                
                const mainContainer = document.createElement('div');
                mainContainer.style.display = 'flex';
                mainContainer.style.alignItems = 'center';
                mainContainer.style.justifyContent = 'center';
                mainContainer.style.width = '100%';
                
                const icon = document.createElement('i');
                icon.className = 'fas fa-history item-icon';
                icon.style.fontSize = '20px';
                
                // 根據時間設置不同的透明度
                const hoursSinceOpen = (new Date() - new Date(file.openedAt)) / (1000 * 60 * 60);
                if (hoursSinceOpen < 1) {
                    icon.style.opacity = '1';
                } else if (hoursSinceOpen < 24) {
                    icon.style.opacity = '0.8';
                } else {
                    icon.style.opacity = '0.6';
                }
                
                mainContainer.appendChild(icon);
                fileItem.appendChild(mainContainer);
                
                // 添加時間標記
                /*if (index < 3) {
                    const badge = document.createElement('span');
                    badge.className = 'recent-time-badge';
                    badge.textContent = index + 1;
                    fileItem.appendChild(badge);
                }*/
                
                fileDiv.appendChild(fileItem);
                container.appendChild(fileDiv);
            });
            
            // 如果有更多檔案，顯示一個"更多"按鈕
            if (recentFiles.length > 5) {
                const moreDiv = document.createElement('div');
                moreDiv.className = 'group-item';
                
                const moreItem = document.createElement('div');
                moreItem.className = 'more-items-button';
                moreItem.setAttribute('data-tooltip', `還有 ${recentFiles.length - 8} 個檔案`);
                moreItem.innerHTML = `<i class="fas fa-ellipsis-h"></i>`;
                
                moreDiv.appendChild(moreItem);
                container.appendChild(moreDiv);
            }
        }
    } else {
        // 展開模式 - 保持原有的列表顯示
        const recentDiv = document.createElement('div');
        recentDiv.className = 'recent-files';
        
        if (recentFiles.length === 0) {
            recentDiv.innerHTML = `
                <div class="empty-state" style="padding: 40px;">
                    <i class="fas fa-clock" style="font-size: 48px;"></i>
                    <h6 style="margin-top: 15px;">沒有最近開啟的檔案</h6>
                </div>
            `;
        } else {
            recentFiles.forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'recent-file';
                fileDiv.onclick = () => openFile(file);
                
                fileDiv.innerHTML = `
                    <i class="fas fa-file-alt recent-file-icon"></i>
                    <div class="recent-file-info">
                        <div class="recent-file-name">${file.name}</div>
                        <div class="recent-file-path">${file.path}</div>
                    </div>
                    <div class="recent-file-time">${formatTime(file.openedAt)}</div>
                    <button class="delete-btn-circle" onclick="deleteRecentFile(event, ${index})" title="刪除">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                
                recentDiv.appendChild(fileDiv);
            });
        }
        
        container.appendChild(recentDiv);
    }
}

// 渲染已儲存的工作區
function renderSavedWorkspaces() {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';
    
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    const savedDiv = document.createElement('div');
    savedDiv.className = 'saved-workspaces';
    
    fetch('/api/multi_viewer/list')
        .then(response => response.json())
        .then(data => {
            if (isCollapsed) {
                // 收合模式 - 顯示圖標列表
                if (data.length === 0) {
                    container.innerHTML = `
                        <div class="empty-icon-state">
                            <i class="fas fa-save" style="font-size: 24px; color: #999;"></i>
                        </div>
                    `;
                } else {
                    // 只顯示前 5 個工作區
                    const displayWorkspaces = data.slice(0, 5);
                    displayWorkspaces.forEach((workspace, index) => {
                        const workspaceDiv = document.createElement('div');
                        workspaceDiv.className = 'group-item';
                        
                        const workspaceItem = document.createElement('div');
                        workspaceItem.className = 'workspace-item-icon standalone-file';
                        workspaceItem.onclick = () => loadWorkspace(workspace.id);
                        workspaceItem.setAttribute('data-tooltip', workspace.name);
                        
                        const mainContainer = document.createElement('div');
                        mainContainer.style.display = 'flex';
                        mainContainer.style.alignItems = 'center';
                        mainContainer.style.justifyContent = 'center';
                        mainContainer.style.width = '100%';
                        
                        const icon = document.createElement('i');
                        // 根據是否為私密工作區顯示不同圖標
                        if (workspace.is_public) {
                            icon.className = 'fas fa-folder-open workspace-icon';
                        } else {
                            icon.className = 'fas fa-lock workspace-icon';
                        }
                        icon.style.fontSize = '20px';
                        
                        mainContainer.appendChild(icon);
                        workspaceItem.appendChild(mainContainer);
                        
                        /* 為前三個添加編號
                        if (index < 3) {
                            const badge = document.createElement('span');
                            badge.className = 'workspace-number-badge';
                            badge.textContent = index + 1;
                            workspaceItem.appendChild(badge);
                        }*/
                        
                        workspaceDiv.appendChild(workspaceItem);
                        container.appendChild(workspaceDiv);
                    });
                    
                    // 如果有更多工作區，顯示一個"更多"按鈕
                    if (data.length > 5) {
                        const moreDiv = document.createElement('div');
                        moreDiv.className = 'group-item';
                        
                        const moreItem = document.createElement('div');
                        moreItem.className = 'more-items-button';
                        moreItem.setAttribute('data-tooltip', `還有 ${data.length - 6} 個工作區`);
                        moreItem.innerHTML = `<i class="fas fa-ellipsis-h"></i>`;
                        
                        moreDiv.appendChild(moreItem);
                        container.appendChild(moreDiv);
                    }
                }
            } else {
                // 展開模式 - 保持原有的列表顯示
                if (data.length === 0) {
                    savedDiv.innerHTML = `
                        <div class="empty-state" style="padding: 40px;">
                            <i class="fas fa-save" style="font-size: 48px;"></i>
                            <h6 style="margin-top: 15px;">沒有已儲存的工作區</h6>
                        </div>
                    `;
                } else {
                    data.forEach(workspace => {
                        const workspaceDiv = document.createElement('div');
                        workspaceDiv.dataset.workspaceId = workspace.id;
                        workspaceDiv.className = 'workspace-item';
                        workspaceDiv.onclick = () => loadWorkspace(workspace.id);
                        
                        workspaceDiv.innerHTML = `
                            <div class="workspace-name">${workspace.name}</div>
                            <div class="workspace-info">
                                <i class="fas fa-user"></i> ${workspace.created_by} | 
                                <i class="fas fa-clock"></i> ${formatTime(workspace.created_at)} | 
                                <i class="fas fa-eye"></i> ${workspace.view_count}
                            </div>
                            <button class="delete-btn-circle" onclick="deleteWorkspace(event, '${workspace.id}')" title="刪除">
                                <i class="fas fa-times"></i>
                            </button>
                        `;
                        
                        savedDiv.appendChild(workspaceDiv);
                    });
                }
                
                container.appendChild(savedDiv);
            }
            
            document.getElementById('saved-count').textContent = data.length;
        })
        .catch(error => {
            console.error('載入工作區失敗:', error);
            showToast('載入工作區失敗', 'error');
        });
}

// 載入工作區
function loadWorkspace(workspaceId) {
    window.location.href = `/multi_viewer?state=${workspaceId}`;
}

// 工具列功能
function refreshContent() {
    if (splitView) {
        // 分割視窗模式下刷新兩個面板
        refreshPane('left');
        refreshPane('right');
    } else if (activeTabId) {
        // 單一視窗模式
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && !tab.loading) {
            tab.content = null;
            tab.loading = true;
            tab.loadStartTime = Date.now();
            renderTabs();
            
            const viewerContainer = document.getElementById('file-viewer');
            viewerContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>重新載入中...</p>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            `;
            
            loadFileContentOptimized(tab.path, tab.id, tab.isLocal);
            showToast('已重新整理', 'success');
        }
    }
}

function closeSearchModal() {
    console.log('關閉搜尋對話框');
    
    const searchModal = document.getElementById('search-modal');
    if (searchModal) {
        searchModal.classList.remove('show');
    }
    
    // 清理所有搜尋相關狀態
    if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = null;
    }
    
    if (window.searchTimeoutId) {
        clearTimeout(window.searchTimeoutId);
        window.searchTimeoutId = null;
    }
    
    // 清理訊息監聽器
    if (window.searchMessageHandler) {
        window.removeEventListener('message', window.searchMessageHandler);
        window.searchMessageHandler = null;
    }
    
    // 重置搜尋相關變數
    window.pendingSearchResults = [];
    window.searchResultsReceived = 0;
    window.expectedSearchResults = 0;
    
    // 清空搜尋框
    const searchKeyword = document.getElementById('search-keyword');
    if (searchKeyword) {
        searchKeyword.value = '';
    }
    
    // 重置搜尋結果
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>輸入關鍵字開始搜尋</p>
            </div>
        `;
    }
    
    // 隱藏搜尋統計
    const searchStats = document.getElementById('search-stats');
    if (searchStats) {
        searchStats.style.display = 'none';
    }
    
    // 重置導航按鈕
    const prevBtn = document.getElementById('prev-search-btn');
    const nextBtn = document.getElementById('next-search-btn');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    
    // 清理所有 iframe 中的搜尋高亮
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        if (iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({
                    type: 'clear-search'
                }, '*');
            } catch (error) {
                console.warn('無法清理 iframe 搜尋狀態:', error);
            }
        }
    });
}

// 執行搜尋
function performSearch() {
    // 清除之前的超時
    if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = null;
    }
    
    const searchModal = document.getElementById('search-modal');
    if (!searchModal || !searchModal.classList.contains('show')) {
        console.log('搜尋對話框未開啟');
        return;
    }
    
    const keyword = document.getElementById('search-keyword');
    if (!keyword) {
        console.error('找不到搜尋關鍵字輸入框');
        return;
    }
    
    const keywordValue = keyword.value ? keyword.value.trim() : '';
    
    // ===== 關鍵修改：即時同步關鍵字到所有 iframe =====
    syncKeywordToAllIframesRealtime(keywordValue);
    
    const scopeElement = document.getElementById('search-scope');
    const scope = scopeElement ? scopeElement.value : 'active';
    const caseSensitive = document.getElementById('search-case-sensitive')?.checked || false;
    const wholeWord = document.getElementById('search-whole-word')?.checked || false;
    const regex = document.getElementById('search-regex')?.checked || false;
    
    console.log('搜尋檔案內容:', { keywordValue, scope, caseSensitive, wholeWord, regex });
    
    const resultsDiv = document.getElementById('search-results');
    const searchStats = document.getElementById('search-stats');
    
    if (!resultsDiv) {
        console.error('搜尋結果容器不存在');
        return;
    }
    
    if (!keywordValue) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>輸入關鍵字開始搜尋檔案內容</p>
            </div>
        `;
        if (searchStats) searchStats.style.display = 'none';
        return;
    }
    
    // 顯示載入中
    resultsDiv.innerHTML = `
        <div class="search-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在搜尋檔案內容...</p>
        </div>
    `;
    
    if (searchStats) searchStats.style.display = 'none';
    
    // 重置搜尋結果
    searchResultsData = [];
    currentSearchIndex = 0;
    
    // 延遲執行搜尋（搜尋檔案內容）
    window.searchTimeout = setTimeout(() => {
        executeFileContentSearch(keywordValue, scope, caseSensitive, wholeWord, regex);
    }, 300);
}

// 新增：即時同步關鍵字到所有 iframe
function syncKeywordToAllIframesRealtime(keyword) {
    console.log('即時同步關鍵字:', keyword);
    
    // 獲取所有 iframe 並同步
    const allIframes = [];
    
    // 收集所有標籤的 iframe
    currentTabs.forEach(tab => {
        if (tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe) allIframes.push({ iframe, source: 'tab', tab });
        }
    });
    
    // 收集分割視窗的 iframe
    if (splitView) {
        ['left', 'right'].forEach(pane => {
            const content = document.getElementById(`split-${pane}-content`);
            if (content) {
                const iframe = content.querySelector('iframe');
                if (iframe) allIframes.push({ iframe, source: 'split', pane });
            }
        });
    }
    
    // 同步到所有 iframe
    allIframes.forEach(({ iframe }) => {
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({
                    type: 'sync-keyword-to-input',
                    keyword: keyword
                }, '*');
            } catch (error) {
                console.warn('無法同步關鍵字:', error);
            }
        }
    });
}

// 新增：執行檔案內容搜尋
function executeFileContentSearch(keyword, scope, caseSensitive, wholeWord, regex) {
    console.log('執行檔案內容搜尋:', { keyword, scope });
    
    const searchOptions = {
        keyword,
        scope,
        caseSensitive,
        wholeWord,
        regex
    };
    
    // ... 保持原有的搜尋邏輯，但確保只搜尋檔案內容 ...
    // 這裡使用原本的 executeSearch 邏輯
    executeSearch(keyword, scope, caseSensitive, wholeWord, regex);
}

// 新增：同步關鍵字到所有 iframe
function syncKeywordToAllIframes(keyword) {
    console.log('同步關鍵字到所有 iframe:', keyword);
    
    // 同步到所有已開啟的標籤
    currentTabs.forEach(tab => {
        if (tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    // 發送同步訊息
                    iframe.contentWindow.postMessage({
                        type: 'sync-search-keyword',
                        keyword: keyword
                    }, '*');
                } catch (error) {
                    console.warn('無法同步到標籤 iframe:', error);
                }
            }
        }
    });
    
    // 如果在分割視窗模式，同步到分割視窗
    if (splitView) {
        ['left', 'right'].forEach(pane => {
            const content = document.getElementById(`split-${pane}-content`);
            if (content) {
                const iframe = content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'sync-search-keyword',
                            keyword: keyword
                        }, '*');
                    } catch (error) {
                        console.warn(`無法同步到 ${pane} 視窗:`, error);
                    }
                }
            }
        });
    }
}

// 執行實際的搜尋
async function executeSearch(keyword, scope, caseSensitive, wholeWord, regex) {
    console.log('執行搜尋:', { keyword, scope, splitView });
    
    const searchOptions = {
        keyword,
        scope,
        caseSensitive,
        wholeWord,
        regex
    };
    
    // 同步關鍵字到所有開啟的檔案
    syncSearchKeywordToAllIframes(keyword);
    
    // 清理之前的監聽器
    if (window.searchMessageHandler) {
        window.removeEventListener('message', window.searchMessageHandler);
        window.searchMessageHandler = null;
    }
    
    // 重置搜尋狀態
    window.pendingSearchResults = [];
    window.searchResultsReceived = 0;
    window.expectedSearchResults = 0;
    
    // 計算預期的結果數量
    if (scope === 'all' && splitView) {
        window.expectedSearchResults = 2; // 左右兩個視窗
    } else {
        window.expectedSearchResults = 1;
    }

    // 儲存處理器引用
    window.searchMessageHandler = messageHandler;
    window.addEventListener('message', messageHandler);
    
    try {
        // 根據搜尋範圍執行搜尋
        if (scope === 'all' && splitView) {
            console.log('搜尋全部視窗');
            // 分別搜尋兩個視窗
            searchInPane('left', searchOptions);
                searchInPane('right', searchOptions);
        } else if (scope === 'left') {
            searchInPane('left', searchOptions);
        } else if (scope === 'right') {
            searchInPane('right', searchOptions);
        } else {
            // 搜尋當前活動標籤
            searchInActiveTab(searchOptions);
        }
        
        // 設置超時處理
        const timeoutId = setTimeout(() => {
            console.log('搜尋超時');
            const resultsDiv = document.getElementById('search-results');
            if (resultsDiv && resultsDiv.querySelector('.search-loading')) {
                // 如果有部分結果，顯示部分結果
                if (window.pendingSearchResults.length > 0) {
                    const mergedResults = {
                        keyword: keyword,
                        results: [],
                        count: 0
                    };
                    
                    window.pendingSearchResults.forEach(result => {
                        if (result.results && result.results.length > 0) {
                            mergedResults.results = mergedResults.results.concat(result.results);
                            mergedResults.count += result.count || result.results.length;
                        }
                    });
                    
                    displaySearchResults(mergedResults);
                } else {
                resultsDiv.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>搜尋超時，請重試</p>
                    </div>
                `;
                }
                
                // 清理監聽器
                if (window.searchMessageHandler) {
                    window.removeEventListener('message', window.searchMessageHandler);
                    window.searchMessageHandler = null;
                }
            }
        }, 5000);
        
        // 儲存超時ID以便清理
        window.searchTimeoutId = timeoutId;
        
    } catch (error) {
        console.error('搜尋失敗:', error);
        const resultsDiv = document.getElementById('search-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>搜尋失敗，請重試</p>
                </div>
            `;
        }
        
        // 清理監聽器
        if (window.searchMessageHandler) {
            window.removeEventListener('message', window.searchMessageHandler);
            window.searchMessageHandler = null;
        }
    }
}

// 新增同步函數
function syncSearchKeywordToAllIframes(keyword) {
    console.log('同步搜尋關鍵字到所有 iframe:', keyword);
    
    // 同步到所有標籤的 iframe
    currentTabs.forEach(tab => {
        if (tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({
                        type: 'sync-keyword',
                        keyword: keyword
                    }, '*');
                } catch (error) {
                    console.warn('無法同步關鍵字到 iframe:', error);
                }
            }
        }
    });
    
    // 如果在分割視窗模式，也同步到分割視窗的 iframe
    if (splitView) {
        ['left', 'right'].forEach(pane => {
            const content = document.getElementById(`split-${pane}-content`);
            if (content) {
                const iframe = content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'sync-keyword',
                            keyword: keyword
                        }, '*');
                    } catch (error) {
                        console.warn(`無法同步關鍵字到 ${pane} 面板:`, error);
                    }
                }
            }
        });
    }
}

// 切換分割視窗 - 修復邏輯
function toggleSplitView() {
    splitView = !splitView;
    window.splitView = splitView;
    const viewerContainer = document.getElementById('file-viewer');
    const splitBtn = document.querySelector('.btn-split');
    
    if (splitView) {
        // 進入分割視窗模式
        splitBtn.style.background = '#28a745'; // 綠色表示啟用
        splitBtn.innerHTML = '<i class="fas fa-times"></i> <span>關閉分割</span>';
        
        const currentTab = currentTabs.find(t => t.id === activeTabId);
        
        createSplitView();
        document.getElementById('main-toolbar').style.display = 'none';
        document.getElementById('split-toolbar').style.display = 'flex';
        
        // 如果有當前檔案，將其放到左側
        if (currentTab) {
            currentTab.splitPane = 'left';
            loadFileToPane(currentTab, 'left');
            splitViewState.left = currentTab.path;
        }
        
        showToast('已啟用分割視窗', 'success');
    } else {
        // 退出分割視窗模式
        splitBtn.style.background = ''; // 恢復原色
        splitBtn.innerHTML = '<i class="fas fa-columns"></i> <span>分割視窗</span>';
        
        document.getElementById('main-toolbar').style.display = 'flex';
        document.getElementById('split-toolbar').style.display = 'none';
        document.getElementById('diff-controls').style.display = 'none';
        diffMode = false;
        
        // 清除分割視窗標記
        currentTabs.forEach(tab => {
            if (tab.splitPane) {
                tab.splitPane = null;
            }
        });
        
        viewerContainer.innerHTML = '';
        if (activeTabId) {
            const tab = currentTabs.find(t => t.id === activeTabId);
            if (tab && tab.content) {
                viewerContainer.appendChild(tab.content);
            }
        } else {
            const emptyState = createEmptyState();
            viewerContainer.appendChild(emptyState);
        }
        
        // 清除分割視窗狀態
        splitViewState = { left: null, right: null };
        
        renderTabs();
        showToast('已關閉分割視窗', 'info');
    }
}

// 創建分割視窗 - 增強版
function createSplitView() {
    // 確保設置全域狀態
    window.splitView = true;
    if (!window.splitViewState) {
        window.splitViewState = { left: null, right: null };
    }    
    const viewerContainer = document.getElementById('file-viewer');
    viewerContainer.innerHTML = `
        <div class="split-container">
            <div class="split-pane" id="split-left">
                <div class="split-pane-toolbar">
                    <span class="split-pane-title" id="split-left-title">左側視窗</span>
                    <div class="split-pane-actions">
                        <button class="split-pane-btn" onclick="searchInSplitPane('left')" title="搜尋">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="split-pane-btn" onclick="openUploadModalForPane('left')" title="上傳檔案">
                            <i class="fas fa-upload"></i>
                        </button>
                        <button class="split-pane-btn" onclick="refreshPane('left')" title="重新整理">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="split-pane-btn" onclick="togglePaneFullscreen('left')" title="全屏">
                            <i class="fas fa-maximize"></i>
                        </button>                         
                        <button class="split-pane-close" onclick="closeSplitPane('left')" title="關閉">
                            <i class="fas fa-times"></i>
                        </button>                        
                    </div>
                </div>
                <div class="split-pane-content" id="split-left-content">
                    <div class="empty-state" id="split-left-empty">
                        <i class="fas fa-file-alt"></i>
                        <p>選擇檔案顯示在左側</p>
                        <p style="font-size: 14px;">或拖曳檔案到此處</p>
                        <p style="font-size: 12px; color: #999; margin-top: 10px;">
                            <i class="fas fa-info-circle"></i> 雙擊開始輸入文字
                        </p>
                        <button class="empty-state-btn" onclick="openUploadModalForPane('left')">
                            <i class="fas fa-upload"></i>
                            上傳檔案
                        </button>
                    </div>
                </div>
            </div>
            <div class="split-divider" id="split-divider"></div>
            <div class="split-pane" id="split-right">
                <div class="split-pane-toolbar">
                    <span class="split-pane-title" id="split-right-title">右側視窗</span>
                    <div class="split-pane-actions">
                        <button class="split-pane-btn" onclick="searchInSplitPane('right')" title="搜尋">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="split-pane-btn" onclick="openUploadModalForPane('right')" title="上傳檔案">
                            <i class="fas fa-upload"></i>
                        </button>
                        <button class="split-pane-btn" onclick="refreshPane('right')" title="重新整理">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="split-pane-btn" onclick="togglePaneFullscreen('right')" title="全屏">
                            <i class="fas fa-maximize"></i>
                        </button>                         
                        <button class="split-pane-close" onclick="closeSplitPane('right')" title="關閉">
                            <i class="fas fa-times"></i>
                        </button>                        
                    </div>
                </div>
                <div class="split-pane-content" id="split-right-content">
                    <div class="empty-state" id="split-right-empty">
                        <i class="fas fa-file-alt"></i>
                        <p>選擇檔案顯示在右側</p>
                        <p style="font-size: 14px;">或拖曳檔案到此處</p>
                        <p style="font-size: 12px; color: #999; margin-top: 10px;">
                            <i class="fas fa-info-circle"></i> 雙擊開始輸入文字
                        </p>
                        <button class="empty-state-btn" onclick="openUploadModalForPane('right')">
                            <i class="fas fa-upload"></i>
                            上傳檔案
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 設置分割線拖動
    setupSplitResize();
    
    // 設置分割視窗的拖放事件
    //setupSplitPaneDragDrop();

    // 設置雙擊事件
    setupSplitPaneDoubleClick();

    // 加入拖曳指示器
    addDragIndicators();

    // 設置分割視窗的拖放事件
    setTimeout(() => {
        setupDropZone('split-left-content');
        setupDropZone('split-right-content');
    }, 100);    
}

// 設置分割面板拖放
function setupSplitPaneDragDrop() {
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    [leftContent, rightContent].forEach((content, index) => {
        const pane = index === 0 ? 'left' : 'right';
        
        // 防止默認拖放行為
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            content.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        // 高亮拖放區域
        ['dragenter', 'dragover'].forEach(eventName => {
            content.addEventListener(eventName, (e) => {
                content.classList.add('drag-over');
                showDragIndicator(pane);
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            content.addEventListener(eventName, (e) => {
                content.classList.remove('drag-over');
                hideDragIndicator(pane);
            }, false);
        });      
    });
}

// 加入拖曳指示器
function addDragIndicators() {
    ['left', 'right'].forEach(pane => {
        const content = document.getElementById(`split-${pane}-content`);
        if (content) {
            const indicator = document.createElement('div');
            indicator.className = 'drag-indicator';
            indicator.id = `drag-indicator-${pane}`;
            indicator.innerHTML = `<i class="fas fa-file-import fa-3x"></i><p>拖放檔案到${pane === 'left' ? '左側' : '右側'}視窗</p>`;
            content.appendChild(indicator);
        }
    });
}

// 顯示拖曳指示器
function showDragIndicator(pane) {
    const indicator = document.getElementById(`drag-indicator-${pane}`);
    if (indicator) {
        indicator.classList.add('show');
    }
}

// 隱藏拖曳指示器
function hideDragIndicator(pane) {
    const indicator = document.getElementById(`drag-indicator-${pane}`);
    if (indicator) {
        indicator.classList.remove('show');
    }
}

// 設置分割視窗雙擊事件
function setupSplitPaneDoubleClick() {
    ['left', 'right'].forEach(pane => {
        const content = document.getElementById(`split-${pane}-content`);
        if (content) {
            // 移除舊的事件監聽器
            content.removeEventListener('dblclick', content._dblclickHandler);
            
            // 創建新的事件處理器
            content._dblclickHandler = (e) => {
                // 防止事件冒泡
                e.preventDefault();
                e.stopPropagation();
                
                // 只處理空狀態的雙擊
                if (e.target.closest('.empty-state')) {
                    // 防止重複點擊
                    if (content.dataset.processing === 'true') return;
                    
                    content.dataset.processing = 'true';
                    handleSplitPaneDoubleClick(pane);
                    
                    // 延遲重置，防止快速雙擊
                    setTimeout(() => {
                        content.dataset.processing = 'false';
                    }, 500);
                }
            };
            
            content.addEventListener('dblclick', content._dblclickHandler);
        }
    });
}

// 設置分割線拖動
function setupSplitResize() {
    const divider = document.getElementById('split-divider');
    const container = document.querySelector('.split-container');
    const leftPane = document.getElementById('split-left');
    const rightPane = document.getElementById('split-right');
    
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    
    // 使用 pointer events 支援觸控
    divider.addEventListener('pointerdown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPane.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // 防止選取文字
        divider.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    
    divider.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const containerWidth = container.offsetWidth;
        const newLeftWidth = startLeftWidth + deltaX;
        const percentage = (newLeftWidth / containerWidth) * 100;
        
        if (percentage >= 20 && percentage <= 80) {
            leftPane.style.flex = `0 0 ${percentage}%`;
            rightPane.style.flex = '1';
        }
    });
    
    divider.addEventListener('pointerup', (e) => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            divider.releasePointerCapture(e.pointerId);
        }
    });
}

// 關閉分割面板
window.closeSplitPane = function(pane) {
    const oppositePane = pane === 'left' ? 'right' : 'left';
    const closingContent = document.getElementById(`split-${pane}-content`);
    const remainingContent = document.getElementById(`split-${oppositePane}-content`);
    
    if (!closingContent || !remainingContent) return;
    
    // 獲取要保留的標籤資訊
    const remainingTabId = remainingContent.dataset.tabId;
    const remainingFilePath = remainingContent.dataset.filePath;
    let remainingTab = null;
    
    if (remainingTabId) {
        remainingTab = currentTabs.find(t => t.id === remainingTabId);
    }
    
    // 清理關閉的面板標記
    const closingTabId = closingContent.dataset.tabId;
    if (closingTabId) {
        const closingTab = currentTabs.find(t => t.id === closingTabId);
        if (closingTab && closingTab.splitPane === pane) {
            closingTab.splitPane = null;
        }
    }
    
    // 清理保留的面板標記
    if (remainingTab) {
        remainingTab.splitPane = null;
    }
    
    // 更新狀態
    splitViewState[pane] = null;
    splitViewState[oppositePane] = null;
    
    // 退出分割視窗模式，但保留剩餘的內容
    splitView = false;
    const splitBtn = document.querySelector('.btn-split');
    splitBtn.style.background = '';
    splitBtn.innerHTML = '<i class="fas fa-columns"></i> <span>分割視窗</span>';

    // 清理狀態
    pendingFileForPane = null;
    window.selectPaneForReplace = null;
    closePaneSelectModal(); // 確保關閉選擇對話框

    document.getElementById('main-toolbar').style.display = 'flex';
    document.getElementById('split-toolbar').style.display = 'none';
    document.getElementById('diff-controls').style.display = 'none';
    diffMode = false;
    
    // 顯示剩餘的檔案內容
    const viewerContainer = document.getElementById('file-viewer');
    viewerContainer.innerHTML = '';
    
    if (remainingTab) {
        // 設置為當前活動標籤
        activeTabId = remainingTab.id;
        
        // 如果內容已經載入，直接顯示
        if (remainingTab.content && !remainingTab.loading) {
            viewerContainer.appendChild(remainingTab.content);
        } else {
            // 如果還沒載入或正在載入，重新載入
            viewerContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>載入中...</p>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            `;
            
            // 檢查是否為可編輯檔案
            if (remainingTab.isEditable) {
                window.textEditor.loadEditorToTab(remainingTab);
            } else {
                loadFileContentOptimized(remainingTab.path, remainingTab.id, remainingTab.isLocal);
            }
        }
    } else if (remainingFilePath) {
        // 如果沒有找到標籤但有檔案路徑，嘗試重新開啟
        const file = {
            name: remainingFilePath.split('/').pop(),
            path: remainingFilePath,
            type: 'file',
            isLocal: false
        };
        openFile(file, true);
    } else {
        // 如果沒有任何內容，顯示空狀態
        const emptyState = createEmptyState();
        viewerContainer.appendChild(emptyState);
        activeTabId = null;
    }
    
    renderTabs();
    showToast(`已關閉${pane === 'left' ? '左側' : '右側'}視窗，保留${oppositePane === 'left' ? '左側' : '右側'}內容`, 'info');
};

// 搜尋分割面板
window.searchInSplitPane = function(pane) {
    openPaneSearchModal(pane);
};

// 交換左右面板
window.swapPanes = function() {
    if (!splitView) return;
    
    // 保存當前狀態
    const leftTabId = document.getElementById('split-left-content').dataset.tabId;
    const rightTabId = document.getElementById('split-right-content').dataset.tabId;
    const leftPath = document.getElementById('split-left-content').dataset.filePath;
    const rightPath = document.getElementById('split-right-content').dataset.filePath;

    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    const leftTitle = document.getElementById('split-left-title');
    const rightTitle = document.getElementById('split-right-title');
    
    // 交換內容
    const tempContent = leftContent.innerHTML;
    leftContent.innerHTML = rightContent.innerHTML;
    rightContent.innerHTML = tempContent;
    
    // 更新 dataset
    leftContent.dataset.tabId = rightTabId || '';
    leftContent.dataset.filePath = rightPath || '';
    rightContent.dataset.tabId = leftTabId || '';
    rightContent.dataset.filePath = leftPath || '';
    
    // 交換標題
    const tempTitle = leftTitle.textContent;
    leftTitle.textContent = rightTitle.textContent;
    rightTitle.textContent = tempTitle;

    // 交換狀態
    const tempState = splitViewState.left;
    splitViewState.left = splitViewState.right;
    splitViewState.right = tempState;
    
    // 更新標籤的 splitPane 屬性
    currentTabs.forEach(tab => {
        if (rightTabId && tab.id === rightTabId) {
            tab.splitPane = 'left';
        } else if (leftTabId && tab.id === leftTabId) {
            tab.splitPane = 'right';
        } else if (tab.path === rightPath) {
            tab.splitPane = 'left';
        } else if (tab.path === leftPath) {
            tab.splitPane = 'right';
        }
    });
    
    renderTabs();
    showToast('已交換左右視窗', 'success');
};

// 切換差異模式
window.toggleDiffMode = function() {
    if (!splitViewState.left || !splitViewState.right) {
        showToast('請先在兩側都載入檔案', 'error');
        return;
    }

    // 檢查檔案類型
    const leftTab = currentTabs.find(t => t.path === splitViewState.left);
    const rightTab = currentTabs.find(t => t.path === splitViewState.right);
    
    if (!leftTab || !rightTab) {
        showToast('無法找到檔案資訊', 'error');
        return;
    }
    
    // 檢查是否為文字檔案
    const textExtensions = ['.txt', '.log', '.csv', '.json', '.xml', '.js', '.css', '.html', '.py', '.java', '.cpp', '.md'];
    const leftIsText = textExtensions.some(ext => leftTab.path.toLowerCase().endsWith(ext)) || leftTab.isEditable;
    const rightIsText = textExtensions.some(ext => rightTab.path.toLowerCase().endsWith(ext)) || rightTab.isEditable;
    
    if (!leftIsText || !rightIsText) {
        showToast('只能比較文字類型的檔案', 'error');
        return;
    }

    diffMode = !diffMode;
    const diffControls = document.getElementById('diff-controls');
    const diffBtn = document.querySelector('.btn-diff');
    
    if (diffMode) {
        diffControls.style.display = 'flex';
        diffBtn.classList.add('active');
        
        // 執行差異比較
        performDiff();
        
    } else {
        diffControls.style.display = 'none';
        diffBtn.classList.remove('active');
        closeDiffViewer();
        showToast('已關閉差異比較模式', 'info');
    }
};

// 執行差異比較
async function performDiff() {
    if (!splitViewState.left || !splitViewState.right) {
        showToast('請先在兩側都載入檔案', 'error');
        return;
    }
    
    // 顯示載入中
    showToast('正在進行檔案比較...', 'info');

    if (window.diffViewer) {
        const result = await window.diffViewer.performDiff(splitViewState.left, splitViewState.right);
        if (result) {
            showToast('差異比較完成', 'success');
        }
    } else {
        showToast('差異比較模組未載入', 'error');
    }

}

// 匯出比較結果為 HTML
window.exportComparisonAsHTML = async function() {
    if (!splitViewState.left || !splitViewState.right) {
        showToast('請先在兩側都載入檔案', 'error');
        return;
    }
    
    try {
        const leftTab = currentTabs.find(t => t.path === splitViewState.left);
        const rightTab = currentTabs.find(t => t.path === splitViewState.right);
        if (window.diffViewer) {
            await window.diffViewer.exportComparison(
                {
                    name: leftTab?.name || 'File 1',
                    path: splitViewState.left
                },
                {
                    name: rightTab?.name || 'File 2', 
                    path: splitViewState.right
                }
            );

        } else {
            showToast('匯出失敗', 'error');
        }
    } catch (error) {
        console.error('匯出失敗:', error);
        showToast('差異比較模組未載入', 'error');
    }
};

// 關閉差異查看器
window.closeDiffViewer = function() {
    const diffViewer = document.getElementById('diff-viewer');
    if (diffViewer) {
        diffViewer.style.display = 'none';
    }
};

// 同步滾動
window.syncScrolling = function() {
    syncScroll = !syncScroll;
    
    if (syncScroll) {
        if (window.diffViewer) {
            window.diffViewer.setupSyncScroll();
            showToast('已啟用同步滾動', 'success');
        } else {
            showToast('同步滾動功能未載入', 'error');
            syncScroll = false;
        }
    } else {
        if (window.diffViewer) {
            window.diffViewer.removeSyncScroll();
        }
        showToast('已關閉同步滾動', 'info');
    }
};

// 複製差異到左側
window.copyDiffLeft = function() {
    if (window.diffViewer) {
        window.diffViewer.copyDiffToLeft();
    } else {
        showToast('差異比較模組未載入', 'error');
    }
};

// 複製差異到右側  
window.copyDiffRight = function() {
    if (window.diffViewer) {
        window.diffViewer.copyDiffToRight();
    } else {
        showToast('差異比較模組未載入', 'error');
    }
};

// 下一個差異
window.nextDiff = function() {
    if (window.diffViewer) {
        window.diffViewer.nextDiff();
    } else {
        showToast('差異比較模組未載入', 'error');
    }
};

// 上一個差異
window.prevDiff = function() {
    if (window.diffViewer) {
        window.diffViewer.prevDiff();
    } else {
        showToast('差異比較模組未載入', 'error');
    }
};

// 為特定面板開啟上傳對話框
window.openUploadModalForPane = function(pane) {
    currentUploadPane = pane;
    openUploadModal();
};

// 刷新特定面板
window.refreshPane = function(pane) {
    const content = document.getElementById(`split-${pane}-content`);
    const tabId = content.dataset.tabId;
    
    if (tabId) {
        const tab = currentTabs.find(t => t.id === tabId);
        if (tab && !tab.loading) {
            tab.content = null;
            tab.loading = true;
            tab.loadStartTime = Date.now();
            renderTabs();
            
            content.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>重新載入中...</p>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            `;
            
            loadFileContentForPane(tab.path, tab.id, tab.isLocal, pane);
            showToast(`已重新整理${pane === 'left' ? '左側' : '右側'}視窗`, 'success');
        }
    }
};

// 統一的全域拖放處理
function setupGlobalDragAndDrop() {
    // 只設置主視窗的拖放
    setupDropZone('file-viewer');
}

// 設置單個拖放區域
function setupDropZone(zoneId) {
    const element = document.getElementById(zoneId);
    if (!element) return;
    
    // 如果已經設置過，不要重複設置
    if (element.dataset.dropSetup === 'true') return;
    element.dataset.dropSetup = 'true';
    
    let enterCounter = 0;
    
    // 防止默認行為
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    element.addEventListener('dragenter', (e) => {
        e.preventDefault();
        enterCounter++;
        
        // 高亮效果
        if (zoneId === 'file-viewer') {
            const emptyState = element.querySelector('.empty-state');
            if (emptyState && emptyState.style.display !== 'none') {
                emptyState.classList.add('drag-over');
            }
        } else {
            element.classList.add('drag-over');
            const indicator = document.getElementById(`drag-indicator-${zoneId.split('-')[1]}`);
            if (indicator) indicator.classList.add('show');
        }
    });
    
    element.addEventListener('dragleave', (e) => {
        enterCounter--;
        if (enterCounter === 0) {
            // 移除高亮效果
            if (zoneId === 'file-viewer') {
                const emptyState = element.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.classList.remove('drag-over');
                }
            } else {
                element.classList.remove('drag-over');
                const indicator = document.getElementById(`drag-indicator-${zoneId.split('-')[1]}`);
                if (indicator) indicator.classList.remove('show');
            }
        }
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        enterCounter = 0;
        
        // 移除高亮效果
        if (zoneId === 'file-viewer') {
            const emptyState = element.querySelector('.empty-state');
            if (emptyState) {
                emptyState.classList.remove('drag-over');
            }
        } else {
            element.classList.remove('drag-over');
            const indicator = document.getElementById(`drag-indicator-${zoneId.split('-')[1]}`);
            if (indicator) indicator.classList.remove('show');
        }
        
        // 處理拖放
        handleDropEvent(e, zoneId);
    });
}

// 統一處理拖放事件
function handleDropEvent(e, zoneId) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    // 防止重複處理
    if (window.isProcessingDrop) {
        return;
    }
    
    window.isProcessingDrop = true;
    setTimeout(() => {
        window.isProcessingDrop = false;
    }, 300);

    // 檢查是否為內部拖曳
    let draggedData = null;
    try {
        const jsonData = dt.getData('application/json');
        if (jsonData) {
            draggedData = JSON.parse(jsonData);
        }
    } catch (e) {
        // 忽略解析錯誤
    }

    if (files && files.length > 0) {
        // 處理檔案拖放
        const uniqueFiles = Array.from(files).filter((file, index, self) => 
            index === self.findIndex(f => f.name === file.name && f.size === file.size)
        );
        
        // 根據拖放區域處理
        if (zoneId === 'file-viewer') {
            handleFilesDropped(uniqueFiles);
        } else if (zoneId === 'split-left-content') {
            handleFilesDroppedToPane(uniqueFiles, 'left');
        } else if (zoneId === 'split-right-content') {
            handleFilesDroppedToPane(uniqueFiles, 'right');
        }
    } else if (draggedData) {
        // 處理內部拖曳
        if (draggedData.type === 'file') {
            // 從檔案樹拖曳
            const virtualFile = {
                name: draggedData.name,
                path: draggedData.path,
                type: 'file',
                isLocal: false
            };
            
            if (zoneId === 'file-viewer') {
                openFile(virtualFile, true);
            } else if (zoneId === 'split-left-content') {
                handleDroppedFile(virtualFile, 'left');
            } else if (zoneId === 'split-right-content') {
                handleDroppedFile(virtualFile, 'right');
            }
        } else if (draggedData.type === 'tab') {
            // 從標籤拖曳
            if (zoneId === 'split-left-content' || zoneId === 'split-right-content') {
                const pane = zoneId === 'split-left-content' ? 'left' : 'right';
                const tab = currentTabs.find(t => t.id === draggedData.tabId);
                
                if (tab) {
                    if (!tab.content || tab.loading) {
                        // 如果還沒載入，先載入內容
                        showToast('正在載入檔案內容...', 'info');
                        
                        const content = document.getElementById(`split-${pane}-content`);
                        content.innerHTML = `
                            <div class="loading-state">
                                <i class="fas fa-spinner fa-spin"></i>
                                <p>載入中...</p>
                            </div>
                        `;
                        
                        loadFileContentForPane(tab.path, tab.id, tab.isLocal, pane);
                    } else {
                        // 如果已經載入，直接顯示
                        tab.splitPane = pane;
                        loadFileToPane(tab, pane);
                        renderTabs();
                        showToast(`已在${pane === 'left' ? '左側' : '右側'}視窗開啟 ${tab.name}`, 'success');
                    }
                }
            }
        }
    }
}

// 處理拖放檔案到分割視窗
function handleFilesDroppedToPane(files, pane) {
    if (!files || files.length === 0) return;
    
    // 確保在分割視窗模式
    if (!splitView) {
        showToast('請先開啟分割視窗模式', 'error');
        return;
    }
    
    files.forEach((file) => {
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        handleDroppedFile(virtualFile, pane);
    });
}

// 修復上傳後的處理
async function handleFilesAsync(files) {
    if (!files || files.length === 0) return;

    // 保留原本的 currentUploadPane
    const originalUploadPane = currentUploadPane;

    // 如果在分割視窗模式但沒有指定面板，預設使用左側
    if (splitView && !currentUploadPane) {
        // 檢查哪個面板是空的
        const leftEmpty = !splitViewState.left;
        const rightEmpty = !splitViewState.right;
        
        if (leftEmpty && !rightEmpty) {
            currentUploadPane = 'left';
        } else if (!leftEmpty && rightEmpty) {
            currentUploadPane = 'right';
        } else if (leftEmpty && rightEmpty) {
            // 兩邊都空，預設左側
            currentUploadPane = 'left';
        } else {
            // 兩邊都有檔案，使用左側
            currentUploadPane = 'left';
        }
    }

    // 確保不會開啟重複檔案
    const uniqueFiles = files.filter((file, index, self) => 
        index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );
    
    if (uniqueFiles.length === 0) return;
    
    // 如果檔案很多，顯示進度條
    const showProgress = uniqueFiles.length > 3;
    let uploadProgress = null;
    
    if (showProgress) {
        uploadProgress = document.createElement('div');
        uploadProgress.className = 'upload-progress';
        uploadProgress.innerHTML = '<div class="upload-progress-bar" style="width: 0%"></div>';
        document.body.appendChild(uploadProgress);
    }
    
    for (let i = 0; i < uniqueFiles.length; i++) {
        const file = uniqueFiles[i];
        const progress = ((i + 1) / uniqueFiles.length) * 100;
        
        if (uploadProgress) {
            uploadProgress.querySelector('.upload-progress-bar').style.width = `${progress}%`;
        }
        
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        if (splitView && currentUploadPane) {
            // 分割視窗模式，上傳到指定面板
            const tab = openFile(virtualFile, false);
            if (tab) {
                // 等待標籤創建完成
                await new Promise(resolve => setTimeout(resolve, 100));
                const createdTab = currentTabs.find(t => t.path === virtualFile.path);
                if (createdTab) {
                    createdTab.splitPane = currentUploadPane;
                    loadFileToPane(createdTab, currentUploadPane);
                }
            }
        } else {
            // 一般模式
            openFile(virtualFile, i === 0);
        }
        
        // 只在有多個檔案時加延遲
        if (uniqueFiles.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }

    // 恢復原本的 currentUploadPane
    currentUploadPane = originalUploadPane;

    // 移除進度條
    if (uploadProgress) {
        setTimeout(() => {
            uploadProgress.remove();
        }, 300);
    }
    
    showToast(`已成功載入 ${uniqueFiles.length} 個檔案`, 'success');
}

// 處理拖放的檔案
function handleDroppedFile(virtualFile, pane) {
    // 再次確保分割視窗狀態正確
    const splitContainer = document.querySelector('.split-container');
    if (splitContainer && !window.splitView) {
        console.log('修正分割視窗狀態');
        window.splitView = true;
        splitView = true;
        
        if (!window.splitViewState) {
            window.splitViewState = { left: null, right: null };
        }
        splitViewState = window.splitViewState;
    }
    
    // 確保在分割視窗模式
    if (!splitView) {
        showToast('請先開啟分割視窗模式', 'error');
        return;
    }
    
    console.log(`處理拖放檔案到 ${pane} 視窗:`, virtualFile);
    
    // 檢查是否已經開啟
    const existingTab = currentTabs.find(tab => tab.path === virtualFile.path);
    
    if (existingTab) {
        // 如果檔案已開啟，直接載入到面板
        existingTab.splitPane = pane;
        loadFileToPane(existingTab, pane);
        renderTabs();
    } else {
        // 開啟新檔案
        const tab = openFile(virtualFile, false);
        
        if (tab) {
            // 確保檔案完全載入
            const ensureLoaded = () => {
                return new Promise((resolve) => {
                    let checkCount = 0;
                    const maxChecks = 40; // 最多檢查 4 秒
                    
                    const checkInterval = setInterval(() => {
                        const createdTab = currentTabs.find(t => t.path === virtualFile.path);
                        checkCount++;
                        
                        if (createdTab || checkCount >= maxChecks) {
                            clearInterval(checkInterval);
                            
                            if (createdTab) {
                                createdTab.splitPane = pane;
                                
                                // 載入到指定面板
                                const content = document.getElementById(`split-${pane}-content`);
                                if (content) {
                                    const emptyState = content.querySelector('.empty-state');
                                    if (emptyState) emptyState.style.display = 'none';
                                    
                                    // 更新分割視窗狀態
                                    window.splitViewState[pane] = createdTab.path;
                                    splitViewState[pane] = createdTab.path;
                                    
                                    loadFileContentForPane(createdTab.path, createdTab.id, createdTab.isLocal, pane);
                                }
                                
                                renderTabs();
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        }
                    }, 100);
                });
            };
            
            ensureLoaded().then((success) => {
                if (success) {
                    showToast(`已在${pane === 'left' ? '左側' : '右側'}視窗開啟 ${virtualFile.name}`, 'success');
                } else {
                    showToast('載入檔案失敗', 'error');
                }
            });
        }
    }
}

// 載入檔案到特定面板
function loadFileToPane(tab, pane) {
    console.log('載入檔案到面板:', tab, pane);
    
    // 確保在分割視窗模式
    if (!splitView) {
        console.error('嘗試在非分割視窗模式下載入檔案到面板');
        return;
    }

    // 確保全域變數正確設置
    window.splitView = true;
    if (!window.splitViewState) {
        window.splitViewState = { left: null, right: null };
    }

    const content = document.getElementById(`split-${pane}-content`);
    const title = document.getElementById(`split-${pane}-title`);
    const emptyState = document.getElementById(`split-${pane}-empty`);

    if (!content) {
        console.error(`找不到面板內容元素: split-${pane}-content`);
        return;
    }
    
    if (!tab) {
        console.error('沒有提供標籤資料');
        return;
    }

    // 隱藏空狀態
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // 設置資料屬性
    content.dataset.tabId = tab.id;
    content.dataset.filePath = tab.path;
    
    // 更新標題
    if (title) {
        title.textContent = tab.name;
        title.title = tab.path;
    }
    
    // 更新狀態
    splitViewState[pane] = tab.path;
    window.splitViewState[pane] = tab.path;  // 確保更新到 window 物件
    tab.splitPane = pane;
    
    // 檢查是否為可編輯檔案
    if (tab.isEditable && window.textEditor) {
        window.textEditor.loadEditorToPane(tab, pane);
    } else if (tab.content && !tab.loading) {
        // 如果內容已載入，直接複製
        content.innerHTML = '';
        const iframe = tab.content.querySelector('iframe');
        if (iframe) {
            const newIframe = iframe.cloneNode(true);
            content.appendChild(newIframe);
        }
    } else {
        // 需要載入內容
        content.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        
        // 載入檔案內容
        loadFileContentForPane(tab.path, tab.id, tab.isLocal, pane);
    }
    
    renderTabs();
}

// 儲存工作區
function saveWorkspace() {
    if (currentTabs.length === 0) {
        showToast('沒有開啟的檔案', 'info');
        return;
    }
    
    document.getElementById('save-modal').classList.add('show');
    document.getElementById('workspace-name').focus();
}

function closeSaveModal() {
    document.getElementById('save-modal').classList.remove('show');
}

function togglePasswordInput() {
    const isPrivate = document.getElementById('private').checked;
    document.getElementById('password-input').style.display = isPrivate ? 'block' : 'none';
}

async function confirmSave() {
    const name = document.getElementById('workspace-name').value.trim();
    if (!name) {
        showToast('請輸入工作區名稱', 'error');
        return;
    }
    
    const isPrivate = document.getElementById('private').checked;
    const password = isPrivate ? document.getElementById('workspace-password').value : '';
    
    if (isPrivate && !password) {
        showToast('請設定密碼', 'error');
        return;
    }
    
    // 確保儲存完整的標籤資訊
    const tabsData = currentTabs.map(tab => {
        const tabData = {
            name: tab.name,
            path: tab.path,
            color: tab.color,
            splitPane: tab.splitPane,
            isEditable: tab.isEditable || false,
            isLocal: tab.isLocal || false
        };
        
        // 如果是可編輯檔案，儲存內容
        if (tab.isEditable) {
            // 從編輯器獲取最新內容
            const editorId = tab.splitPane ? `${tab.id}-${tab.splitPane}` : tab.id;
            const editor = window.textEditor?.editors.get(editorId);
            if (editor) {
                tabData.content = editor.textarea.value;
            } else {
                tabData.content = tab.content || '';
            }
        }
        
        return tabData;
    });
    
    // 準備工作區狀態
    const state = {
        name: name,
        groups: groups,
        tabs: tabsData,
        activeTabPath: activeTabId ? currentTabs.find(t => t.id === activeTabId)?.path : null,
        splitView: splitView,
        splitViewState: splitViewState,
        diffMode: diffMode,
        sidebarCollapsed: sidebarCollapsed,
        currentView: currentView,
        timestamp: new Date().toISOString(),
        version: '2.0' // 加入版本號以便未來相容性處理
    };
    
    console.log('儲存工作區狀態:', state);
    
    try {
        const response = await fetch('/api/multi_viewer/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state: state,
                is_public: !isPrivate,
                password: password,
                name: name
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('工作區儲存成功', 'success');
            closeSaveModal();
            
            // 更新 URL 但不重新載入頁面
            window.history.replaceState({}, '', `/multi_viewer?state=${result.state_id}`);
            currentWorkspaceId = result.state_id;
            
            // 更新已儲存計數
            updateSavedCount();
            
            // 如果當前檢視是已儲存，重新載入列表
            if (currentView === 'saved') {
                renderSavedWorkspaces();
            }
        } else {
            showToast(result.message || '儲存失敗', 'error');
        }
    } catch (error) {
        console.error('儲存失敗:', error);
        showToast('儲存失敗', 'error');
    }
}

// 匯出檔案
function exportFile() {
    if (!activeTabId) {
        showToast('請先開啟檔案', 'info');
        return;
    }
    
    const tab = currentTabs.find(t => t.id === activeTabId);
    if (tab) {
        window.open(`/api/export?path=${encodeURIComponent(tab.path)}`, '_blank');
        showToast('開始下載檔案', 'success');
    }
}

// 開啟上傳對話框
function openUploadModal() {
    document.getElementById('upload-modal').classList.add('show');
    uploadedFiles = [];
    document.getElementById('file-input').value = '';
    document.getElementById('uploaded-files').style.display = 'none';
    document.getElementById('files-list').innerHTML = '';
    
    const uploadArea = document.getElementById('upload-area');
    
    // 設置拖放事件
    setupUploadAreaDragDrop(uploadArea);
}

// 設置上傳區域拖放
function setupUploadAreaDragDrop(uploadArea) {
    // 防止默認拖放行為
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // 高亮拖放區域
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        }, false);
    });
    
    // 處理拖放
    uploadArea.addEventListener('drop', handleDrop, false);
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.remove('show');
    currentUploadPane = null;
}

// 處理檔案選擇
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    handleFiles(files);
}

// 處理檔案
function handleFiles(files) {
    if (files.length === 0) return;
    
    uploadedFiles = uploadedFiles.concat(files);
    renderUploadedFiles();
}

// 渲染已上傳檔案
function renderUploadedFiles() {
    const filesList = document.getElementById('files-list');
    const uploadedFilesContainer = document.getElementById('uploaded-files');
    
    if (!filesList || !uploadedFilesContainer) return;    
    filesList.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'uploaded-file';
        fileDiv.innerHTML = `
            <i class="fas fa-file-alt"></i>
            <span class="uploaded-file-name">${file.name}</span>
            <button class="uploaded-file-remove" onclick="removeUploadedFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        filesList.appendChild(fileDiv);
    });
    
    uploadedFilesContainer.style.display = uploadedFiles.length > 0 ? 'block' : 'none';
}

// 移除已上傳檔案
window.removeUploadedFile = function(index) {
    uploadedFiles.splice(index, 1);
    renderUploadedFiles();
};

// 確認上傳
function confirmUpload() {
    if (uploadedFiles.length === 0) {
        showToast('請選擇檔案', 'error');
        return;
    }

    // 複製檔案陣列並清空
    const filesToUpload = [...uploadedFiles];
    uploadedFiles = [];
   
    closeUploadModal();

    // 背景非同步處理，不阻塞 UI
    setTimeout(() => {
        handleFilesAsync(filesToUpload).catch(error => {
            console.error('載入檔案失敗:', error);
            showToast('部分檔案載入失敗', 'error');
        });
    }, 0);
}

// 拖放事件處理
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
}

// 添加到最近檔案
function addToRecentFiles(file) {
    recentFiles = recentFiles.filter(f => f.path !== file.path);
    
    recentFiles.unshift({
        ...file,
        openedAt: new Date().toISOString()
    });
    
    if (recentFiles.length > 20) {
        recentFiles = recentFiles.slice(0, 20);
    }
    
    if (document.getElementById('remember-recent')?.checked !== false) {
        try {
            localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
        } catch (e) {
            console.error('儲存最近檔案失敗:', e);
        }
    }
    updateRecentCount();
}

// 載入最近檔案
function loadRecentFiles() {
    try {
        const saved = localStorage.getItem('recentFiles');
        if (saved) {
            recentFiles = JSON.parse(saved);
        }
    } catch (e) {
        console.error('載入最近檔案失敗:', e);
    }
    updateRecentCount();
}

// 載入已儲存的工作區
function loadSavedWorkspaces() {
    // 這個功能需要後端支援
}

// 顯示 Toast 提示
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = document.createElement('i');
    icon.className = 'toast-icon fas ';
    switch (type) {
        case 'success':
            icon.className += 'fa-check-circle';
            break;
        case 'error':
            icon.className += 'fa-exclamation-circle';
            break;
        default:
            icon.className += 'fa-info-circle';
    }
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = () => removeToast(toast);
    
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    
    setTimeout(() => removeToast(toast), 5000);
}

// 移除 Toast
function removeToast(toast) {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// 格式化時間
function formatTime(timeString) {
    const date = new Date(timeString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return '剛剛';
    } else if (diff < 3600000) {
        return Math.floor(diff / 60000) + ' 分鐘前';
    } else if (diff < 86400000) {
        return Math.floor(diff / 3600000) + ' 小時前';
    } else if (diff < 604800000) {
        return Math.floor(diff / 86400000) + ' 天前';
    } else {
        return date.toLocaleDateString();
    }
}

// 設定相關功能
function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('show');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('show');
}

function showSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    document.getElementById(`${tab}-settings`).style.display = 'block';
}

function saveSettings() {
    const settings = {
        autoSave: document.getElementById('auto-save').checked,
        rememberRecent: document.getElementById('remember-recent').checked,
        darkMode: document.getElementById('dark-mode').checked,
        compactMode: document.getElementById('compact-mode').checked,
        devMode: document.getElementById('dev-mode').checked
    };
    
    try {
        localStorage.setItem('settings', JSON.stringify(settings));
        showToast('設定已儲存', 'success');
        closeSettingsModal();
        
        applySettings(settings);
    } catch (e) {
        console.error('儲存設定失敗:', e);
        showToast('儲存設定失敗', 'error');
    }
}

// 應用設定
function applySettings(settings) {
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    if (settings.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
}

// 載入設定
function loadSettings() {
    try {
        const saved = localStorage.getItem('settings');
        if (saved) {
            const settings = JSON.parse(saved);
            
            document.getElementById('auto-save').checked = settings.autoSave || false;
            document.getElementById('remember-recent').checked = settings.rememberRecent !== false;
            document.getElementById('dark-mode').checked = settings.darkMode || false;
            document.getElementById('compact-mode').checked = settings.compactMode || false;
            document.getElementById('dev-mode').checked = settings.devMode || false;
            
            applySettings(settings);
        }
    } catch (e) {
        console.error('載入設定失敗:', e);
    }
}

// 更新已儲存計數
function updateSavedCount() {
    fetch('/api/multi_viewer/list')
        .then(response => response.json())
        .then(data => {
            // 只計算當前用戶的工作區
            const username = window.currentUsername || 'anonymous';
            const userWorkspaces = data.filter(w => w.created_by === username);
            document.getElementById('saved-count').textContent = userWorkspaces.length;
        })
        .catch(error => {
            console.error('更新計數失敗:', error);
        });
}

// 載入已儲存的工作區
function loadSavedWorkspaces() {
    updateSavedCount();
}

// 更新最近檔案計數
function updateRecentCount() {
    const count = recentFiles.length;
    const navItem = document.querySelector('.nav-item:nth-child(2)'); // 最近檔案是第二個
    let badge = navItem.querySelector('.nav-badge');
    
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.style.background = '#f39c12'; // 橙色
        navItem.appendChild(badge);
    }
    
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// 刪除最近檔案
window.deleteRecentFile = async function(event, index) {
    event.stopPropagation();
    
    const file = recentFiles[index];
    const confirmed = await confirmDialog.show({
        type: 'danger',
        title: '刪除最近檔案',
        message: `確定要從最近檔案中移除「${file.name}」嗎？`,
        confirmText: '刪除',
        cancelText: '取消'
    });
    
    if (confirmed) {
        recentFiles.splice(index, 1);
        
        // 更新 localStorage
        if (document.getElementById('remember-recent')?.checked !== false) {
            try {
                localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
            } catch (e) {
                console.error('儲存最近檔案失敗:', e);
            }
        }
        
        // 重新渲染
        renderRecentFiles();
        updateRecentCount();
        
        showToast('已從最近檔案中移除', 'success');
    }
};

// 刪除工作區
window.deleteWorkspace = async function(event, workspaceId) {
    event.stopPropagation();
    
    // 獲取工作區名稱
    const workspaceItem = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
    const workspaceName = workspaceItem?.querySelector('.workspace-name')?.textContent || '此工作區';
    
    const confirmed = await confirmDialog.show({
        type: 'danger',
        title: '刪除工作區',
        message: `確定要刪除工作區「${workspaceName}」嗎？此操作無法復原。`,
        confirmText: '永久刪除',
        cancelText: '取消'
    });
    
    if (confirmed) {
        try {
            const response = await fetch(`/api/multi_viewer/delete/${workspaceId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('工作區已刪除', 'success');
                
                // 重新載入工作區列表
                if (currentView === 'saved') {
                    renderSavedWorkspaces();
                }
                
                updateSavedCount();
            } else {
                showToast(result.message || '刪除失敗', 'error');
            }
        } catch (error) {
            console.error('刪除工作區失敗:', error);
            showToast('刪除失敗', 'error');
        }
    }
};

// 在初始化時載入設定
loadSettings();

// 定期更新計數
setInterval(() => {
    updateSavedCount();
}, 30000); // 每30秒更新一次

// 全局函數綁定（確保這些函數都被綁定）
window.updateSavedCount = updateSavedCount;
window.updateRecentCount = updateRecentCount;

// 全局函數綁定
window.toggleSidebar = toggleSidebar;
window.searchFiles = searchFiles;
window.showView = showView;
window.openFile = openFile;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleFileSelect = handleFileSelect;
window.confirmUpload = confirmUpload;
window.openSearchModal = openSearchModal;
window.closeSearchModal = closeSearchModal;
window.performSearch = performSearch;
window.openPaneSearchModal = openPaneSearchModal;
window.closePaneSearchModal = closePaneSearchModal;
window.performPaneSearch = performPaneSearch;
window.toggleSplitView = toggleSplitView;
window.refreshContent = refreshContent;
window.saveWorkspace = saveWorkspace;
window.closeSaveModal = closeSaveModal;
window.togglePasswordInput = togglePasswordInput;
window.confirmSave = confirmSave;
window.exportFile = exportFile;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.showSettingsTab = showSettingsTab;
window.saveSettings = saveSettings;

// 更新搜尋位置
function updateSearchPosition(current, total) {
    const countElement = document.querySelector('.search-result-count');
    if (countElement) {
        countElement.textContent = `${current} / ${total}`;
    }
}

// 高亮當前搜尋結果
function highlightCurrentSearchResult() {
    // 移除所有高亮
    document.querySelectorAll('.search-result-item').forEach((item, index) => {
        if (index === currentSearchIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            item.classList.remove('active');
        }
    });
    
    // 更新計數顯示
    updateSearchNavigation();
}

// 高亮關鍵字
function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    
    const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// 跳轉到搜尋結果
window.jumpToSearchResult = function(index, lineNumber) {
    // 關閉搜尋對話框
    closeSearchModal();
    
    // 發送跳轉訊息到 iframe
    if (activeTabId) {
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'jump-to-line',
                    lineNumber: lineNumber,
                    highlight: true
                }, '*');
            }
        }
    }
};

// 輔助函數
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 高亮當前搜尋結果
function highlightCurrentSearchResult() {
    // 移除所有高亮
    document.querySelectorAll('.search-result-item').forEach((item, index) => {
        if (index === currentSearchIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            item.classList.remove('active');
        }
    });
    
    // 更新計數顯示
    updateSearchNavigation();
}

// 高亮關鍵字
function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    
    const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// 跳轉到搜尋結果
window.jumpToSearchResult = function(index, lineNumber) {
    // 關閉搜尋對話框
    closeSearchModal();
    
    // 發送跳轉訊息到 iframe
    if (activeTabId) {
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'jump-to-line',
                    lineNumber: lineNumber,
                    highlight: true
                }, '*');
            }
        }
    }
};

// 輔助函數
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 開啟搜尋對話框
function openSearchModal() {
    // 確保關閉其他搜尋視窗
    const paneSearchModal = document.getElementById('pane-search-modal');
    if (paneSearchModal && paneSearchModal.classList.contains('show')) {
        closePaneSearchModal();
    }
    
    const searchModal = document.getElementById('search-modal');
    if (!searchModal) {
        console.error('找不到搜尋對話框');
        showToast('搜尋功能初始化失敗', 'error');
        return;
    }
    
    searchModal.classList.add('show');
    
    // 設置焦點
    setTimeout(() => {
        const searchKeyword = document.getElementById('search-keyword');
        if (searchKeyword) {
            searchKeyword.focus();
            searchKeyword.select();
            
            // 如果有值，立即同步
            if (searchKeyword.value) {
                syncSearchKeyword(searchKeyword.value);
            }
        } else {
            console.error('找不到搜尋關鍵字輸入框');
        }
    }, 100);
    
    // 根據當前模式設置搜尋範圍
    const searchScopeContainer = document.getElementById('search-scope-container');
    const searchScope = document.getElementById('search-scope');
    
    if (searchScopeContainer) {
        if (splitView) {
            searchScopeContainer.style.display = 'block';
            
            if (searchScope) {
                // 檢查兩側視窗的內容狀態
                const leftContent = document.getElementById('split-left-content');
                const rightContent = document.getElementById('split-right-content');
                
                const leftHasContent = leftContent && 
                    (leftContent.dataset.filePath || leftContent.dataset.tabId) &&
                    leftContent.querySelector('.empty-state')?.style.display === 'none';
                    
                const rightHasContent = rightContent && 
                    (rightContent.dataset.filePath || rightContent.dataset.tabId) &&
                    rightContent.querySelector('.empty-state')?.style.display === 'none';
                
                console.log('視窗內容狀態:', { leftHasContent, rightHasContent });
                
                // 智能設置預設搜尋範圍
                if (leftHasContent && rightHasContent) {
                    searchScope.value = 'all';
                } else if (leftHasContent && !rightHasContent) {
                    searchScope.value = 'left';
                    // 禁用右側選項
                    const rightOption = searchScope.querySelector('option[value="right"]');
                    if (rightOption) rightOption.disabled = true;
                } else if (!leftHasContent && rightHasContent) {
                    searchScope.value = 'right';
                    // 禁用左側選項
                    const leftOption = searchScope.querySelector('option[value="left"]');
                    if (leftOption) leftOption.disabled = true;
                } else {
                    searchScope.value = 'all';
                    // 顯示提示
                    setTimeout(() => {
                        const resultsDiv = document.getElementById('search-results');
                        if (resultsDiv) {
                            resultsDiv.innerHTML = `
                                <div class="no-results">
                                    <i class="fas fa-info-circle"></i>
                                    <p>請先載入檔案到視窗中</p>
                                </div>
                            `;
                        }
                    }, 100);
                }
                
                // 恢復所有選項的狀態
                searchScope.querySelectorAll('option').forEach(option => {
                    if (option.value === 'all') {
                        option.disabled = false;
                    } else if (option.value === 'left') {
                        option.disabled = !leftHasContent;
                    } else if (option.value === 'right') {
                        option.disabled = !rightHasContent;
                    }
                });
            }
        } else {
            searchScopeContainer.style.display = 'none';
            if (searchScope) searchScope.value = 'active';
        }
    }
}

// 搜尋對話框鍵盤事件處理
function setupSearchModalKeyboard() {
    const searchKeyword = document.getElementById('search-keyword');
    const searchModal = document.getElementById('search-modal');
    
    if (!searchKeyword) return;
    
    searchKeyword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                prevSearchResult();
            } else {
                nextSearchResult();
            }
        } else if (e.key === 'Escape') {
            closeSearchModal();
        }
    });
}

// 顯示標籤計數器
function showTabsCounter() {
    let counter = document.getElementById('tabs-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'tabs-counter';
        counter.className = 'tabs-counter';
        document.body.appendChild(counter);
    }
    
    counter.textContent = `${currentTabs.length} 個檔案`;
    counter.classList.add('show');
    
    // 點擊計數器顯示標籤列表
    counter.onclick = showTabsList;
}

// 隱藏標籤計數器
function hideTabsCounter() {
    const counter = document.getElementById('tabs-counter');
    if (counter) {
        counter.classList.remove('show');
    }
}

// 顯示標籤列表（手機版）
function showTabsList() {
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
                ${currentTabs.map(tab => `
                    <div class="tabs-list-item" onclick="switchTab('${tab.id}'); this.closest('.tabs-list-modal').remove()">
                        <div class="tab-color-indicator" style="background: ${tab.color}"></div>
                        <span class="tab-name">${tab.name}</span>
                        <button class="tab-close-btn" onclick="event.stopPropagation(); closeTab('${tab.id}', event); this.closest('.tabs-list-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 確保所有必要的函數都綁定到 window 對象
window.performSearch = performSearch;
window.closeSearchModal = closeSearchModal;
window.displaySearchResults = displaySearchResults;

// 面板選擇相關函數
window.showPaneSelectModal = showPaneSelectModal;
window.closePaneSelectModal = closePaneSelectModal;
window.selectPane = selectPane;

// 搜尋結果分群顯示功能
window.displayGroupedSearchResults = function(data) {
    console.log('顯示分群搜尋結果:', data);
    
    const resultsDiv = document.getElementById('search-results');
    const searchStats = document.getElementById('search-stats');
    
    if (!resultsDiv) return;
    
    // 分組結果
    const groupedResults = {
        left: [],
        right: [],
        other: []
    };
    
    // 分類結果
    if (data.results && Array.isArray(data.results)) {
        data.results.forEach(result => {
            if (result.pane === 'left') {
                groupedResults.left.push(result);
            } else if (result.pane === 'right') {
                groupedResults.right.push(result);
            } else {
                groupedResults.other.push(result);
            }
        });
    }
    
    console.log('分組後的結果:', groupedResults);
    
    // 建立頁籤 HTML
    let html = '';
    
    // 檢查是否需要顯示頁籤（至少有兩個群組有資料）
    const hasMultipleGroups = (groupedResults.left.length > 0 ? 1 : 0) + 
                             (groupedResults.right.length > 0 ? 1 : 0) + 
                             (groupedResults.other.length > 0 ? 1 : 0) > 1;
    
    // 如果在分割視窗模式且有多個群組，顯示頁籤
    if (window.splitView && hasMultipleGroups) {
        // 建立頁籤
        html += '<div class="search-results-tabs">';
        
        let firstTab = true;
        if (groupedResults.left.length > 0) {
            html += `
                <button class="search-results-tab ${firstTab ? 'active' : ''}" onclick="switchSearchTab('left')">
                    <i class="fas fa-arrow-left"></i> 左側視窗
                    <span class="tab-count">${groupedResults.left.length}</span>
                </button>
            `;
            firstTab = false;
        }
        
        if (groupedResults.right.length > 0) {
            html += `
                <button class="search-results-tab ${firstTab ? 'active' : ''}" onclick="switchSearchTab('right')">
                    <i class="fas fa-arrow-right"></i> 右側視窗
                    <span class="tab-count">${groupedResults.right.length}</span>
                </button>
            `;
            firstTab = false;
        }
        
        if (groupedResults.other.length > 0) {
            html += `
                <button class="search-results-tab ${firstTab ? 'active' : ''}" onclick="switchSearchTab('other')">
                    <i class="fas fa-file"></i> 其他
                    <span class="tab-count">${groupedResults.other.length}</span>
                </button>
            `;
        }
        
        html += '</div>';
        
        // 建立內容區域
        html += '<div class="search-results-content">';
        
        let firstPane = true;
        if (groupedResults.left.length > 0) {
            html += `
                <div class="search-results-pane ${firstPane ? 'active' : ''}" id="search-results-left">
                    ${renderSearchResults(groupedResults.left, data.keyword, 'left')}
                </div>
            `;
            firstPane = false;
        }
        
        if (groupedResults.right.length > 0) {
            html += `
                <div class="search-results-pane ${firstPane ? 'active' : ''}" id="search-results-right">
                    ${renderSearchResults(groupedResults.right, data.keyword, 'right')}
                </div>
            `;
            firstPane = false;
        }
        
        if (groupedResults.other.length > 0) {
            html += `
                <div class="search-results-pane ${firstPane ? 'active' : ''}" id="search-results-other">
                    ${renderSearchResults(groupedResults.other, data.keyword, 'other')}
                </div>
            `;
        }
        
        html += '</div>';
    } else {
        // 非分割視窗模式或只有一個群組，直接顯示所有結果
        html = '<div class="search-results">';
        html += renderSearchResults(data.results, data.keyword);
        html += '</div>';
    }
    
    resultsDiv.innerHTML = html;
    
    // 儲存全域搜尋結果
    window.searchResultsData = data.results || [];
    window.currentSearchIndex = 0;

    // 重要：更新導航計數
    setTimeout(() => {
        updateSearchNavigation();
    }, 10);    
};

// 渲染搜尋結果
function renderSearchResults(results, keyword, pane) {
    if (!results || results.length === 0) {
        return '<div class="no-results"><i class="fas fa-search"></i><p>沒有找到結果</p></div>';
    }
    
    return results.map((result, index) => {
        // 找到結果在全域陣列中的索引
        const globalIndex = window.searchResultsData ? 
            window.searchResultsData.findIndex(r => r === result) : index;
        
        return `
            <div class="search-result-item" onclick="jumpToSearchResultInPane(${globalIndex}, ${result.lineNumber}, '${pane || ''}')">
                <div class="search-result-header">
                    <div class="search-result-line">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>行號</span>
                        <span class="line-number">${result.lineNumber || '?'}</span>
                    </div>
                </div>
                <div class="search-result-content">
                    ${highlightKeyword(result.content || '', keyword)}
                </div>
            </div>
        `;
    }).join('');
}

// 切換搜尋結果頁籤
window.switchSearchTab = function(tab) {
    console.log('切換到頁籤:', tab);
    
    // 切換頁籤樣式
    document.querySelectorAll('.search-results-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // 找到點擊的頁籤
    const clickedTab = Array.from(document.querySelectorAll('.search-results-tab'))
        .find(t => t.onclick && t.onclick.toString().includes(`'${tab}'`));
    
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // 切換內容
    document.querySelectorAll('.search-results-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = document.getElementById(`search-results-${tab}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
};

// 跳轉到特定視窗的搜尋結果
window.jumpToSearchResultInPane = function(index, lineNumber, pane) {
    console.log('跳轉到搜尋結果:', { index, lineNumber, pane });
    
    // 關閉搜尋對話框
    window.closeSearchModal();
    
    if (window.splitView && pane && (pane === 'left' || pane === 'right')) {
        // 分割視窗模式，跳轉到指定視窗
        const content = document.getElementById(`split-${pane}-content`);
        if (content) {
            const iframe = content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'jump-to-line',
                    lineNumber: lineNumber,
                    matchIndex: index
                }, '*');
                
                // 視覺反饋
                iframe.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.5)';
                setTimeout(() => {
                    iframe.style.boxShadow = '';
                }, 1000);
            }
        }
    } else {
        // 一般模式或跳轉到主視窗
        if (window.activeTabId) {
            const tab = window.currentTabs.find(t => t.id === window.activeTabId);
            if (tab && tab.content) {
                const iframe = tab.content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'jump-to-line',
                        lineNumber: lineNumber,
                        matchIndex: index
                    }, '*');
                }
            }
        }
    }
};

// 高亮關鍵字（支援正則表達式）
function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    
    try {
        // 如果是正則表達式模式，嘗試使用它
        const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    } catch (e) {
        // 如果失敗，返回原文
        return text;
    }
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 取消面板選擇
window.cancelPaneSelect = function() {
    pendingFileForPane = null;
    window.selectPaneForReplace = null;
    closePaneSelectModal();
    showToast('已取消選擇', 'info');
};

// iframe 內的關鍵字同步處理
(function() {
    console.log('iframe 關鍵字同步腳本已載入');
    
    // 監聽來自父視窗的訊息
    window.addEventListener('message', function(event) {
        if (event.data.type === 'sync-keyword-to-input') {
            const keyword = event.data.keyword;
            console.log('收到關鍵字同步請求:', keyword);
            
            // 尋找搜尋輸入框並設置值
            // 支援多種可能的搜尋框 ID
            const possibleInputIds = [
                'search-input',
                'search-keyword', 
                'searchInput',
                'keyword'
            ];
            
            let inputFound = false;
            
            for (const id of possibleInputIds) {
                const input = document.getElementById(id);
                if (input) {
                    console.log('找到搜尋輸入框:', id);
                    input.value = keyword;
                    
                    // 觸發各種可能的事件
                    ['input', 'change', 'keyup'].forEach(eventType => {
                        const event = new Event(eventType, {
                            bubbles: true,
                            cancelable: true,
                        });
                        input.dispatchEvent(event);
                    });
                    
                    inputFound = true;
                    break;
                }
            }
            
            // 如果沒找到 ID，嘗試用 class 或 placeholder 尋找
            if (!inputFound) {
                const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
                inputs.forEach(input => {
                    if (input.placeholder && input.placeholder.includes('搜尋')) {
                        console.log('透過 placeholder 找到搜尋框');
                        input.value = keyword;
                        
                        ['input', 'change', 'keyup'].forEach(eventType => {
                            const event = new Event(eventType, {
                                bubbles: true,
                                cancelable: true,
                            });
                            input.dispatchEvent(event);
                        });
                        
                        inputFound = true;
                    }
                });
            }
            
            if (!inputFound) {
                console.warn('找不到搜尋輸入框');
            }
        }
    });
})();

// 即時同步搜尋關鍵字到所有 iframe
function syncSearchKeyword(keyword) {
    console.log('同步關鍵字到 iframe:', keyword);
    
    // 同步到所有已開啟的標籤
    currentTabs.forEach(tab => {
        if (tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({
                        type: 'sync-search-input',
                        keyword: keyword,
                        targetId: 'search-input'  // 指定目標 input 的 ID
                    }, '*');
                } catch (error) {
                    console.warn('無法同步到標籤:', error);
                }
            }
        }
    });
    
    // 如果在分割視窗模式，也同步到分割視窗
    if (splitView) {
        ['left', 'right'].forEach(pane => {
            const content = document.getElementById(`split-${pane}-content`);
            if (content) {
                const iframe = content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'sync-search-input',
                            keyword: keyword,
                            targetId: 'search-input'
                        }, '*');
                    } catch (error) {
                        console.warn(`無法同步到 ${pane} 視窗:`, error);
                    }
                }
            }
        });
    }
}

// 設置搜尋結果點擊處理
function setupSearchResultClickHandlers() {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    // 使用事件委託
    resultsContainer.addEventListener('click', function(e) {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            const index = parseInt(resultItem.dataset.index);
            const lineNumber = parseInt(resultItem.dataset.line);
            
            console.log('點擊搜尋結果:', { index, lineNumber });
            
            if (!isNaN(index) && !isNaN(lineNumber)) {
                jumpToSearchResult(index, lineNumber);
            }
        }
    });
}

// 綁定到全域
window.syncSearchKeyword = syncSearchKeyword;

// 除錯函數：檢查分割視窗狀態
window.debugSplitSearch = function() {
    console.log('=== 分割視窗搜尋除錯 ===');
    
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    console.log('左側視窗:', {
        有內容: !!leftContent,
        檔案路徑: leftContent?.dataset.filePath,
        標籤ID: leftContent?.dataset.tabId,
        iframe載入: leftContent?.dataset.iframeLoaded,
        有iframe: !!leftContent?.querySelector('iframe')
    });
    
    console.log('右側視窗:', {
        有內容: !!rightContent,
        檔案路徑: rightContent?.dataset.filePath,
        標籤ID: rightContent?.dataset.tabId,
        iframe載入: rightContent?.dataset.iframeLoaded,
        有iframe: !!rightContent?.querySelector('iframe')
    });
    
    console.log('分割視窗狀態:', window.splitViewState);
    console.log('當前是否為分割視窗模式:', window.splitView);
};

// 檢測分割視窗內容狀態
window.checkSplitPaneContent = function() {
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    const status = {
        left: {
            exists: !!leftContent,
            hasFile: leftContent?.dataset.filePath || leftContent?.dataset.tabId || false,
            isEmpty: leftContent?.querySelector('.empty-state')?.style.display !== 'none',
            hasIframe: !!leftContent?.querySelector('iframe')
        },
        right: {
            exists: !!rightContent,
            hasFile: rightContent?.dataset.filePath || rightContent?.dataset.tabId || false,
            isEmpty: rightContent?.querySelector('.empty-state')?.style.display !== 'none',
            hasIframe: !!rightContent?.querySelector('iframe')
        }
    };
    
    console.log('分割視窗內容狀態:', status);
    return status;
};

// 診斷搜尋問題
window.diagnoseSplitSearch = function() {
    console.log('=== 分割視窗搜尋診斷 ===');
    
    // 檢查全域狀態
    console.log('全域狀態:', {
        'window.splitView': window.splitView,
        'window.splitViewState': window.splitViewState,
        'splitView (local)': typeof splitView !== 'undefined' ? splitView : 'undefined',
        'splitViewState (local)': typeof splitViewState !== 'undefined' ? splitViewState : 'undefined'
    });
    
    // 檢查 DOM 狀態
    const splitContainer = document.querySelector('.split-container');
    console.log('DOM 狀態:', {
        '有分割容器': !!splitContainer,
        '容器在 file-viewer 內': splitContainer?.parentElement?.id === 'file-viewer'
    });
    
    // 檢查視窗內容
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    console.log('左側視窗:', {
        存在: !!leftContent,
        檔案路徑: leftContent?.dataset.filePath,
        標籤ID: leftContent?.dataset.tabId,
        有iframe: !!leftContent?.querySelector('iframe'),
        iframe準備: leftContent?.querySelector('iframe')?.contentDocument?.readyState,
        空狀態顯示: leftContent?.querySelector('.empty-state')?.style.display
    });
    
    console.log('右側視窗:', {
        存在: !!rightContent,
        檔案路徑: rightContent?.dataset.filePath,
        標籤ID: rightContent?.dataset.tabId,
        有iframe: !!rightContent?.querySelector('iframe'),
        iframe準備: rightContent?.querySelector('iframe')?.contentDocument?.readyState,
        空狀態顯示: rightContent?.querySelector('.empty-state')?.style.display
    });
    
    // 測試訊息通信
    console.log('\n測試 iframe 通信...');
    
    if (leftContent?.querySelector('iframe')?.contentWindow) {
        console.log('發送測試訊息到左側...');
        leftContent.querySelector('iframe').contentWindow.postMessage({
            type: 'ping',
            source: 'diagnosis'
        }, '*');
    }
    
    if (rightContent?.querySelector('iframe')?.contentWindow) {
        console.log('發送測試訊息到右側...');
        rightContent.querySelector('iframe').contentWindow.postMessage({
            type: 'ping',
            source: 'diagnosis'
        }, '*');
    }
};

// 手動修復分割視窗狀態
window.fixSplitState = function() {
    console.log('手動修復分割視窗狀態...');
    
    const splitContainer = document.querySelector('.split-container');
    if (!splitContainer) {
        console.error('找不到分割視窗容器');
        return;
    }
    
    // 強制設置狀態
    window.splitView = true;
    
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    window.splitViewState = {
        left: leftContent?.dataset.filePath || null,
        right: rightContent?.dataset.filePath || null
    };
    
    // 如果有全域變數，也更新它們
    if (typeof splitView !== 'undefined') {
        splitView = true;
    }
    if (typeof splitViewState !== 'undefined') {
        splitViewState = window.splitViewState;
    }
    
    console.log('狀態已修復:', {
        splitView: window.splitView,
        splitViewState: window.splitViewState
    });
    
    // 重新設置 iframe 通信
    if (leftContent?.querySelector('iframe')) {
        setupIframeCommunication(leftContent.querySelector('iframe'), 'left');
    }
    if (rightContent?.querySelector('iframe')) {
        setupIframeCommunication(rightContent.querySelector('iframe'), 'right');
    }
    
    console.log('修復完成，請重試搜尋');
};
