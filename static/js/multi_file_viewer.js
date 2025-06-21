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
let currentSearchIndex = { left: 0, right: 0 };
let splitViewState = { left: null, right: null };
let tabDragData = null;
let dragCounter = 0; // 防止重複拖放
let isProcessingDrop = false; // 防止重複處理拖放

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否有儲存的狀態
    let stateData = window.initialStateData || null;
    
    if (stateData) {
        try {
            if (typeof stateData === 'string') {
                stateData = JSON.parse(stateData);
            }
            loadWorkspaceState(stateData);
        } catch (e) {
            console.error('載入工作區狀態失敗', e);
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
    
    // 初始化拖放事件
    setupGlobalDragAndDrop();
    setupTabDragAndDrop();
    
    // 初始化鍵盤快捷鍵
    setupKeyboardShortcuts();
    
    // 載入最近檔案和已儲存的工作區
    loadRecentFiles();
    loadSavedWorkspaces();

    // 設置全域拖放標記
    window.globalDropHandled = false;

    // 修復重複拖放事件
    isDragging = false;    
});

// 載入工作區狀態
function loadWorkspaceState(state) {
    if (state.groups) {
        groups = state.groups;
        renderGroups();
    }
    
    // 載入分割視窗狀態
    if (state.splitView !== undefined) {
        splitView = state.splitView;
    }
    
    // 載入標籤
    if (state.tabs && state.tabs.length > 0) {
        state.tabs.forEach((tab, index) => {
            const shouldSwitch = index === 0 && !splitView;
            openFile({
                name: tab.name, 
                path: tab.path, 
                color: tab.color,
                splitPane: tab.splitPane
            }, shouldSwitch);
        });
    }
    
    // 恢復分割視窗狀態
    if (state.splitViewState && splitView) {
        splitViewState = state.splitViewState;
        setTimeout(() => {
            toggleSplitView();
            if (state.splitViewState.left) {
                const leftTab = currentTabs.find(t => t.path === state.splitViewState.left);
                if (leftTab) loadFileToPane(leftTab, 'left');
            }
            if (state.splitViewState.right) {
                const rightTab = currentTabs.find(t => t.path === state.splitViewState.right);
                if (rightTab) loadFileToPane(rightTab, 'right');
            }
        }, 1000);
    } else if (state.activeTabPath || state.activeTab) {
        // 恢復活動標籤
        setTimeout(() => {
            if (state.activeTabPath) {
                const tab = currentTabs.find(t => t.path === state.activeTabPath);
                if (tab) {
                    switchTab(tab.id);
                }
            } else if (state.activeTab) {
                const tab = currentTabs.find(t => t.id === state.activeTab);
                if (tab) {
                    switchTab(tab.id);
                }
            }
        }, 500);
    }
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
            if (splitView) {
                // 檢查焦點在哪個面板
                const activeElement = document.activeElement;
                const leftPane = document.getElementById('split-left');
                const rightPane = document.getElementById('split-right');
                
                if (leftPane && leftPane.contains(activeElement)) {
                    openPaneSearchModal('left');
                } else if (rightPane && rightPane.contains(activeElement)) {
                    openPaneSearchModal('right');
                } else {
                    openSearchModal();
                }
            } else {
                openSearchModal();
            }
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
    
    const toggleIcon = document.createElement('i');
    toggleIcon.className = `fas fa-chevron-${folder.expanded ? 'down' : 'right'} folder-tree-toggle`;
    header.appendChild(toggleIcon);
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-folder group-icon';
    header.appendChild(icon);
    
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = folder.name;
    name.title = folder.path;
    header.appendChild(name);
    
    const count = document.createElement('span');
    count.className = 'group-count';
    count.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>';
    header.appendChild(count);
    
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
    console.log('開啟檔案:', file);
    
    if (!file || !file.path) {
        console.error('檔案資料不完整:', file);
        showToast('檔案資料不完整', 'error');
        return;
    }
    
    const existingTab = currentTabs.find(tab => tab.path === file.path);
    
    if (existingTab) {
        if (switchToTab && !splitView) {
            switchTab(existingTab.id);
        }
        return existingTab;
    }
    
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

    addToRecentFiles(file);
    
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    return tab;
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
            
            if (tabId === activeTabId) {
                showErrorState(filePath);
            }
        };
        
        container.appendChild(iframe);
        
        if (tabId === activeTabId) {
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
    console.log('載入檔案到面板:', { filePath, tabId, isLocal, pane });
    
    try {
        const content = document.getElementById(`split-${pane}-content`);
        const tab = currentTabs.find(t => t.id === tabId);
        
        // 如果是可編輯檔案，使用文字編輯器
        if (tab && tab.isEditable) {
            window.textEditor.loadEditorToPane(tab, pane);
            return;
        }        
        const title = document.getElementById(`split-${pane}-title`);
        const emptyState = document.getElementById(`split-${pane}-empty`);
        
        if (!content) return;
        
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
        iframe.id = `iframe-${pane}-${tabId}`
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        
        if (isLocal) {
            iframe.src = filePath;
        } else {
            iframe.src = `/file_viewer?path=${encodeURIComponent(filePath)}`;
        }
        
        iframe.onload = () => {
            console.log(`檔案載入完成到 ${pane} 面板`);
                   
            content.dataset.tabId = tabId;
            content.dataset.filePath = filePath;

            // 儲存到分割視窗狀態
            splitViewState[pane] = filePath;

            // 修復：找到對應的標籤並更新其狀態
            const tab = currentTabs.find(t => t.id === tabId);
            if (tab) {
                tab.loading = false;
                tab.splitPane = pane;
                renderTabs();
            }

            // 設置同步滾動
            if (syncScroll) {
                window.diffViewer && window.diffViewer.setupSyncScroll();
            }

            // 啟用 iframe 內的訊息通信
            setupIframeCommunication(iframe, pane);            
        };
        
        iframe.onerror = () => {
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
    }
}

// 設置 iframe 通信
function setupIframeCommunication(iframe, pane) {
    // 等待 iframe 載入完成後發送初始化訊息
    setTimeout(() => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'init',
                pane: pane
            }, '*');
        }
    }, 500);
}

// 生成標籤ID
function generateTabId() {
    return 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 渲染標籤
function renderTabs() {
    const tabsContainer = document.getElementById('file-tabs');
    
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
        
        // 檢查是否需要恢復分割視窗
        if (splitView && tab.splitPane) {
            // 如果已經在分割視窗模式，直接載入到對應面板
            loadFileToPane(tab, tab.splitPane);
        } else if (tab.splitPane && !splitView) {
            // 如果標籤有分割視窗記錄但目前不在分割視窗模式
            toggleSplitView();
            setTimeout(() => {
                // 找到配對的檔案
                const pairedTabs = currentTabs.filter(t => t.splitPane);
                pairedTabs.forEach(t => {
                    if (t.splitPane === 'left') {
                        loadFileToPane(t, 'left');
                    } else if (t.splitPane === 'right') {
                        loadFileToPane(t, 'right');
                    }
                });
            }, 300);
        } else {
            switchTab(tab.id);
        }
    };
    
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
        colorOption.onclick = (e) => {
            e.stopPropagation();
            changeTabColor(tab.id, color);
            colorPicker.classList.remove('show');
        };
        colorPicker.appendChild(colorOption);
    });
    tabDiv.appendChild(colorPicker);
    
    return tabDiv;
}

// 顯示標籤右鍵選單
function showTabContextMenu(e, tab) {
    e.preventDefault();
    e.stopPropagation();
    
    const colorPicker = document.getElementById(`color-picker-${tab.id}`);
    if (colorPicker) {
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.classList.remove('show');
        });
        
        colorPicker.classList.add('show');
        
        setTimeout(() => {
            document.addEventListener('click', function hideColorPicker() {
                colorPicker.classList.remove('show');
                document.removeEventListener('click', hideColorPicker);
            }, { once: true });
        }, 100);
    }
}

// 更改標籤顏色
function changeTabColor(tabId, color) {
    const tab = currentTabs.find(t => t.id === tabId);
    if (tab) {
        tab.color = color;
        renderTabs();
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
        
        // 如果是分割視窗的標籤，清理分割視窗狀態
        if (tab.splitPane) {
            if (splitViewState.left === tab.path) {
                splitViewState.left = null;
            }
            if (splitViewState.right === tab.path) {
                splitViewState.right = null;
            }
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
    }
}

// 搜尋檔案
function searchFiles(query) {
    const allItems = document.querySelectorAll('.file-item, .folder-item');
    
    if (!query) {
        allItems.forEach(item => {
            item.style.display = 'flex';
        });
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    
    allItems.forEach(item => {
        const name = item.querySelector('.item-name').textContent.toLowerCase();
        if (name.includes(lowerQuery)) {
            item.style.display = 'flex';
            
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
function showView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    const container = document.getElementById('groups-container');
    
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
        recentFiles.forEach(file => {
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
            `;
            
            recentDiv.appendChild(fileDiv);
        });
    }
    
    container.appendChild(recentDiv);
}

// 渲染已儲存的工作區
function renderSavedWorkspaces() {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';
    
    const savedDiv = document.createElement('div');
    savedDiv.className = 'saved-workspaces';
    
    fetch('/api/multi_viewer/list')
        .then(response => response.json())
        .then(data => {
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
                    `;
                    
                    savedDiv.appendChild(workspaceDiv);
                });
            }
            
            container.appendChild(savedDiv);
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

// 開啟搜尋對話框
function openSearchModal() {
    document.getElementById('search-modal').classList.add('show');
    document.getElementById('search-keyword').focus();
    
    // 根據當前模式設置搜尋範圍
    const searchScope = document.getElementById('search-scope');
    if (splitView) {
        searchScope.value = 'all';
        searchScope.style.display = 'block';
        searchScope.previousElementSibling.style.display = 'block';
    } else {
        searchScope.value = 'active';
        searchScope.style.display = 'none';
        searchScope.previousElementSibling.style.display = 'none';
    }
}

function closeSearchModal() {
    document.getElementById('search-modal').classList.remove('show');
}

// 執行搜尋
function performSearch() {
    const keyword = document.getElementById('search-keyword').value;
    const scope = document.getElementById('search-scope').value;
    const caseSensitive = document.getElementById('search-case-sensitive').checked;
    const wholeWord = document.getElementById('search-whole-word').checked;
    const regex = document.getElementById('search-regex').checked;
    
    if (!keyword) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }
    
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p style="text-align: center; color: #999;">搜尋中...</p>';
    
    // 實際搜尋實現需要與 iframe 內容通信
    setTimeout(() => {
        // 這裡應該實現真正的搜尋功能
        const searchOptions = {
            keyword,
            scope,
            caseSensitive,
            wholeWord,
            regex
        };
        
        // 根據搜尋範圍執行搜尋
        if (scope === 'all' && splitView) {
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
        
        resultsDiv.innerHTML = '<p style="text-align: center; color: #999;">搜尋完成</p>';
    }, 500);
}

// 在特定面板中搜尋
function searchInPane(pane, options) {
    const content = document.getElementById(`split-${pane}-content`);
    const iframe = content?.querySelector('iframe');
    
    if (iframe && iframe.contentWindow) {
        // 發送搜尋請求到 iframe
        iframe.contentWindow.postMessage({
            type: 'search',
            options: options
        }, '*');
    }
}

// 在活動標籤中搜尋
function searchInActiveTab(options) {
    if (activeTabId) {
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && tab.content) {
            const iframe = tab.content.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'search',
                    options: options
                }, '*');
            }
        }
    }
}

// 開啟面板搜尋對話框
function openPaneSearchModal(pane) {
    currentSearchPane = pane;
    const modal = document.getElementById('pane-search-modal');
    const title = document.getElementById('pane-search-title');
    
    if (title) {
        title.textContent = pane === 'left' ? '左側視窗' : '右側視窗';
    }
    modal.classList.add('show');
    document.getElementById('pane-search-keyword').focus();
}

function closePaneSearchModal() {
    document.getElementById('pane-search-modal').classList.remove('show');
    currentSearchPane = null;
}

// 執行面板搜尋
function performPaneSearch() {
    const keyword = document.getElementById('pane-search-keyword').value;
    const caseSensitive = document.getElementById('pane-search-case-sensitive').checked;
    const wholeWord = document.getElementById('pane-search-whole-word').checked;
    const regex = document.getElementById('pane-search-regex').checked;
    
    if (!keyword || !currentSearchPane) return;
    
    const searchOptions = {
        keyword,
        caseSensitive,
        wholeWord,
        regex
    };
    
    searchInPane(currentSearchPane, searchOptions);
}

// 切換分割視窗 - 修復邏輯
function toggleSplitView() {
    splitView = !splitView;
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
                        <button class="split-pane-close" onclick="closeSplitPane('left')" title="關閉">
                            <i class="fas fa-times"></i>
                        </button>                        
                    </div>
                </div>
                <div class="split-pane-content" id="split-left-content">
                    <div class="empty-state" id="split-left-empty" ondblclick="handleSplitPaneDoubleClick('left')">
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
                        <button class="split-pane-close" onclick="closeSplitPane('right')" title="關閉">
                            <i class="fas fa-times"></i>
                        </button>                        
                    </div>
                </div>
                <div class="split-pane-content" id="split-right-content">
                    <div class="empty-state" id="split-right-empty" ondblclick="handleSplitPaneDoubleClick('right')">
                        <i class="fas fa-file-alt"></i>
                        <p>選擇檔案顯示在右側</p>
                        <p style="font-size: 14px;">或拖曳檔案到此處</p>
                        <p style="font-size: 12px; color: #999; margin-top: 10px;">
                            <i class="fas fa-info-circle"></i> 雙擊創建新檔案
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
            content.addEventListener('dblclick', (e) => {
                if (e.target.closest('.empty-state')) {
                    handleSplitPaneDoubleClick(pane);
                }
            });
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
    // 確保在分割視窗模式
    if (!splitView) {
        showToast('請先開啟分割視窗模式', 'error');
        return;
    }
    
    // 檢查是否已經開啟
    const existingTab = currentTabs.find(tab => tab.path === virtualFile.path);
    
    if (existingTab) {
        // 如果檔案已開啟，直接載入到面板
        existingTab.splitPane = pane;
        loadFileToPane(existingTab, pane);
        renderTabs();
    } else {
        // 開啟新檔案 - 重要：第二個參數設為 false，不要切換到新標籤
        const tab = openFile(virtualFile, false);
        
        if (tab) {
            // 等待標籤創建完成
            setTimeout(() => {
                const createdTab = currentTabs.find(t => t.path === virtualFile.path);
                if (createdTab) {
                    createdTab.splitPane = pane;
                    // 確保檔案內容載入到正確的面板
                    if (!createdTab.content || createdTab.loading) {
                        // 直接載入到指定面板
                        const content = document.getElementById(`split-${pane}-content`);
                        if (content) {
                            const emptyState = content.querySelector('.empty-state');
                            if (emptyState) emptyState.style.display = 'none';
                        }
                        loadFileContentForPane(createdTab.path, createdTab.id, createdTab.isLocal, pane);
                    } else {                    
                        loadFileToPane(createdTab, pane);
                    }
                    renderTabs();
                }
            }, 100);
        }
    }
    
    showToast(`已在${pane === 'left' ? '左側' : '右側'}視窗開啟 ${virtualFile.name}`, 'success');
}

// 載入檔案到特定面板
function loadFileToPane(tab, pane) {
    // 確保在分割視窗模式
    if (!splitView) {
        console.error('嘗試在非分割視窗模式下載入檔案到面板');
        return;
    }

    const content = document.getElementById(`split-${pane}-content`);
    const title = document.getElementById(`split-${pane}-title`);

    if (content && tab) {
        content.innerHTML = '';
        content.dataset.tabId = tab.id;
        content.dataset.filePath = tab.path;
        
        // 隱藏空狀態
        const emptyState = document.getElementById(`split-${pane}-empty`);
        if (emptyState) emptyState.style.display = 'none';

        if (tab.content && !tab.loading) {
            // 如果內容已載入，直接複製
            const iframe = tab.content.querySelector('iframe');
            if (iframe) {
                const newIframe = iframe.cloneNode(true);
                content.appendChild(newIframe);
            }
        } else {
            content.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>載入中...</p>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            `;
            
            loadFileContentForPane(tab.path, tab.id, tab.isLocal, pane);
        }
        
        if (title) {
            title.textContent = tab.name;
            title.title = tab.path;
        }
        
        // 更新狀態
        splitViewState[pane] = tab.path;
        tab.splitPane = pane;
        renderTabs();
    }
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
    
    // 準備工作區狀態
    const state = {
        name: name,
        groups: groups,
        tabs: currentTabs.map(tab => ({
            name: tab.name,
            path: tab.path,
            color: tab.color,
            splitPane: tab.splitPane
        })),
        activeTabPath: activeTabId ? currentTabs.find(t => t.id === activeTabId)?.path : null,
        splitView: splitView,
        splitViewState: splitViewState,
        diffMode: diffMode,
        timestamp: new Date().toISOString()
    };
    
    try {
        const response = await fetch('/api/multi_viewer/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state: state,
                permission: isPrivate ? 'private' : 'public',
                password: password
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('工作區儲存成功', 'success');
            closeSaveModal();
            
            window.history.pushState({}, '', `/multi_viewer?state=${result.state_id}`);
            currentWorkspaceId = result.state_id;
            
            // 更新已儲存計數
            updateSavedCount();
        } else {
            showToast('儲存失敗：' + result.error, 'error');
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
    const badge = document.querySelector('.nav-item:nth-child(2) .nav-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

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