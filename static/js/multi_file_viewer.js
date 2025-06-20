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

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否有儲存的狀態
    // 從 HTML 中定義的全域變數讀取 stateData
    let stateData = window.initialStateData || null;
    
    if (stateData) {
        try {
            // 如果 stateData 是字串，需要解析
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
        
        console.log('URL 參數 groups:', groupsData); // 調試用
        
        if (groupsData) {
            try {
                groups = JSON.parse(decodeURIComponent(groupsData));
                console.log('解析後的群組資料:', groups); // 調試用
                
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
                    console.log('找到的第一個檔案:', firstFile); // 調試用
                    
                    if (firstFile) {
                        openFile(firstFile);
                    } else {
                        console.log('沒有找到任何檔案');
                        showToast('沒有找到可開啟的檔案', 'info');
                    }
                }, 500);
                
            } catch (e) {
                console.error('解析群組資料失敗', e);
                showToast('無法載入檔案資料，請重新嘗試', 'error');
            }
        } else {
            console.log('沒有 groups 參數，載入預設資料');
            // 載入預設資料
            loadDefaultGroups();
        }
    }
    
    // 初始化拖放事件
    setupDragAndDrop();
    
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
    
    if (state.tabs) {
        state.tabs.forEach((tab, index) => {
            const shouldSwitch = index === 0; // 只有第一個檔案切換到它
            openFile({name: tab.name, path: tab.path, color: tab.color}, shouldSwitch);
        });
    }
    
    if (state.activeTabPath || state.activeTab) {
        setTimeout(() => {
            // 優先使用 path 來匹配
            if (state.activeTabPath) {
                const tab = currentTabs.find(t => t.path === state.activeTabPath);
                if (tab) {
                    switchTab(tab.id);
                    return;
                }
            }
            // 舊的邏輯作為備用
            const tab = currentTabs.find(t => t.id === state.activeTab);
            if (tab) {
                switchTab(tab.id);
            }
        }, 500); // 增加延遲確保所有檔案都載入完成
    }
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
    console.log('查找第一個檔案，群組數量:', groups.length); // 調試用
    
    for (let group of groups) {
        console.log('檢查群組:', group.name, group); // 調試用
        
        if (group.items) {
            for (let item of group.items) {
                console.log('檢查項目:', item); // 調試用
                
                if (item.type === 'file') {
                    return item;
                } else if (item.type === 'folder' && item.children) {
                    console.log('檢查資料夾子項目，數量:', item.children.length); // 調試用
                    
                    for (let child of item.children) {
                        if (child.type === 'file') {
                            console.log('找到檔案:', child); // 調試用
                            return child;
                        }
                    }
                }
            }
        }
    }
    
    console.log('沒有找到任何檔案'); // 調試用
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
    
    console.log('渲染群組，數量:', groups.length); // 調試用
    
    let totalFiles = 0;
    let totalFolders = 0;
    
    groups.forEach((group, groupIndex) => {
        console.log('渲染群組:', group.name, group); // 調試用
        
        // 處理群組中的項目
        if (group.items && group.items.length > 0) {
            group.items.forEach(item => {
                if (item.type === 'folder') {
                    // 每個資料夾作為獨立的樹
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
                    // 群組（如單獨檔案）
                    const groupDiv = createGroupElement(item, `${groupIndex}-${item.name}`);
                    container.appendChild(groupDiv);
                    if (item.items) {
                        totalFiles += item.items.length;
                    }
                } else if (item.type === 'file') {
                    // 單獨的檔案
                    const fileGroupDiv = createSingleFileElement(item);
                    container.appendChild(fileGroupDiv);
                    totalFiles++;
                }
            });
        } else {
            // 舊的群組格式
            const groupDiv = createGroupElement(group, groupIndex);
            container.appendChild(groupDiv);
            
            // 計算檔案總數
            if (group.items) {
                totalFiles += countFiles(group.items);
            }
        }
    });
    
    console.log('總檔案數:', totalFiles, '總資料夾數:', totalFolders); // 調試用
    
    // 更新檔案計數
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
    
    // 群組圖標
    const icon = document.createElement('i');
    icon.className = `fas ${group.icon || 'fa-folder'} group-icon`;
    header.appendChild(icon);
    
    // 群組名稱
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.name;
    header.appendChild(name);
    
    // 項目計數
    const count = document.createElement('span');
    count.className = 'group-count';
    const fileCount = group.items ? countFiles(group.items) : 0;
    count.textContent = fileCount;
    header.appendChild(count);
    
    groupDiv.appendChild(header);
    
    // 項目容器
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
    
    // 資料夾標題
    const header = document.createElement('div');
    header.className = 'group-header folder-header';
    header.onclick = () => toggleFolderTree(folder.path);
    
    // 展開/收合圖標
    const toggleIcon = document.createElement('i');
    toggleIcon.className = `fas fa-chevron-${folder.expanded ? 'down' : 'right'} folder-tree-toggle`;
    header.appendChild(toggleIcon);
    
    // 資料夾圖標
    const icon = document.createElement('i');
    icon.className = 'fas fa-folder group-icon';
    header.appendChild(icon);
    
    // 資料夾名稱
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = folder.name;
    name.title = folder.path;
    header.appendChild(name);
    
    // 項目計數（先設為載入中）
    const count = document.createElement('span');
    count.className = 'group-count';
    count.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>';
    header.appendChild(count);
    
    folderDiv.appendChild(header);
    
    // 樹狀容器
    const treeContainer = document.createElement('div');
    treeContainer.className = 'folder-tree';
    treeContainer.id = `folder-tree-${folder.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    treeContainer.style.display = folder.expanded ? 'block' : 'none';
    
    folderDiv.appendChild(treeContainer);
    
    // 如果展開，載入資料夾內容
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
    
    // 檔案圖標
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-alt item-icon';
    icon.style.color = '#667eea';
    mainContainer.appendChild(icon);
    
    // 檔案名稱（僅在非收合狀態顯示）
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
            
            // 如果還沒載入內容，現在載入
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
        // 顯示載入中
        container.innerHTML = `
            <div class="loading-folder">
                <i class="fas fa-spinner fa-spin"></i> 載入中...
            </div>
        `;
        
        // 這裡應該調用後端 API 來獲取資料夾內容
        // 暫時使用模擬資料
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
            // 過濾掉返回上級的項目
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
        
        // 創建主要容器
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.width = '100%';
        
        // 切換按鈕
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
        
        // 資料夾圖標
        const icon = document.createElement('i');
        icon.className = 'fas fa-folder item-icon';
        mainContainer.appendChild(icon);
        
        // 資料夾名稱
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.name;
        mainContainer.appendChild(name);
        
        itemDiv.appendChild(mainContainer);
        
        // 子項目容器
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
        
        // 創建主要容器
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.width = '100%';
        
        // 檔案圖標
        const icon = document.createElement('i');
        icon.className = 'fas fa-file-alt item-icon';
        mainContainer.appendChild(icon);
        
        // 檔案名稱
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
    
    // 檢查必要的屬性
    if (!file || !file.path) {
        console.error('檔案資料不完整:', file);
        showToast('檔案資料不完整', 'error');
        return;
    }
    
    // 檢查是否已開啟
    const existingTab = currentTabs.find(tab => tab.path === file.path);
    
    if (existingTab) {
        if (switchToTab) {
            switchTab(existingTab.id);
        }
        return;
    }
    
    // 創建新標籤
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
        loadStartTime: Date.now()
    };
    
    console.log('創建新標籤:', tab);
    
    tabCounter++;
    currentTabs.push(tab);

    // 確保設置 activeTabId
    if (switchToTab || !activeTabId) {
        activeTabId = tab.id;
    }
    
    renderTabs();
    
    // 載入檔案內容（優化版本）
    loadFileContentOptimized(file.path, tabId, file.isLocal);
    
    if (switchToTab) {
        // 顯示載入中狀態
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
    
    // 添加到最近檔案
    addToRecentFiles(file);
    
    // 高亮顯示當前檔案
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
        
        // 標記為載入中
        tab.loading = true;
        tab.content = null;
        
        // 創建 iframe 容器和載入指示器
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        
        // 載入指示器
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
        
        // 創建 iframe
        const iframe = document.createElement('iframe');
        iframe.id = `iframe-${tabId}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        
        // 設置 src 前的準備
        if (isLocal) {
            iframe.src = filePath;
        } else {
            const encodedPath = encodeURIComponent(filePath);
            iframe.src = `/file_viewer?path=${encodedPath}`;
        }
        
        console.log('創建 iframe，src:', iframe.src);
        
        // 監控載入進度
        let loadingCheckInterval = null;
        let loadTimeout = null;
        
        // 設置載入完成處理
        iframe.onload = () => {
            console.log('iframe 載入完成');
            clearInterval(loadingCheckInterval);
            clearTimeout(loadTimeout);
            
            // 計算載入時間
            const loadTime = Date.now() - tab.loadStartTime;
            console.log(`檔案載入完成，耗時: ${loadTime}ms`);
            
            // 漸隱載入指示器
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
            
            // 顯示載入成功提示（對於大檔案）
            if (loadTime > 3000) {
                showToast(`檔案載入完成 (${(loadTime/1000).toFixed(1)}秒)`, 'success');
            }
        };
        
        // 設置錯誤處理
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
        
        // 添加 iframe 到容器
        container.appendChild(iframe);
        
        // 如果是當前標籤，顯示容器
        if (tabId === activeTabId) {
            const viewerContainer = document.getElementById('file-viewer');
            viewerContainer.innerHTML = '';
            viewerContainer.appendChild(container);
        }
        
        // 儲存容器到 tab
        tab.content = container;
        
        // 設置較短的超時時間
        loadTimeout = setTimeout(() => {
            if (tab.loading) {
                console.warn('載入時間過長，可能是大檔案');
                // 不直接標記為失敗，繼續等待
                showToast('檔案較大，載入中...', 'info');
            }
        }, 10000); // 10秒提醒
        
        // 最終超時
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
        }, 60000); // 60秒最終超時
        
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
        
        // 顯示載入中
        content.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>載入中...</p>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        
        // 創建 iframe
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
            
            // 更新標題
            if (title) {
                const fileName = filePath.split('/').pop();
                title.textContent = fileName;
                title.title = filePath;
            }
            
            // 儲存 tabId
            content.dataset.tabId = tabId;
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
    
    // 保留手機選單按鈕和新增按鈕
    const mobileBtn = tabsContainer.querySelector('.mobile-menu-btn');
    const addBtn = tabsContainer.querySelector('.add-tab-btn');
    
    // 清空標籤（保留按鈕）
    const existingTabs = tabsContainer.querySelectorAll('.file-tab');
    existingTabs.forEach(tab => tab.remove());
    
    // 插入標籤
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
    tabDiv.onclick = (e) => {
        // 防止點擊子元素時觸發
        if (e.target.closest('.tab-close') || e.target.closest('.color-picker')) {
            return;
        }
        switchTab(tab.id);
    };
    tabDiv.oncontextmenu = (e) => showTabContextMenu(e, tab);
    tabDiv.title = tab.path;
    
    // 圖標
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-alt tab-icon';
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
        // 隱藏其他顏色選擇器
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.classList.remove('show');
        });
        
        colorPicker.classList.add('show');
        
        // 點擊其他地方時關閉
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
        
        // 隱藏空狀態
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        if (splitView) {
            // 分割視窗模式
            if (!viewerContainer.querySelector('.split-container')) {
                createSplitView();
            }
            
            const leftPane = document.getElementById('split-left-content');
            if (leftPane && tab.content) {
                leftPane.innerHTML = '';
                leftPane.appendChild(tab.content.cloneNode(true));
            }
        } else {
            // 單一視窗模式
            viewerContainer.innerHTML = '';
            
            if (tab.content && !tab.loading) {
                console.log('顯示標籤內容');
                viewerContainer.appendChild(tab.content);
            } else if (tab.loading) {
                console.log('標籤還在載入中');
                if (tab.content) {
                    // 如果有載入中的內容，顯示它
                    viewerContainer.appendChild(tab.content);
                } else {
                    // 否則顯示載入狀態
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
    
    // 清理載入超時
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
            
            // 顯示空狀態
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
    
    // 手機版處理
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('show');
        backdrop.classList.toggle('show');
    } else {
        // 桌面版處理
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
        // 如果沒有搜尋詞，顯示所有項目
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
            
            // 展開父資料夾
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
    
    // 從伺服器載入已儲存的工作區
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
    if (activeTabId) {
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && !tab.loading) {
            // 清除舊內容
            tab.content = null;
            tab.loading = true;
            tab.loadStartTime = Date.now();
            renderTabs();
            
            // 顯示載入中狀態
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
            
            // 重新載入
            loadFileContentOptimized(tab.path, tab.id, tab.isLocal);
            showToast('已重新整理', 'success');
        }
    }
}

// 開啟搜尋對話框
function openSearchModal() {
    if (!activeTabId) {
        showToast('請先開啟檔案', 'info');
        return;
    }
    
    document.getElementById('search-modal').classList.add('show');
    document.getElementById('search-keyword').focus();
}

function closeSearchModal() {
    document.getElementById('search-modal').classList.remove('show');
}

// 執行搜尋
function performSearch() {
    const keyword = document.getElementById('search-keyword').value;
    if (!keyword) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }
    
    // 模擬搜尋功能 - 實際應該調用後端API
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p style="text-align: center; color: #999;">搜尋中...</p>';
    
    // 這裡應該實作真正的搜尋功能
    setTimeout(() => {
        resultsDiv.innerHTML = '<p style="text-align: center; color: #999;">搜尋功能開發中</p>';
    }, 500);
}

// 切換分割視窗
function toggleSplitView() {
    splitView = !splitView;
    const viewerContainer = document.getElementById('file-viewer');
    
    if (splitView) {
        createSplitView();
        showToast('已啟用分割視窗', 'success');
    } else {
        // 恢復單一視窗
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
            <div class="split-divider" onmousedown="initResize(event)"></div>
            <div class="split-pane" id="split-right">
                <div class="split-pane-toolbar">
                    <span class="split-pane-title" id="split-right-title">右側視窗</span>
                    <div class="split-pane-actions">
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
    });
    
    // 如果有活動標籤，載入到左側
    if (activeTabId) {
        const tab = currentTabs.find(t => t.id === activeTabId);
        if (tab && tab.content) {
            loadFileToPane(tab, 'left');
        }
    }
}

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
            // 重新載入檔案
            tab.content = null;
            tab.loading = true;
            tab.loadStartTime = Date.now();
            renderTabs();
            
            // 顯示載入狀態
            content.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>重新載入中...</p>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            `;
            
            // 重新載入
            loadFileContentForPane(tab.path, tab.id, tab.isLocal, pane);
            showToast(`已重新整理${pane === 'left' ? '左側' : '右側'}視窗`, 'success');
        }
    }
};

// 處理拖放到特定面板
function handleDropForPane(event, pane) {
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
        // 開啟第一個檔案到指定面板
        const file = files[0];
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        // 創建或更新標籤
        const existingTab = currentTabs.find(tab => tab.path === virtualFile.path);
        if (existingTab) {
            loadFileToPane(existingTab, pane);
        } else {
            // 創建新標籤但不切換
            openFile(virtualFile, false);
            // 載入到指定面板
            setTimeout(() => {
                const newTab = currentTabs.find(tab => tab.path === virtualFile.path);
                if (newTab) {
                    loadFileToPane(newTab, pane);
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
            // 需要載入
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
        
        // 更新標題
        if (title) {
            title.textContent = tab.name;
            title.title = tab.path;
        }
    }
}

// 初始化調整大小
window.initResize = function(e) {
    e.preventDefault();
    isDragging = true;
    
    const container = document.querySelector('.split-container');
    const leftPane = document.getElementById('split-left');
    const rightPane = document.getElementById('split-right');
    const divider = e.target;
    
    const startX = e.pageX;
    const startLeftWidth = leftPane.offsetWidth;
    const containerWidth = container.offsetWidth;
    
    function doDrag(e) {
        if (!isDragging) return;
        
        const deltaX = e.pageX - startX;
        const newLeftWidth = startLeftWidth + deltaX;
        const percentage = (newLeftWidth / containerWidth) * 100;
        
        // 限制最小和最大寬度
        if (percentage >= 20 && percentage <= 80) {
            leftPane.style.flex = `0 0 ${percentage}%`;
            rightPane.style.flex = '1';
        }
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
        divider.style.cursor = 'col-resize';
    }
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    divider.style.cursor = 'col-resize';
};

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
            color: tab.color
        })),
        activeTabPath: activeTabId ? currentTabs.find(t => t.id === activeTabId)?.path : null,
        splitView: splitView,
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
            
            // 更新 URL
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
        // 實作匯出功能
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
    
    // 設置拖放事件
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
    
    // 處理每個檔案
    uploadedFiles.forEach((file, index) => {
        const virtualFile = {
            name: file.name,
            path: URL.createObjectURL(file),
            type: 'file',
            isLocal: true
        };
        
        // 根據是否在分割視窗模式處理
        if (splitView && currentUploadPane) {
            // 在分割視窗模式下，載入到指定面板
            if (index === 0) {
                // 第一個檔案創建標籤並載入到面板
                openFile(virtualFile, false);
                setTimeout(() => {
                    const newTab = currentTabs.find(tab => tab.path === virtualFile.path);
                    if (newTab) {
                        loadFileToPane(newTab, currentUploadPane);
                    }
                }, 100);
            } else {
                // 其他檔案只創建標籤
                openFile(virtualFile, false);
            }
        } else {
            // 普通模式下，開啟檔案
            openFile(virtualFile, index === 0); // 只切換到第一個檔案
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
            // 直接開啟檔案
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
    // 移除重複的
    recentFiles = recentFiles.filter(f => f.path !== file.path);
    
    // 添加到開頭
    recentFiles.unshift({
        ...file,
        openedAt: new Date().toISOString()
    });
    
    // 限制數量
    if (recentFiles.length > 20) {
        recentFiles = recentFiles.slice(0, 20);
    }
    
    // 儲存到 localStorage（如果設定允許）
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
    
    // 自動移除
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
    
    if (diff < 60000) { // 小於1分鐘
        return '剛剛';
    } else if (diff < 3600000) { // 小於1小時
        return Math.floor(diff / 60000) + ' 分鐘前';
    } else if (diff < 86400000) { // 小於1天
        return Math.floor(diff / 3600000) + ' 小時前';
    } else if (diff < 604800000) { // 小於7天
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
    // 切換標籤
    document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // 切換內容
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    document.getElementById(`${tab}-settings`).style.display = 'block';
}

function saveSettings() {
    // 儲存設定到 localStorage
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
        
        // 應用設定
        applySettings(settings);
    } catch (e) {
        console.error('儲存設定失敗:', e);
        showToast('儲存設定失敗', 'error');
    }
}

// 應用設定
function applySettings(settings) {
    // 應用深色模式
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // 應用緊湊模式
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
            
            // 應用設定到UI
            document.getElementById('auto-save').checked = settings.autoSave || false;
            document.getElementById('remember-recent').checked = settings.rememberRecent !== false;
            document.getElementById('dark-mode').checked = settings.darkMode || false;
            document.getElementById('compact-mode').checked = settings.compactMode || false;
            document.getElementById('dev-mode').checked = settings.devMode || false;
            
            // 應用設定
            applySettings(settings);
        }
    } catch (e) {
        console.error('載入設定失敗:', e);
    }
}

// 在初始化時載入設定
loadSettings();

// 添加快捷鍵支援
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
        openSearchModal();
    }
    
    // F5: 重新整理
    if (e.key === 'F5') {
        e.preventDefault();
        refreshContent();
    }
});