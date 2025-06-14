// Enhanced Log 分析平台 v6 - 主應用程式
// static/js/app.js

$(document).ready(function() {
    console.log('🚀 Enhanced Log 分析平台 v6 載入完成');
    console.log('📌 版本:', appConfig.version);
    
    // 檢查是否需要顯示登入
    if (!utils.loadLocal('userName')) {
        showLoginModal();
    } else {
        appConfig.state.userName = utils.loadLocal('userName');
        initializeApp();
    }
});

// 顯示登入模態框
function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    loginModal.classList.add('show');
    
    // 聚焦到輸入框
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 300);
    
    // Enter 鍵提交
    document.getElementById('username').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
}

// 處理登入
function handleLogin() {
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        utils.showAlert('請輸入您的名稱', 'warning');
        return;
    }
    
    appConfig.state.userName = username;
    utils.saveLocal('userName', username);
    
    // 隱藏登入模態框
    const loginModal = document.getElementById('loginModal');
    loginModal.classList.remove('show');
    
    setTimeout(() => {
        loginModal.style.display = 'none';
        initializeApp();
    }, 300);
}

// 訪客登入
function handleGuestLogin() {
    const guestName = `Guest_${Math.floor(Math.random() * 1000)}`;
    appConfig.state.userName = guestName;
    utils.saveLocal('userName', guestName);
    
    const loginModal = document.getElementById('loginModal');
    loginModal.classList.remove('show');
    
    setTimeout(() => {
        loginModal.style.display = 'none';
        initializeApp();
    }, 300);
}

// 初始化應用
function initializeApp() {
    console.log('👤 用戶名稱:', appConfig.state.userName);
    
    // 初始化各個管理器
    initializeManagers();
    
    // 載入初始資料
    loadInitialData();
    
    // 設置全域事件監聽器
    setupGlobalEventListeners();
    
    console.log('✅ 初始化完成');
}

// 初始化各個管理器
function initializeManagers() {
    console.log('🔧 初始化管理器...');
    
    // 初始化順序很重要
    const managers = [
        { name: '佈局管理器', obj: layoutManager },
        { name: '區塊管理器', obj: blockManager },
        { name: '關鍵字管理器', obj: keywordManager },
        { name: '檔案瀏覽器', obj: fileBrowser },
        { name: '分析管理器', obj: analysisManager },
        { name: '結果管理器', obj: resultsManager },
        { name: '快速分析', obj: quickAnalysis },
        { name: '聊天管理器', obj: chatManager },
        { name: '轉盤管理器', obj: wheelManager },
        { name: '廣播管理器', obj: broadcastManager },
        { name: '聊天室管理器', obj: roomManager },
        { name: '分享管理器', obj: shareManager }
    ];
    
    managers.forEach(manager => {
        try {
            if (manager.obj && typeof manager.obj.init === 'function') {
                manager.obj.init();
                console.log(`✅ ${manager.name} 初始化成功`);
            } else {
                console.warn(`⚠️ ${manager.name} 沒有 init 方法`);
            }
        } catch (error) {
            console.error(`❌ ${manager.name} 初始化失敗:`, error);
        }
    });
}

// 載入初始資料
function loadInitialData() {
    console.log('📋 載入初始資料...');
    
    // 載入關鍵字
    keywordManager.loadKeywords();
    
    // 載入檔案列表
    fileBrowser.loadDirectory(appConfig.state.currentPath);
    
    // 初始化 Socket.IO
    chatManager.initSocketIO();
}

// 設置全域事件監聽器
function setupGlobalEventListeners() {
    console.log('🎛️ 設置全域事件監聽器...');
    
    // 視窗大小改變
    $(window).on('resize', utils.debounce(function() {
        // 更新圖表大小
        if (appConfig.state.moduleChart) {
            appConfig.state.moduleChart.resize();
        }
    }, 300));
    
    // 頁面離開警告
    $(window).on('beforeunload', function(e) {
        if (appConfig.state.currentAnalysisId && analysisManager.isAnalysisRunning()) {
            e.preventDefault();
            e.returnValue = '分析正在進行中，確定要離開嗎？';
            return e.returnValue;
        }
    });
    
    // 處理連接錯誤
    $(document).ajaxError(function(event, jqxhr, settings, thrownError) {
        if (jqxhr.status === 0) {
            console.error('網路連接錯誤');
        } else if (jqxhr.status === 404) {
            console.error('請求的資源不存在:', settings.url);
        } else if (jqxhr.status === 500) {
            console.error('伺服器錯誤');
            utils.showAlert('❌ 伺服器錯誤，請稍後再試', 'danger');
        }
    });
    
    // 處理拖放檔案到整個頁面
    $(document).on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    
    $(document).on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 通知權限請求
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ 通知權限已獲得');
                }
            });
        }, 3000);
    }
    
    // 初始化工具提示
    $('[data-bs-toggle="tooltip"]').tooltip();
    
    // 初始化彈出提示
    $('[data-bs-toggle="popover"]').popover();
}

// 全域函數 - 供 HTML 直接調用
window.scrollToTop = utils.scrollToTop;