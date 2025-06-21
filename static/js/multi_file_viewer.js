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
    setupDragAndDrop();
    setupTabDragAndDrop();
    
    // 初始化鍵盤快捷鍵
    setupKeyboardShortcuts();
    
    // 載入最近檔案和已儲存的工作區
    loadRecentFiles();
    loadSavedWorkspaces();
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
        if (splitView) {
            document.getElementById('main-toolbar').style.display = 'none';
            document.getElementById('split-toolbar').style.display = 'flex';
        }
    }
    
    if (state.tabs) {
        state.tabs.forEach((tab, index) => {
            const shouldSwitch = index === 0;
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
        setTimeout(() => {
            createSplitView();
            if (state.splitViewState.left) {
                const leftTab = currentTabs.find(t => t.path === state.splitViewState.left);
                if (leftTab) loadFileToPane(leftTab, 'left');
            }
            if (state.splitViewState.right) {
                const rightTab = currentTabs.find(t => t.path === state.splitViewState.right);
                if (rightTab) loadFileToPane(rightTab, 'right');
            }
        }, 1000);
    }
    
    if (state.activeTabPath || state.activeTab) {
        setTimeout(() => {
            if (state.activeTabPath) {
                const tab = currentTabs.find(t => t.path === state.activeTabPath);
                if (tab) {
                    switchTab(tab.id);
                    return;
                }
            }
            const tab = currentTabs.find(t => t.id === state.activeTab);
            if (tab) {
                switchTab(tab.id);
            }
        }, 500);
    }
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
    
    tabsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingTab = document.querySelector('.file-tab.dragging');
        if (!draggingTab) return;
        
        const afterElement = getDragAfterElement(tabsContainer, e.clientX);
        if (afterElement == null) {
            tabsContainer.appendChild(draggingTab);
        } else {
            tabsContainer.insertBefore(draggingTab, afterElement);
        }
    });
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
    } else {
        itemDiv.className = 'file-item';
        itemDiv.onclick = () => openFile(item);
        
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.width = '100%';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-file-alt item-icon';
        mainContainer.appendChild(icon);
        
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.name;
        mainContainer.appendChild(name);
        
        itemDiv.appendChild(mainContainer);
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
        if (switchToTab) {
            switchTab(existingTab.id);
        }
        return;
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
        loadStartTime: Date.now(),
        splitPane: file.splitPane || null
    };
    
    console.log('創建新標籤:', tab);
    
    tabCounter++;
    currentTabs.push(tab);

    if (switchToTab || !activeTabId) {
        activeTabId = tab.id;
    }
    
    renderTabs();
    
    if (switchToTab) {
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
    }

    loadFileContentOptimized(file.path, tabId, file.isLocal);

    addToRecentFiles(file);
    
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
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
        const title = document.getElementById(`split-${pane}-title`);
        
        if (!content) return;
        
        content.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        
        const iframe = document.createElement('iframe');
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
            
            if (title) {
                const fileName = filePath.split('/').pop();
                title.textContent = fileName;
                title.title = filePath;
            }
            
            content.dataset.tabId = tabId;
            
            // 儲存到分割視窗狀態
            splitViewState[pane] = filePath;
            
            // 設置同步滾動
            if (syncScroll) {
                setupSyncScroll();
            }
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
        e.dataTransfer.effectAllowed = 'move';
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
    
    tabDiv.onclick = (e) => {
        if (e.target.closest('.tab-close') || e.target.closest('.color-picker')) {
            return;
        }
        
        // 檢查是否需要在分割視窗中開啟
        if (tab.splitPane) {
            if (!splitView) {
                toggleSplitView();
            }
            setTimeout(() => {
                const leftTab = currentTabs.find(t => t.path === splitViewState.left);
                const rightTab = currentTabs.find(t => t.path === splitViewState.right);
                if (leftTab) loadFileToPane(leftTab, 'left');
                if (rightTab) loadFileToPane(rightTab, 'right');
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
    
    // 如果是分割視窗的檔案，顯示特殊圖標
    if (tab.splitPane) {
        const splitIcon = document.createElement('i');
        splitIcon.className = 'fas fa-columns tab-split-icon';
        splitIcon.style.marginLeft = '4px';
        splitIcon.style.fontSize = '10px';
        splitIcon.style.opacity = '0.7';
        tabDiv.appendChild(splitIcon);
    }
    
    tabDiv.appendChild(icon);
    
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
            if (!viewerContainer.querySelector('.split-container')) {
                createSplitView();
            }
            
            const leftPane = document.getElementById('split-left-content');
            if (leftPane && tab.content) {
                leftPane.innerHTML = '';
                leftPane.appendChild(tab.content.cloneNode(true));
            }
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
    div.onclick = () => openUploadModal();
    div.innerHTML = `
        <i class="fas fa-file-alt"></i>
        <h5>選擇檔案開始瀏覽</h5>
        <p>從左側檔案樹選擇檔案，或拖曳檔案到此處</p>
        <button class="empty-state-btn">
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
    
    title.textContent = pane === 'left' ? '左側視窗' : '右側視窗';
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

// 切換分割視窗
function toggleSplitView() {
    splitView = !splitView;
    const viewerContainer = document.getElementById('file-viewer');
    
    if (splitView) {
        createSplitView();
        document.getElementById('main-toolbar').style.display = 'none';
        document.getElementById('split-toolbar').style.display = 'flex';
        showToast('已啟用分割視窗', 'success');
    } else {
        // 恢復單一視窗
        document.getElementById('main-toolbar').style.display = 'flex';
        document.getElementById('split-toolbar').style.display = 'none';
        document.getElementById('diff-controls').style.display = 'none';
        diffMode = false;
        
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
                    </div>
                </div>
                <div class="split-pane-content" id="split-left-content">
                    <div class="empty-state" id="split-left-empty" onclick="openUploadModalForPane('left')">
                        <i class="fas fa-file-alt"></i>
                        <p>選擇檔案顯示在左側</p>
                        <p style="font-size: 14px;">或拖曳檔案到此處</p>
                        <button class="empty-state-btn">
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
                    </div>
                </div>
                <div class="split-pane-content" id="split-right-content">
                    <div class="empty-state" id="split-right-empty" onclick="openUploadModalForPane('right')">
                        <i class="fas fa-file-alt"></i>
                        <p>選擇檔案顯示在右側</p>
                        <p style="font-size: 14px;">或拖曳檔案到此處</p>
                        <button class="empty-state-btn">
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
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    
    [leftContent, rightContent].forEach((content, index) => {
        const pane = index === 0 ? 'left' : 'right';
        
        content.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const emptyState = content.querySelector('.empty-state');
            if (emptyState) {
                emptyState.classList.add('drag-over');
            }
        });
        
        content.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const emptyState = content.querySelector('.empty-state');
            if (emptyState) {
                emptyState.classList.remove('drag-over');
            }
        });
        
        content.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const emptyState = content.querySelector('.empty-state');
            if (emptyState) {
                emptyState.classList.remove('drag-over');
            }
            handleDropForPane(e, pane);
        });
        
        // 設置焦點事件
        content.addEventListener('click', () => {
            content.focus();
        });
    });
    
    // 恢復之前的狀態
    if (splitViewState.left) {
        const leftTab = currentTabs.find(t => t.path === splitViewState.left);
        if (leftTab) loadFileToPane(leftTab, 'left');
    }
    
    if (splitViewState.right) {
        const rightTab = currentTabs.find(t => t.path === splitViewState.right);
        if (rightTab) loadFileToPane(rightTab, 'right');
    }
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
    
    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPane.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
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
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

// 搜尋分割面板
window.searchInSplitPane = function(pane) {
    openPaneSearchModal(pane);
};

// 交換左右面板
window.swapPanes = function() {
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    const leftTitle = document.getElementById('split-left-title');
    const rightTitle = document.getElementById('split-right-title');
    
    // 交換內容
    const tempContent = leftContent.innerHTML;
    leftContent.innerHTML = rightContent.innerHTML;
    rightContent.innerHTML = tempContent;
    
    // 交換標題
    const tempTitle = leftTitle.textContent;
    leftTitle.textContent = rightTitle.textContent;
    rightTitle.textContent = tempTitle;
    
    // 交換狀態
    const tempState = splitViewState.left;
    splitViewState.left = splitViewState.right;
    splitViewState.right = tempState;
    
    showToast('已交換左右視窗', 'success');
};

// 切換差異模式
window.toggleDiffMode = function() {
    diffMode = !diffMode;
    const diffControls = document.getElementById('diff-controls');
    const diffBtn = document.querySelector('.btn-diff');
    
    if (diffMode) {
        diffControls.style.display = 'flex';
        diffBtn.classList.add('active');
        
        // 執行差異比較
        performDiff();
        
        showToast('已啟用差異比較模式', 'success');
    } else {
        diffControls.style.display = 'none';
        diffBtn.classList.remove('active');
        closeDiffViewer();
        showToast('已關閉差異比較模式', 'info');
    }
};

// 執行差異比較
async function performDiff() {
    const leftContent = await getIframeContent('left');
    const rightContent = await getIframeContent('right');
    
    if (!leftContent || !rightContent) {
        showToast('無法獲取檔案內容', 'error');
        return;
    }
    
    // 使用 jsdiff 庫進行差異比較
    const diff = Diff.createTwoFilesPatch(
        splitViewState.left || 'Left File',
        splitViewState.right || 'Right File',
        leftContent,
        rightContent
    );
    
    // 顯示差異
    const diffViewer = document.getElementById('diff-viewer');
    const diffContent = document.getElementById('diff-content');
    
    // 使用 diff2html 顯示差異
    const diffHtml = Diff2Html.html(diff, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side'
    });
    
    diffContent.innerHTML = diffHtml;
    diffViewer.style.display = 'block';
}

// 獲取 iframe 內容
async function getIframeContent(pane) {
    const content = document.getElementById(`split-${pane}-content`);
    const iframe = content?.querySelector('iframe');
    
    if (!iframe) return null;
    
    try {
        // 這裡需要實現與 iframe 的通信來獲取內容
        // 暫時返回模擬內容
        return `Sample content from ${pane} pane`;
    } catch (error) {
        console.error('獲取 iframe 內容失敗:', error);
        return null;
    }
}

// 關閉差異查看器
window.closeDiffViewer = function() {
    document.getElementById('diff-viewer').style.display = 'none';
};

// 同步滾動
window.syncScrolling = function() {
    syncScroll = !syncScroll;
    
    if (syncScroll) {
        setupSyncScroll();
        showToast('已啟用同步滾動', 'success');
    } else {
        removeSyncScroll();
        showToast('已關閉同步滾動', 'info');
    }
};

// 設置同步滾動
function setupSyncScroll() {
    const leftContent = document.getElementById('split-left-content');
    const rightContent = document.getElementById('split-right-content');
    const leftIframe = leftContent?.querySelector('iframe');
    const rightIframe = rightContent?.querySelector('iframe');
    
    if (leftIframe && rightIframe) {
        // 需要實現 iframe 內容的滾動同步
        // 這需要與 iframe 內容進行通信
    }
}

// 移除同步滾動
function removeSyncScroll() {
    // 移除滾動事件監聽器
}

// 複製差異到左側
window.copyDiffLeft = function() {
    showToast('功能開發中', 'info');
};

// 複製差異到右側  
window.copyDiffRight = function() {
    showToast('功能開發中', 'info');
};

// 下一個差異
window.nextDiff = function() {
    showToast('功能開發中', 'info');
};

// 上一個差異
window.prevDiff = function() {
    showToast('功能開發中', 'info');
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

// 處理拖放到特定面板
function handleDropForPane(event, pane) {
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
        const file = files[0];
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        const existingTab = currentTabs.find(tab => tab.path === virtualFile.path);
        if (existingTab) {
            loadFileToPane(existingTab, pane);
        } else {
            openFile(virtualFile, false);
            setTimeout(() => {
                const newTab = currentTabs.find(tab => tab.path === virtualFile.path);
                if (newTab) {
                    // 標記此標籤在分割視窗中使用
                    newTab.splitPane = pane;
                    loadFileToPane(newTab, pane);
                    renderTabs();
                }
            }, 100);
        }
        
        showToast(`已在${pane === 'left' ? '左側' : '右側'}視窗開啟 ${file.name}`, 'success');
    }
}

// 載入檔案到特定面板
function loadFileToPane(tab, pane) {
    const content = document.getElementById(`split-${pane}-content`);
    const title = document.getElementById(`split-${pane}-title`);
    
    if (content && tab) {
        content.innerHTML = '';
        content.dataset.tabId = tab.id;
        
        if (tab.content && !tab.loading) {
            content.appendChild(tab.content.cloneNode(true));
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
            
            window.history.pushState({}, '', `/multi_viewer?state=${result.id}`);
            currentWorkspaceId = result.id;
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
        showToast('匯出功能開發中', 'info');
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
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
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
    
    document.getElementById('uploaded-files').style.display = uploadedFiles.length > 0 ? 'block' : 'none';
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
    
    uploadedFiles.forEach((file, index) => {
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        if (splitView && currentUploadPane) {
            if (index === 0) {
                openFile(virtualFile, false);
                setTimeout(() => {
                    const newTab = currentTabs.find(tab => tab.path === virtualFile.path);
                    if (newTab) {
                        newTab.splitPane = currentUploadPane;
                        loadFileToPane(newTab, currentUploadPane);
                        renderTabs();
                    }
                }, 100);
            } else {
                openFile(virtualFile, false);
            }
        } else {
            openFile(virtualFile, index === 0);
        }
    });
    
    closeUploadModal();
    showToast(`已開啟 ${uploadedFiles.length} 個檔案`, 'success');
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

// 設置主要拖放事件
function setupDragAndDrop() {
    const viewerContainer = document.getElementById('file-viewer');
    
    viewerContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emptyState = viewerContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.classList.add('drag-over');
        }
    });
    
    viewerContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emptyState = viewerContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.classList.remove('drag-over');
        }
    });
    
    viewerContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emptyState = viewerContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.classList.remove('drag-over');
        }
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
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
    });
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

// 在初始化時載入設定
loadSettings();