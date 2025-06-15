// Enhanced File Viewer JavaScript v6

// 全域變數
let bookmarks = new Set();
let jumpPoints = new Set();
let currentJumpIndex = 0;
let searchResults = [];
let currentSearchIndex = 0;
let highlightColors = {};
let colorIndex = 1;
let selectedText = '';
let isLoadingMore = false;
let jumpModeEnabled = false;
let lastSearchText = '';
let useRegex = false;
let currentStartLine = 1;
let currentEndLine = 1;
let totalLines = 1;
let currentFilePath = '';
let currentTargetLine = 1;
let forwardHistory = [];
let activeHighlightColors = new Set();
let currentHoverLine = null;
let navigationHistory = [];

// 頁面初始化
$(document).ready(function() {
    // 從 DOM 獲取初始值
    currentStartLine = parseInt($('#initial-start-line').val());
    currentEndLine = parseInt($('#initial-end-line').val());
    totalLines = parseInt($('#initial-total-lines').val());
    currentFilePath = $('#initial-file-path').val();
    currentTargetLine = parseInt($('#initial-target-line').val());
    
    setupKeyboardShortcuts();
    setupScrollHandler();
    setupMouseTracking();
    scrollToTarget();
    updateStatus();
    initializeTooltips();
    setupExportDropdown();
    setupNavigationHistory();
    setupDeviceSwitcher();
    checkForwardHistory();
});

function initializeTooltips() {
    // 為工具列按鈕添加工具提示
    $('[title]').each(function() {
        $(this).attr('data-bs-toggle', 'tooltip');
    });
    
    // 初始化 Bootstrap 工具提示
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// 檢查前進歷史
function checkForwardHistory() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromLine = urlParams.get('from');
    
    if (fromLine) {
        // 儲存當前頁面到導航歷史
        const currentUrl = window.location.href;
        navigationHistory.push(currentUrl);
        
        // 顯示前進按鈕
        showForwardButton();
    } else {
        // 檢查 sessionStorage 中的歷史
        const savedHistory = sessionStorage.getItem('navigationHistory');
        if (savedHistory) {
            navigationHistory = JSON.parse(savedHistory);
            if (navigationHistory.length > 0) {
            showForwardButton();
        }
    }
}
}

// 顯示前進按鈕
function showForwardButton() {
    const forwardBtn = $('#forward-btn');
    if (forwardBtn.length === 0) {
        const btn = $('<button class="btn btn-forward" onclick="goForward()" title="前進到下一頁"><i class="fas fa-arrow-right me-1"></i>前進</button>');
        $('.btn-back').after(btn);
    }
}

// 前進功能
function goForward() {
    if (navigationHistory.length > 0) {
        const nextUrl = navigationHistory.shift();
        sessionStorage.setItem('navigationHistory', JSON.stringify(navigationHistory));
        window.location.href = nextUrl;
    }
}

// 設置匯出下拉選單
function setupExportDropdown() {
    // 點擊匯出按鈕顯示/隱藏下拉選單
    $('.btn-export').click(function(e) {
        e.stopPropagation();
        $('.export-dropdown').toggleClass('show');
    });
    
    // 點擊其他地方關閉下拉選單
    $(document).click(function() {
        $('.export-dropdown').removeClass('show');
    });
    
    // 防止下拉選單點擊事件冒泡
    $('.export-dropdown').click(function(e) {
        e.stopPropagation();
    });
}

// 鍵盤快捷鍵
function setupKeyboardShortcuts() {
    $(document).keydown(function(e) {
        // Ctrl+F 搜尋
        if (e.ctrlKey && e.which === 70) {
            e.preventDefault();
            $('#search-input').focus().select();
        }
        
        // F2 跳轉功能
        if (e.which === 113) { // F2
            e.preventDefault();
            if (e.shiftKey) {
                gotoPreviousJump();
            } else {
                gotoNextJump();
            }
        }
        
        // F3 書籤跳轉
        if (e.which === 114) { // F3
            e.preventDefault();
            if (e.shiftKey) {
                gotoPreviousBookmark();
            } else {
                gotoNextBookmark();
            }
        }
        
        // ESC 清除搜尋或關閉選單
        if (e.which === 27) {
            if ($('#search-input').is(':focus')) {
                clearSearch();
            }
            hideContextMenu();
            if (jumpModeEnabled) {
                toggleJumpMode();
            }
        }
        
        // Ctrl+G 跳轉行號
        if (e.ctrlKey && e.which === 71) {
            e.preventDefault();
            $('#jump-line').focus().select();
        }
        
        // Enter 在搜尋框中
        if (e.which === 13 && $('#search-input').is(':focus')) {
            e.preventDefault();
            if (e.shiftKey) {
                findPrevious();
            } else {
                findNext();
            }
        }
        
        // Enter 在跳轉行號輸入框中
        if (e.which === 13 && $('#jump-line').is(':focus')) {
            e.preventDefault();
            jumpToLine();
        }
    });
    
    // 搜尋輸入框事件
    $('#search-input').on('input', debounce(performSearch, 300));
}

// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 滾動處理 - 自動載入更多內容
function setupScrollHandler() {
    const container = $('#line-container');
    container.on('scroll', debounce(function() {
        if (isLoadingMore) return;
        
        const scrollTop = container.scrollTop();
        const scrollHeight = container[0].scrollHeight;
        const clientHeight = container.height();
        
        // 接近頂部時載入前面的內容
        if (scrollTop < 200 && currentStartLine > 1) {
            loadMoreContent('before');
        }
        
        // 接近底部時載入後面的內容
        if (scrollTop + clientHeight > scrollHeight - 200 && currentEndLine < totalLines) {
            loadMoreContent('after');
        }
        
        // 更新當前行狀態
        updateCurrentLineStatus();
    }, 100));
}

// 載入更多內容
function loadMoreContent(direction) {
    if (isLoadingMore) return;
    isLoadingMore = true;
    
    const loadingOverlay = direction === 'before' ? $('#loading-overlay-top') : $('#loading-overlay-bottom');
    loadingOverlay.show();
    
    // 添加載入文字
    if (!loadingOverlay.find('.loading-text').length) {
        loadingOverlay.append('<div class="loading-text">載入中...</div>');
    }
    
    let newStart, newEnd;
    
    if (direction === 'before') {
        newStart = Math.max(1, currentStartLine - 200);
        newEnd = currentStartLine - 1;
    } else {
        newStart = currentEndLine + 1;
        newEnd = Math.min(totalLines, currentEndLine + 200);
    }
    
    $.get('/file_viewer', {
        path: currentFilePath,
        line: direction === 'before' ? newStart : newEnd,
        context: 100,
        start: newStart,
        end: newEnd
    }).done(function(data) {
        // 解析返回的HTML並提取新行
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        const newLines = doc.querySelectorAll('.code-line');
        
        const container = $('#line-container');
        const scrollBefore = container[0].scrollHeight;
        const scrollTop = container.scrollTop();
        
        if (direction === 'before') {
            // 在前面插入
            const firstLine = container.find('.code-line').first();
            newLines.forEach(line => {
                const newElement = $(line.outerHTML);
                firstLine.before(newElement);
                
                // 重新綁定事件
                bindLineEvents(newElement);
            });
            
            // 保持滾動位置
            const scrollAfter = container[0].scrollHeight;
            container.scrollTop(scrollTop + (scrollAfter - scrollBefore));
            
            currentStartLine = newStart;
        } else {
            // 在後面添加
            newLines.forEach(line => {
                const newElement = $(line.outerHTML);
                container.append(newElement);
                
                // 重新綁定事件
                bindLineEvents(newElement);
            });
            
            currentEndLine = newEnd;
        }
        
        updateStatus();
        
        // 重新應用搜尋高亮
        if (lastSearchText) {
            performSearch();
        }
        
        // 重新應用顏色高亮
        reapplyHighlights();
        
    }).fail(function() {
        showToast('danger', '載入內容失敗，請稍後再試');
    }).always(function() {
        loadingOverlay.fadeOut(300);
        isLoadingMore = false;
    });
}

// 綁定行事件
function bindLineEvents(lineElement) {
    const lineNumber = lineElement.data('line');
    
    lineElement.find('.line-number')
        .on('click', function() {
            handleLineClick(lineNumber);
        })
        .on('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLineDoubleClick(lineNumber);
        })
        .on('contextmenu', function(e) {
            showLineContextMenu(e, lineNumber);
        });
    
    lineElement.find('.line-content').on('contextmenu', function(e) {
        showContentContextMenu(e, lineNumber);
    });
}

// 處理行點擊
function handleLineClick(lineNumber) {
    if (jumpModeEnabled) {
        toggleJumpPoint(lineNumber);
    } else {
        toggleBookmark(lineNumber);
    }
}

// 處理行雙擊
function handleLineDoubleClick(lineNumber) {
    showToast('info', `正在載入第 ${lineNumber} 行的上下文...`);
    
    const url = new URL(window.location);
    url.searchParams.set('line', lineNumber);
    url.searchParams.set('start', Math.max(1, lineNumber - 200));
    url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
    url.searchParams.set('context', 200);
    url.searchParams.set('from', currentTargetLine); // 記錄來源行號
    window.location.href = url.toString();
}

// 跳轉模式切換
function toggleJumpMode() {
    jumpModeEnabled = !jumpModeEnabled;
    const btn = $('#jump-mode-btn');
    const navigation = $('#jump-navigation');
    
    if (jumpModeEnabled) {
        btn.removeClass('btn-outline-secondary').addClass('btn-gradient-warning');
        btn.html('<i class="fas fa-crosshairs me-1"></i>退出跳轉');
        navigation.show();
        
        // 1秒後自動隱藏提示
        setTimeout(() => {
            navigation.addClass('animate__animated');
            navigation.css('animation', 'slideOutDown 0.3s ease-out');
            setTimeout(() => {
                navigation.hide();
                navigation.css('animation', '');
            }, 300);
        }, 1000);
        
        showToast('info', '跳轉模式已啟用');
    } else {
        btn.removeClass('btn-gradient-warning').addClass('btn-outline-secondary');
        btn.html('<i class="fas fa-crosshairs me-1"></i>跳轉模式');
        navigation.hide();
        showToast('info', '跳轉模式已關閉');
    }
}

// 切換跳轉點
function toggleJumpPoint(lineNumber) {
    const lineElement = $(`#line-${lineNumber} .line-number`);
    
    if (jumpPoints.has(lineNumber)) {
        jumpPoints.delete(lineNumber);
        lineElement.removeClass('jump-point');
    } else {
        jumpPoints.add(lineNumber);
        lineElement.addClass('jump-point');
    }
    
    updateJumpStatus();
}

// 下一個跳轉點
function gotoNextJump() {
    if (jumpPoints.size === 0) {
        showToast('warning', '沒有設定跳轉點，請先設定跳轉點');
        return;
    }
    
    const sortedJumps = Array.from(jumpPoints).sort((a, b) => a - b);
    const currentLine = getCurrentLine();
    
    let nextJump = sortedJumps.find(line => line > currentLine);
    if (!nextJump) {
        nextJump = sortedJumps[0]; // 循環到第一個
    }
    
    scrollToLine(nextJump);
    updateJumpStatus();
    showToast('success', `跳轉到第 ${nextJump} 行`);
}

// 上一個跳轉點
function gotoPreviousJump() {
    if (jumpPoints.size === 0) {
        showToast('warning', '沒有設定跳轉點，請先設定跳轉點');
        return;
    }
    
    const sortedJumps = Array.from(jumpPoints).sort((a, b) => b - a);
    const currentLine = getCurrentLine();
    
    let prevJump = sortedJumps.find(line => line < currentLine);
    if (!prevJump) {
        prevJump = sortedJumps[0]; // 循環到最後一個
    }
    
    scrollToLine(prevJump);
    updateJumpStatus();
    showToast('success', `跳轉到第 ${prevJump} 行`);
}

// 切換正規表達式
function toggleRegex() {
    useRegex = !useRegex;
    const btn = $('#regex-toggle');
    
    if (useRegex) {
        btn.addClass('active');
        showToast('info', '已啟用正規表達式搜尋');
    } else {
        btn.removeClass('active');
        showToast('info', '已關閉正規表達式搜尋');
    }
    
    // 重新執行搜尋
    if ($('#search-input').val()) {
        performSearch();
    }
}

// 搜尋功能
function performSearch() {
    const searchText = $('#search-input').val().trim();
    lastSearchText = searchText;
    clearSearchHighlights();
    
    if (!searchText) {
        updateSearchStatus('搜尋: 無');
        return;
    }
    
    searchResults = [];
    let regex;
    
    try {
        if (useRegex) {
            regex = new RegExp(searchText, 'gi');
        } else {
            // 轉義特殊字符
            const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escapedText, 'gi');
        }
    } catch (e) {
        showToast('danger', '無效的正規表達式');
        return;
    }
    
    $('.line-content').each(function(index) {
        const content = $(this).text();
        const lineNumber = parseInt($(this).parent().data('line'));
        let newContent = content;
        let hasMatch = false;
        
        // 替換匹配的文字
        newContent = content.replace(regex, function(match) {
            hasMatch = true;
            searchResults.push({
                line: lineNumber,
                element: this,
                text: match
            });
            return '<span class="search-highlight">' + match + '</span>';
        });
        
        if (hasMatch) {
            $(this).html(newContent);
        }
    });
    
    currentSearchIndex = 0;
    updateSearchStatus(`找到 ${searchResults.length} 個結果`);
    $('#search-info').text(`${searchResults.length > 0 ? currentSearchIndex + 1 : 0} / ${searchResults.length}`);
    
    if (searchResults.length > 0) {
        highlightCurrentResult();
    }
}

function clearSearchHighlights() {
    $('.search-highlight').each(function() {
        const parent = $(this).parent();
        const text = parent.text();
        parent.text(text);
    });
}

function highlightCurrentResult() {
    $('.search-highlight').removeClass('current');
    if (searchResults.length > 0 && currentSearchIndex < searchResults.length) {
        const result = searchResults[currentSearchIndex];
        
        // 找到對應的高亮元素
        const lineElement = $(`#line-${result.line}`);
        const highlights = lineElement.find('.search-highlight');
        
        if (highlights.length > 0) {
            highlights.eq(0).addClass('current');
            scrollToElement(lineElement);
        }
        
        updateSearchStatus(`${currentSearchIndex + 1} / ${searchResults.length}`);
        $('#search-info').text(`${currentSearchIndex + 1} / ${searchResults.length}`);
    }
}

function findNext() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    highlightCurrentResult();
}

function findPrevious() {
    if (searchResults.length === 0) return;
    currentSearchIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    highlightCurrentResult();
}

function clearSearch() {
    $('#search-input').val('');
    clearSearchHighlights();
    searchResults = [];
    currentSearchIndex = 0;
    lastSearchText = '';
    updateSearchStatus('搜尋: 無');
    $('#search-info').text('0 / 0');
}

// 書籤功能
function toggleBookmark(lineNumber) {
    const lineElement = $(`#line-${lineNumber} .line-number`);
    
    if (bookmarks.has(lineNumber)) {
        bookmarks.delete(lineNumber);
        lineElement.removeClass('bookmark');
        showToast('info', `已移除第 ${lineNumber} 行的書籤`);
    } else {
        bookmarks.add(lineNumber);
        lineElement.addClass('bookmark');
        showToast('success', `已設定第 ${lineNumber} 行為書籤`);
    }
    
    updateBookmarkStatus();
}

function gotoNextBookmark() {
    if (bookmarks.size === 0) {
        showToast('warning', '沒有設定書籤');
        return;
    }
    
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => a - b);
    const currentLine = getCurrentLine();
    
    let nextBookmark = sortedBookmarks.find(line => line > currentLine);
    if (!nextBookmark) {
        nextBookmark = sortedBookmarks[0]; // 循環到第一個
    }
    
    scrollToLine(nextBookmark);
    updateStatus();
    showToast('success', `跳轉到書籤：第 ${nextBookmark} 行`);
}

function gotoPreviousBookmark() {
    if (bookmarks.size === 0) {
        showToast('warning', '沒有設定書籤');
        return;
    }
    
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => b - a);
    const currentLine = getCurrentLine();
    
    let prevBookmark = sortedBookmarks.find(line => line < currentLine);
    if (!prevBookmark) {
        prevBookmark = sortedBookmarks[0]; // 循環到最後一個
    }
    
    scrollToLine(prevBookmark);
    updateStatus();
    showToast('success', `跳轉到書籤：第 ${prevBookmark} 行`);
}

// 右鍵選單
function showLineContextMenu(event, lineNumber) {
    event.preventDefault();
    selectedText = '';
    showContextMenu(event, 'line', lineNumber);
}

function showContentContextMenu(event, lineNumber) {
    event.preventDefault();
    selectedText = window.getSelection().toString().trim();
    showContextMenu(event, 'content', lineNumber);
}

function showContextMenu(event, type, lineNumber = null) {
    const menu = $('#context-menu');
    let menuItems = [];
    
    if (type === 'line') {
        const isBookmarked = bookmarks.has(lineNumber);
        const isJumpPoint = jumpPoints.has(lineNumber);
        
        menuItems = [
            { icon: 'bookmark', text: isBookmarked ? '移除書籤' : '設定書籤', action: () => toggleBookmark(lineNumber) },
            { icon: 'crosshairs', text: isJumpPoint ? '移除跳轉點' : '設定跳轉點', action: () => toggleJumpPoint(lineNumber) },
            { separator: true },
            { icon: 'copy', text: '複製行號', action: () => copyToClipboard(lineNumber.toString()) },
            { icon: 'link', text: '複製連結', action: () => copyLineLink(lineNumber) },
            { icon: 'external-link-alt', text: '在新頁面打開', action: () => openInNewPage(lineNumber) }
        ];
    } else {
        menuItems = [
            { icon: 'copy', text: '複製', action: () => copySelectedText(), disabled: !selectedText },
            { separator: true },
            { icon: 'highlighter', text: '智能高亮', action: () => highlightSelected(), disabled: !selectedText },
            { separator: true }
        ];
        
        // 添加顏色選項
        const colors = [
            { name: '粉紅', value: 1 },
            { name: '綠色', value: 2 },
            { name: '藍色', value: 3 },
            { name: '橙色', value: 4 },
            { name: '紫色', value: 5 },
            { name: '黃色', value: 6 },
            { name: '青色', value: 7 },
            { name: '檸檬', value: 8 },
            { name: '草綠', value: 9 },
            { name: '紅橙', value: 10 }
        ];
        
        colors.forEach(color => {
            menuItems.push({
                icon: 'circle',
                text: `${color.name}高亮`,
                color: color.value,
                action: () => highlightWithColor(selectedText, color.value),
                disabled: !selectedText
            });
        });
        
        menuItems.push({ separator: true });
        menuItems.push({ icon: 'eraser', text: '清除所有高亮', action: clearAllHighlights });
    }
    
    // 生成選單HTML
    let menuHtml = '';
    menuItems.forEach(item => {
        if (item.separator) {
            menuHtml += '<div class="context-menu-separator"></div>';
        } else {
            const disabledClass = item.disabled ? 'disabled' : '';
            const colorPreview = item.color ? 
                `<div class="color-preview highlight-color-${item.color}"></div>` : 
                `<i class="fas fa-${item.icon}"></i>`;
            
            menuHtml += `
                <div class="context-menu-item ${disabledClass}" data-index="${menuItems.indexOf(item)}">
                    ${colorPreview}
                    <span>${item.text}</span>
                </div>
            `;
        }
    });
    
    menu.html(menuHtml);
    
    // 綁定點擊事件
    menu.find('.context-menu-item').on('click', function() {
        if ($(this).hasClass('disabled')) return;
        
        const index = $(this).data('index');
        const item = menuItems[index];
        if (item && item.action) {
            item.action();
        }
        hideContextMenu();
    });
    
    // 計算位置
    const menuWidth = 220;
    const menuHeight = menuItems.length * 40;
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    
    let left = event.pageX;
    let top = event.pageY;
    
    if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10;
    }
    
    if (top + menuHeight > windowHeight) {
        top = windowHeight - menuHeight - 10;
    }
    
    menu.css({
        display: 'block',
        left: left + 'px',
        top: top + 'px'
    });
    
    // 點擊其他地方關閉選單
    $(document).one('click', hideContextMenu);
}

function hideContextMenu() {
    $('#context-menu').hide();
}

// 高亮功能
function highlightSelected() {
    if (!selectedText) return;
    highlightWithColor(selectedText, colorIndex);
    colorIndex = (colorIndex % 10) + 1;
}

function highlightWithColor(text, color) {
    if (!text) return;
    
    // 儲存高亮資訊
    if (!highlightColors[text]) {
        highlightColors[text] = [];
    }
    highlightColors[text].push(color);
    
    // 添加到活躍顏色集合
    activeHighlightColors.add(color);
    updateHighlightJumper();
    
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedText})`, 'gi');
    
    $('.line-content').each(function() {
        const $this = $(this);
        let html = $this.html();
        
        // 暫時移除現有的高亮標籤
        const tempMarkers = [];
        html = html.replace(/<span class="[^"]*"[^>]*>(.*?)<\/span>/gi, function(match, content, offset) {
            const marker = `__MARKER_${tempMarkers.length}__`;
            tempMarkers.push({ marker, content, match });
            return marker + content + marker;
        });
        
        // 應用新的高亮
        html = html.replace(regex, function(match) {
            // 檢查是否已經在標記中
            for (let temp of tempMarkers) {
                if (html.indexOf(temp.marker + match + temp.marker) !== -1) {
                    return match;
                }
            }
            return `<span class="highlight-color-${color}">${match}</span>`;
        });
        
        // 還原其他高亮標籤
        tempMarkers.forEach(temp => {
            const markerRegex = new RegExp(temp.marker + '(.*?)' + temp.marker, 'g');
            html = html.replace(markerRegex, temp.match);
        });
        
        $this.html(html);
    });
    
    showToast('success', `已用顏色 ${color} 高亮文字: ${text}`);
}

// 更新高亮跳轉區
function updateHighlightJumper() {
    const jumper = $('.highlight-jumper');
    
    if (activeHighlightColors.size > 0) {
        // 清空現有按鈕
        jumper.find('.highlight-color-btn').remove();
        
        // 為每個活躍顏色創建按鈕
        const sortedColors = Array.from(activeHighlightColors).sort((a, b) => a - b);
        sortedColors.forEach(color => {
            const btn = $(`<button class="highlight-color-btn color-${color}" 
                           data-color="${color}" 
                           onclick="jumpToHighlight(${color})" 
                           title="跳轉到顏色 ${color} 的高亮"></button>`);
            jumper.append(btn);
        });
        
        jumper.addClass('show');
    } else {
        jumper.removeClass('show');
    }
}

// 跳轉到指定顏色的高亮
window.jumpToHighlight = function(color) {
    const highlights = $(`.highlight-color-${color}`);
    
    if (highlights.length === 0) {
        showToast('warning', `沒有找到顏色 ${color} 的高亮`);
        return;
    }
    
    // 找到當前位置後的下一個高亮
    const currentLine = getCurrentLine();
    let targetElement = null;
    let minDistance = Infinity;
    
    highlights.each(function() {
        const lineNumber = parseInt($(this).closest('.code-line').data('line'));
        if (lineNumber > currentLine && lineNumber - currentLine < minDistance) {
            minDistance = lineNumber - currentLine;
            targetElement = $(this);
        }
    });
    
    // 如果沒有找到後面的，則跳轉到第一個
    if (!targetElement) {
        targetElement = highlights.first();
    }
    
    if (targetElement) {
        const lineElement = targetElement.closest('.code-line');
        scrollToElement(lineElement);
        
        // 高亮閃爍效果
        targetElement.addClass('animate__animated animate__flash');
        setTimeout(() => {
            targetElement.removeClass('animate__animated animate__flash');
        }, 1000);
        
        // 更新活躍按鈕
        $('.highlight-color-btn').removeClass('active');
        $(`.highlight-color-btn[data-color="${color}"]`).addClass('active');
        
        showToast('success', `跳轉到顏色 ${color} 的高亮`);
    }
};

function clearAllHighlights() {
    for (let i = 1; i <= 10; i++) {
        $(`.highlight-color-${i}`).each(function() {
            const $this = $(this);
            const text = $this.text();
            $this.replaceWith(text);
        });
    }
    highlightColors = {};
    activeHighlightColors.clear();
    updateHighlightJumper();
    showToast('info', '已清除所有高亮');
}

function reapplyHighlights() {
    // 重新應用所有高亮
    Object.entries(highlightColors).forEach(([text, colors]) => {
        colors.forEach(color => {
            highlightWithColor(text, color);
        });
    });
}

// 工具函數
function scrollToTarget() {
    scrollToLine(currentTargetLine);
}

function scrollToLine(lineNumber) {
    const lineElement = $(`#line-${lineNumber}`);
    if (lineElement.length > 0) {
        scrollToElement(lineElement);
    } else {
        // 如果行不在當前顯示範圍，需要跳轉
        if (lineNumber < currentStartLine || lineNumber > currentEndLine) {
            jumpToLine(lineNumber);
        }
    }
}

function scrollToElement(element) {
    const container = $('#line-container');
    const elementTop = element.position().top;
    const containerHeight = container.height();
    const scrollTo = container.scrollTop() + elementTop - (containerHeight / 2);
    
    container.animate({ scrollTop: scrollTo }, 300);
    
    // 添加高亮效果
    element.addClass('animate__animated animate__pulse');
    setTimeout(() => {
        element.removeClass('animate__animated animate__pulse');
    }, 1000);
}

function getCurrentLine() {
    const container = $('#line-container');
    const scrollTop = container.scrollTop();
    const containerHeight = container.height();
    const centerY = scrollTop + (containerHeight / 2);
    
    let closestLine = currentTargetLine;
    let minDistance = Infinity;
    
    $('.code-line').each(function() {
        const elementTop = $(this).position().top + scrollTop;
        const distance = Math.abs(elementTop - centerY);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestLine = parseInt($(this).data('line'));
        }
    });
    
    return closestLine;
}

function updateCurrentLineStatus() {
    const currentLine = getCurrentLine();
    $('#status-line').text(`第 ${currentLine} 行`);
}

function jumpToLine(lineNumber) {
    lineNumber = lineNumber || parseInt($('#jump-line').val());
    
    if (lineNumber && lineNumber >= 1 && lineNumber <= totalLines) {
        const url = new URL(window.location);
        url.searchParams.set('line', lineNumber);
        url.searchParams.set('start', Math.max(1, lineNumber - 200));
        url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
        url.searchParams.set('from', currentTargetLine);
        window.location.href = url.toString();
    } else {
        showToast('warning', `請輸入有效的行號 (1-${totalLines})`);
    }
}

// 範圍選擇
function showRangeSelector() {
    $('#range-selector').slideDown(300);
    $('#range-start').focus();
}

function closeRangeSelector() {
    $('#range-selector').slideUp(300);
}

function applyRange() {
    const start = parseInt($('#range-start').val());
    const end = parseInt($('#range-end').val());
    const context = parseInt($('#range-context').val()) || 200;
    
    if (start && end && start <= end && start >= 1 && end <= totalLines) {
        const url = new URL(window.location);
        url.searchParams.set('line', Math.floor((start + end) / 2));
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        url.searchParams.set('context', context);
        window.location.href = url.toString();
    } else {
        showToast('warning', '請輸入有效的範圍');
    }
}

// 匯出功能
function exportFile(type) {
    if (type === 'all') {
        exportAllFile();
    } else {
        exportPartialFile();
    }
    
    // 關閉下拉選單
    $('.export-dropdown').removeClass('show');
}

function exportAllFile() {
    showToast('info', '正在準備下載完整檔案...');
    
    const downloadUrl = `/api/export_file?path=${encodeURIComponent(currentFilePath)}`;
    
    // 創建一個隱藏的 iframe 來下載檔案
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    
    // 5秒後移除 iframe
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 5000);
    
    showToast('success', '檔案下載已開始');
}

function exportPartialFile() {
    showToast('info', '正在準備匯出當前顯示的內容...');
    
    // 收集當前顯示的所有行
    const lines = [];
    $('.code-line').each(function() {
        const lineNumber = $(this).data('line');
        const content = $(this).find('.line-content').text();
        lines.push(`${lineNumber}: ${content}`);
    });
    
    // 創建 Blob 並下載
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFilePath.split('/').pop()}_lines_${currentStartLine}-${currentEndLine}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('success', `已匯出第 ${currentStartLine} 到 ${currentEndLine} 行`);
}

// 匯出 HTML
function exportHTML() {
    showToast('info', '正在準備匯出 HTML...');
    
    // 創建 HTML 內容
    let htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentFilePath.split('/').pop()} - 檔案檢視器匯出</title>
    <style>
        body { font-family: monospace; background: #f5f5f5; margin: 20px; }
        .header { background: #667eea; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .line { display: flex; border-bottom: 1px solid #eee; }
        .line-number { background: #f0f0f0; padding: 5px 10px; min-width: 80px; text-align: right; color: #666; }
        .line-content { flex: 1; padding: 5px 10px; background: white; white-space: pre-wrap; }
        .line-target { background: #ffebee; }
        .line-target .line-number { background: #ef5350; color: white; }
        .highlight-color-1 { background: #ffcdd2; }
        .highlight-color-2 { background: #c8e6c9; }
        .highlight-color-3 { background: #bbdefb; }
        .highlight-color-4 { background: #ffe0b2; }
        .highlight-color-5 { background: #e1bee7; }
        .highlight-color-6 { background: #fff9c4; }
        .highlight-color-7 { background: #b2ebf2; }
        .highlight-color-8 { background: #f0f4c3; }
        .highlight-color-9 { background: #dcedc8; }
        .highlight-color-10 { background: #ffccbc; }
        .bookmark { background: #4caf50; color: white; font-weight: bold; }
        .jump-point { background: #ff9800; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${currentFilePath.split('/').pop()}</h1>
        <p>匯出時間：${new Date().toLocaleString('zh-TW')}</p>
        <p>顯示範圍：第 ${currentStartLine} 到 ${currentEndLine} 行（共 ${totalLines} 行）</p>
    </div>
    <div class="content">
`;
    
    // 添加每一行的內容
    $('.code-line').each(function() {
        const lineNumber = $(this).data('line');
        const isTarget = $(this).hasClass('line-target');
        const lineNumberElement = $(this).find('.line-number');
        const isBookmark = lineNumberElement.hasClass('bookmark');
        const isJumpPoint = lineNumberElement.hasClass('jump-point');
        
        let lineNumberClass = '';
        if (isBookmark) lineNumberClass += ' bookmark';
        if (isJumpPoint) lineNumberClass += ' jump-point';
        
        const lineContent = $(this).find('.line-content').html();
        
        htmlContent += `
        <div class="line ${isTarget ? 'line-target' : ''}">
            <div class="line-number${lineNumberClass}">${lineNumber}</div>
            <div class="line-content">${lineContent}</div>
        </div>
`;
    });
    
    htmlContent += `
    </div>
</body>
</html>`;
    
    // 創建 Blob 並下載
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFilePath.split('/').pop()}_viewer_export.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('success', 'HTML 檔案已匯出');
}

// 複製功能 - 修復版本
function copySelectedText() {
    if (selectedText) {
        copyToClipboard(selectedText);
    }
}

function copyToClipboard(text) {
    // 使用現代 API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('success', `已複製到剪貼簿: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        }).catch(err => {
            // 如果失敗，使用傳統方法
            fallbackCopyToClipboard(text);
        });
    } else {
        // 使用傳統方法
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('success', `已複製到剪貼簿: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        } else {
            showToast('error', '複製失敗，請手動複製');
        }
    } catch (err) {
        showToast('error', '複製失敗，請手動複製');
    }
    
    document.body.removeChild(textArea);
}

function copyLineLink(lineNumber) {
    const url = new URL(window.location);
    url.searchParams.set('line', lineNumber);
    copyToClipboard(url.toString());
}

function openInNewPage(lineNumber) {
    const url = new URL(window.location);
    url.searchParams.set('line', lineNumber);
    window.open(url.toString(), '_blank');
}

// 狀態更新
function updateStatus() {
    updateCurrentLineStatus();
    updateBookmarkStatus();
    updateJumpStatus();
    $('#status-position').text(`${currentStartLine}-${currentEndLine} / ${totalLines}`);
}

function updateBookmarkStatus() {
    $('#status-bookmarks').text(`書籤: ${bookmarks.size}`);
}

function updateJumpStatus() {
    $('#status-jumps').text(`跳轉點: ${jumpPoints.size}`);
}

function updateSearchStatus(text) {
    $('#status-search').text(text);
}

// Toast 提示系統
function showToast(type, message) {
    const toastId = 'toast-' + Date.now();
    const iconMap = {
        'success': 'fa-check',
        'info': 'fa-info',
        'warning': 'fa-exclamation-triangle',
        'danger': 'fa-times',
        'error': 'fa-times'
    };
    
    const toast = $(`
        <div id="${toastId}" class="custom-toast ${type}">
            <div class="toast-icon">
                <i class="fas ${iconMap[type] || iconMap['info']}"></i>
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="removeToast('${toastId}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `);
    
    $('#toast-container').append(toast);
    
    // 自動移除
    setTimeout(() => {
        removeToast(toastId);
    }, 3000);
}

window.removeToast = function(toastId) {
    const toast = $('#' + toastId);
    toast.addClass('hiding');
    setTimeout(() => {
        toast.remove();
    }, 300);
};

// 監聽滾動更新狀態
$('#line-container').on('scroll', debounce(updateStatus, 100));

// 設置導航歷史
function setupNavigationHistory() {
    // 儲存返回時的 URL
    $(window).on('beforeunload', function() {
        if (navigationHistory.length > 0) {
            sessionStorage.setItem('navigationHistory', JSON.stringify(navigationHistory));
        }
    });
}

// 設置滑鼠追蹤
function setupMouseTracking() {
    $('#line-container').on('mousemove', '.code-line', function(e) {
        const lineNumber = $(this).data('line');
        if (currentHoverLine !== lineNumber) {
            currentHoverLine = lineNumber;
            updateHoverStatus(lineNumber);
        }
    });
    
    $('#line-container').on('mouseleave', function() {
        currentHoverLine = null;
        updateHoverStatus(null);
    });
}

// 更新滑鼠所在行狀態
function updateHoverStatus(lineNumber) {
    if (lineNumber) {
        $('#status-hover').text(`滑鼠: 第 ${lineNumber} 行`);
    } else {
        $('#status-hover').text('滑鼠: --');
    }
}

// 設置設備切換器
function setupDeviceSwitcher() {
    // 檢測當前設備
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        $('.device-btn[data-device="mobile"]').addClass('active');
        loadMobileStyles();
    } else {
        $('.device-btn[data-device="desktop"]').addClass('active');
    }
    
    // 綁定切換事件
    $('.device-btn').click(function() {
        $('.device-btn').removeClass('active');
        $(this).addClass('active');
        
        const device = $(this).data('device');
        if (device === 'mobile') {
            loadMobileStyles();
        } else {
            removeMobileStyles();
        }
    });
}

// 載入手機版樣式
function loadMobileStyles() {
    if (!$('#mobile-styles').length) {
        $('head').append('<link id="mobile-styles" rel="stylesheet" href="/static/css/file_viewer_mobile.css">');
        if (!$('#mobile-scripts').length) {
            $.getScript('/static/js/file_viewer_mobile.js');
        }
    }
}

// 移除手機版樣式
function removeMobileStyles() {
    $('#mobile-styles').remove();
}

// 顯示搜尋結果面板
function showSearchResultsPanel() {
    if (searchResults.length === 0) return;
    
    const panel = $('.search-results-panel');
    const body = panel.find('.search-results-body');
    body.empty();
    
    // 添加搜尋結果
    searchResults.forEach((result, index) => {
        const lineElement = $(`#line-${result.line}`);
        const lineContent = lineElement.find('.line-content').text();
        
        // 高亮匹配文字
        let highlightedContent = lineContent;
        const regex = new RegExp(`(${result.text})`, 'gi');
        highlightedContent = highlightedContent.replace(regex, '<span class="search-match">$1</span>');
        
        const resultItem = $(`
            <div class="search-result-item ${index === currentSearchIndex ? 'active' : ''}" 
                 data-index="${index}" data-line="${result.line}">
                <div class="search-result-line">
                    <div class="search-result-line-number">${result.line}</div>
                    <div class="search-result-line-content">${highlightedContent}</div>
                </div>
            </div>
        `);
        
        body.append(resultItem);
    });
    
    // 綁定點擊事件
    $('.search-result-item').click(function() {
        const index = $(this).data('index');
        const line = $(this).data('line');
        
        currentSearchIndex = index;
        scrollToLine(line);
        highlightCurrentResult();
        
        // 更新活躍狀態
        $('.search-result-item').removeClass('active');
        $(this).addClass('active');
    });
    
    panel.addClass('show');
}

// 隱藏搜尋結果面板
function hideSearchResultsPanel() {
    $('.search-results-panel').removeClass('show');
}

// 滾動到搜尋結果頂部
window.scrollToSearchTop = function() {
    const panel = $('.search-results-panel');
    panel.find('.search-results-body').scrollTop(0);
};

// 更新狀態 - 修改版
function updateStatus() {
    updateCurrentLineStatus();
    updateBookmarkStatus();
    updateJumpStatus();
    updateTargetStatus();
    $('#status-position').text(`${currentStartLine}-${currentEndLine} / ${totalLines}`);
}

// 更新目標行狀態
function updateTargetStatus() {
    $('#status-target').text(`目標: 第 ${currentTargetLine} 行`);
}

// 處理行雙擊 - 修改版
function handleLineDoubleClick(lineNumber) {
    showToast('info', `正在載入第 ${lineNumber} 行的上下文...`);
    
    // 儲存當前頁面到歷史
    const currentUrl = window.location.href;
    navigationHistory.push(currentUrl);
    sessionStorage.setItem('navigationHistory', JSON.stringify(navigationHistory));
    
    const url = new URL(window.location);
    url.searchParams.set('line', lineNumber);
    url.searchParams.set('start', Math.max(1, lineNumber - 200));
    url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
    url.searchParams.set('context', 200);
    url.searchParams.set('from', currentTargetLine);
    window.location.href = url.toString();
}

// 載入更多內容 - 修改版
function loadMoreContent(direction) {
    if (isLoadingMore) return;
    isLoadingMore = true;
    
    const loadingOverlay = direction === 'before' ? $('#loading-overlay-top') : $('#loading-overlay-bottom');
    loadingOverlay.show();
    
    // 添加載入文字
    if (!loadingOverlay.find('.loading-text').length) {
        loadingOverlay.append('<div class="loading-text">載入中...</div>');
    }
    
    let newStart, newEnd;
    
    if (direction === 'before') {
        newStart = Math.max(1, currentStartLine - 200);
        newEnd = currentStartLine - 1;
    } else {
        newStart = currentEndLine + 1;
        newEnd = Math.min(totalLines, currentEndLine + 200);
    }
    
    $.get('/file_viewer', {
        path: currentFilePath,
        line: direction === 'before' ? newStart : newEnd,
        context: 100,
        start: newStart,
        end: newEnd
    }).done(function(data) {
        // 解析返回的HTML並提取新行
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        const newLines = doc.querySelectorAll('.code-line');
        
        const container = $('#line-container');
        const scrollBefore = container[0].scrollHeight;
        const scrollTop = container.scrollTop();
        
        if (direction === 'before') {
            // 在前面插入
            const firstLine = container.find('.code-line').first();
            newLines.forEach(line => {
                const newElement = $(line.outerHTML);
                firstLine.before(newElement);
                
                // 添加載入動畫
                newElement.addClass('new-line-highlight');
                
                // 重新綁定事件
                bindLineEvents(newElement);
            });
            
            // 保持滾動位置
            const scrollAfter = container[0].scrollHeight;
            container.scrollTop(scrollTop + (scrollAfter - scrollBefore));
            
            currentStartLine = newStart;
        } else {
            // 在後面添加
            newLines.forEach(line => {
                const newElement = $(line.outerHTML);
                container.append(newElement);
                
                // 添加載入動畫
                newElement.addClass('new-line-highlight');
                
                // 重新綁定事件
                bindLineEvents(newElement);
            });
            
            currentEndLine = newEnd;
        }
        
        updateStatus();
        
        // 重新應用搜尋高亮
        if (lastSearchText) {
            performSearch();
        }
        
        // 重新應用顏色高亮
        reapplyHighlights();
        
    }).fail(function() {
        showToast('danger', '載入內容失敗，請稍後再試');
    }).always(function() {
        loadingOverlay.fadeOut(300);
        isLoadingMore = false;
    });
}

// 搜尋功能 - 修改版
function performSearch() {
    const searchText = $('#search-input').val().trim();
    lastSearchText = searchText;
    clearSearchHighlights();
    
    if (!searchText) {
        updateSearchStatus('搜尋: 無');
        hideSearchResultsPanel();
        return;
    }
    
    searchResults = [];
    let regex;

    try {
        if (useRegex) {
            regex = new RegExp(searchText, 'gi');
        } else {
            // 轉義特殊字符
            const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\//'); 監聽滾動更新狀態
            $('#line-container').on('scroll', debounce(updateStatus, 100));
            regex = new RegExp(escapedText, 'gi');
        }
    } catch (e) {
        showToast('danger', '無效的正規表達式');
        return;
    }
    
    $('.line-content').each(function(index) {
        const content = $(this).text();
        const lineNumber = parseInt($(this).parent().data('line'));
        let newContent = content;
        let hasMatch = false;
        
        // 收集所有匹配
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({
                text: match[0],
                index: match.index
            });
        }
        
        // 從後往前替換，避免索引變化
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            hasMatch = true;
            searchResults.push({
                line: lineNumber,
                element: this,
                text: m.text
            });
            
            newContent = newContent.substring(0, m.index) + 
                        '<span class="search-highlight">' + m.text + '</span>' + 
                        newContent.substring(m.index + m.text.length);
        }
        
        if (hasMatch) {
            $(this).html(newContent);
        }
    });
    
    currentSearchIndex = 0;
    updateSearchStatus(`找到 ${searchResults.length} 個結果`);
    $('#search-info').text(`${searchResults.length > 0 ? currentSearchIndex + 1 : 0} / ${searchResults.length}`);
    
    if (searchResults.length > 0) {
        highlightCurrentResult();
        showSearchResultsPanel();
    } else {
        hideSearchResultsPanel();
    }
}

// 全域函數 - 供 HTML 使用
window.toggleJumpMode = toggleJumpMode;
window.showRangeSelector = showRangeSelector;
window.closeRangeSelector = closeRangeSelector;
window.applyRange = applyRange;
window.jumpToLine = jumpToLine;
window.exportFile = exportFile;
window.exportHTML = exportHTML;
window.scrollToTarget = scrollToTarget;
window.clearAllHighlights = clearAllHighlights;
window.toggleRegex = toggleRegex;
window.findPrevious = findPrevious;
window.findNext = findNext;
window.goForward = goForward;window.hideSearchResultsPanel = hideSearchResultsPanel;