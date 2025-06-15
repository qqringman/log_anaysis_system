// Enhanced File Viewer Mobile JavaScript

$(document).ready(function() {
    // 手機版特定功能
    if (isMobileDevice()) {
        setupMobileFeatures();
    }
});

// 檢測是否為手機設備
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 設置手機版功能
function setupMobileFeatures() {
    // 觸摸事件處理
    setupTouchEvents();
    
    // 優化滾動性能
    optimizeScrolling();
    
    // 手勢支援
    setupGestures();
    
    // 調整工具列
    adjustToolbar();
}

// 設置觸摸事件
function setupTouchEvents() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    // 滑動手勢
    $('#line-container').on('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    
    $('#line-container').on('touchend', function(e) {
        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;
        handleSwipe();
    });
    
    function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // 水平滑動
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 100) {
                // 向右滑動 - 顯示/隱藏搜尋結果
                if ($('.search-results-panel').hasClass('show')) {
                    hideSearchResultsPanel();
                }
            } else if (deltaX < -100) {
                // 向左滑動 - 顯示搜尋結果
                if (searchResults.length > 0 && !$('.search-results-panel').hasClass('show')) {
                    showSearchResultsPanel();
                }
            }
        }
    }
    
    // 長按行號顯示選單
    let pressTimer;
    $('.line-number').on('touchstart', function(e) {
        const lineNumber = $(this).parent().data('line');
        pressTimer = setTimeout(() => {
            e.preventDefault();
            showMobileContextMenu(e.touches[0], 'line', lineNumber);
        }, 500);
    });
    
    $('.line-number').on('touchend touchmove', function() {
        clearTimeout(pressTimer);
    });
    
    // 防止雙擊縮放
    let lastTouchEnd = 0;
    $(document).on('touchend', function(e) {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    });
}

// 顯示手機版右鍵選單
function showMobileContextMenu(touch, type, lineNumber) {
    const menu = $('#context-menu');
    
    // 震動反饋（如果支援）
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
    
    // 調整選單位置以適應手機螢幕
    const menuWidth = 220;
    const menuHeight = 300; // 預估高度
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    
    let left = touch.pageX - (menuWidth / 2);
    let top = touch.pageY - 20;
    
    // 確保選單在螢幕內
    left = Math.max(10, Math.min(left, windowWidth - menuWidth - 10));
    top = Math.max(10, Math.min(top, windowHeight - menuHeight - 10));
    
    menu.css({
        left: left + 'px',
        top: top + 'px'
    });
    
    // 使用桌面版的選單內容
    showContextMenu({ pageX: left, pageY: top, preventDefault: () => {} }, type, lineNumber);
}

// 優化滾動性能
function optimizeScrolling() {
    const container = $('#line-container');
    
    // 使用原生滾動
    container.css({
        '-webkit-overflow-scrolling': 'touch',
        'scroll-behavior': 'smooth'
    });
    
    // 減少滾動時的重繪
    let scrollTimer;
    container.on('scroll', function() {
        container.addClass('scrolling');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            container.removeClass('scrolling');
        }, 150);
    });
}

// 設置手勢
function setupGestures() {
    // 雙指縮放支援（用於調整字體大小）
    let initialDistance = 0;
    let currentFontSize = 12;
    
    $('#line-container').on('touchstart', function(e) {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
        }
    });
    
    $('#line-container').on('touchmove', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance;
            
            if (scale > 1.1) {
                // 放大
                currentFontSize = Math.min(20, currentFontSize + 1);
                updateFontSize(currentFontSize);
                initialDistance = currentDistance;
            } else if (scale < 0.9) {
                // 縮小
                currentFontSize = Math.max(10, currentFontSize - 1);
                updateFontSize(currentFontSize);
                initialDistance = currentDistance;
            }
        }
    });
    
    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    function updateFontSize(size) {
        $('.line-content').css('font-size', size + 'px');
        showToast('info', `字體大小: ${size}px`);
    }
}

// 調整工具列
function adjustToolbar() {
    // 簡化按鈕文字
    if ($(window).width() < 400) {
        $('.btn-modern').each(function() {
            const $btn = $(this);
            const icon = $btn.find('i').prop('outerHTML');
            const text = $btn.text().trim();
            
            // 縮短按鈕文字
            const shortTexts = {
                '目標行': '目標',
                '選擇範圍': '範圍',
                '清除高亮': '清除',
                '跳轉模式': '跳轉'
            };
            
            if (shortTexts[text]) {
                $btn.html(icon + shortTexts[text]);
            }
        });
    }
    
    // 調整搜尋框占位符
    $('#search-input').attr('placeholder', '搜尋...');
}

// 手機版快速操作浮動按鈕
function createFloatingActionButton() {
    const fab = $(`
        <div class="floating-action-button">
            <button class="fab-main">
                <i class="fas fa-plus"></i>
            </button>
            <div class="fab-menu">
                <button class="fab-item" onclick="scrollToTarget()">
                    <i class="fas fa-crosshairs"></i>
                </button>
                <button class="fab-item" onclick="showRangeSelector()">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="fab-item" onclick="$('#search-input').focus()">
                    <i class="fas fa-search"></i>
                </button>
                <button class="fab-item" onclick="jumpToLine()">
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `);
    
    $('body').append(fab);
    
    // 綁定事件
    $('.fab-main').click(function() {
        $(this).parent().toggleClass('open');
    });
}

// CSS 樣式（如果需要內聯）
const mobileStyles = `
<style>
.scrolling .code-line {
    will-change: transform;
}

.floating-action-button {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 1000;
}

.fab-main {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary-gradient);
    border: none;
    color: white;
    font-size: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: all 0.3s ease;
}

.fab-menu {
    position: absolute;
    bottom: 70px;
    right: 0;
    display: none;
}

.floating-action-button.open .fab-menu {
    display: block;
}

.floating-action-button.open .fab-main {
    transform: rotate(45deg);
}

.fab-item {
    display: block;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: white;
    border: 1px solid #e9ecef;
    color: #667eea;
    margin-bottom: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    cursor: pointer;
    transition: all 0.3s ease;
}

.fab-item:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
</style>
`;

// 初始化浮動按鈕（可選）
if (isMobileDevice()) {
    // createFloatingActionButton();
}