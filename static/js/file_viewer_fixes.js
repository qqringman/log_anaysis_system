// Enhanced File Viewer 修復和新增功能

// 修復搜尋功能 - 支援 Regex 延遲
function setupSearchWithDelay() {
    $('#search-input').off('input').on('input', function() {
        if (useRegex) {
            // Regex 模式下延遲 0.5 秒
            debounce(performSearchFixed, 500)();
        } else {
            // 一般模式下延遲 0.3 秒
            debounce(performSearchFixed, 300)();
        }
    });
}

// 修復 clearSearch 函數
window.clearSearch = function() {
    $('#search-input').val('');
    clearSearchHighlights();
    searchResults = [];
    currentSearchIndex = 0;
    lastSearchText = '';
    updateSearchStatus('搜尋: 無');
    $('#search-info').text('0 / 0');
    hideSearchResultsFab();
    hideSearchResultsPanel();
    
    // 清除regex模式的視覺狀態（但保留設定）
    if (!useRegex) {
        $('#search-input').removeClass('regex-mode');
    }
};

// 修復跳轉模式切換
window.toggleJumpMode = function() {
    jumpModeEnabled = !jumpModeEnabled;
    updateJumpModeButton();
    
    const navigation = $('#jump-navigation');
    
    if (jumpModeEnabled) {
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
        
        showToast('info', '跳轉模式已啟用 - F2跳轉點/F3書籤');
    } else {
        navigation.hide();
        showToast('info', '跳轉模式已關閉');
    }
};

// 修復範圍選擇器
window.applyRange = function() {
    const start = parseInt($('#range-start').val());
    const end = parseInt($('#range-end').val());
    const context = parseInt($('#range-context').val()) || 200;
    
    // 儲存設定
    saveRangeSettings();
    
    if (start && end && start <= end && start >= 1 && end <= totalLines) {
        const url = new URL(window.location);
        
        // 如果指定了上下文行數，則基於中間行計算範圍
        if (context > 0) {
            const centerLine = Math.floor((start + end) / 2);
            const newStart = Math.max(1, centerLine - context);
            const newEnd = Math.min(totalLines, centerLine + context);
            
            url.searchParams.set('line', centerLine);
            url.searchParams.set('start', newStart);
            url.searchParams.set('end', newEnd);
            url.searchParams.set('context', context);
        } else {
            // 直接使用指定的範圍
            url.searchParams.set('line', Math.floor((start + end) / 2));
            url.searchParams.set('start', start);
            url.searchParams.set('end', end);
        }
        
        window.location.href = url.toString();
    } else {
        showToast('warning', '請輸入有效的範圍');
    }
};

// 載入更多內容時保留標記
function reapplyMarks() {
    // 重新應用書籤
    bookmarks.forEach(lineNumber => {
        $(`#line-${lineNumber} .line-number`).addClass('bookmark');
    });
    
    // 重新應用跳轉點
    jumpPoints.forEach(lineNumber => {
        $(`#line-${lineNumber} .line-number`).addClass('jump-point');
    });
}

// 初始化所有修復
function initializeFixes() {
    
    // 修復搜尋功能
    setupSearchWithDelay();
    
    // 載入範圍設定
    loadRangeSettings();
    
    // 初始化標記管理
    setupMarksManager();
    
    // 修復範圍選擇器的數字輸入控制
    $('.number-input-controls button').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 確保滾動時不會丟失標記
    const originalLoadMoreContent = window.loadMoreContent;
    window.loadMoreContent = function(direction) {
        originalLoadMoreContent.call(this, direction);
        setTimeout(() => {
            reapplyMarks();
        }, 100);
    };
    
    // 替換原有的 performSearch 函數
    window.performSearch = performSearchFixed;
    
    // 修復 findNext 和 findPrevious
    window.findNext = function() {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
        highlightCurrentResult();
    };
    
    window.findPrevious = function() {
        if (searchResults.length === 0) return;
        currentSearchIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
        highlightCurrentResult();
    };
}

// 在頁面載入完成後初始化
$(document).ready(function() {
    initializeFixes();
});

// 全域函數導出
window.performSearchFixed = performSearchFixed;
window.showSearchResultsFab = showSearchResultsFab;
window.hideSearchResultsFab = hideSearchResultsFab;
window.reapplyMarks = reapplyMarks;

// 清除搜尋高亮
window.clearSearchHighlights = function() {
    $('.search-highlight').each(function() {
        const parent = $(this).parent();
        const html = parent.html();
        // 只移除搜尋高亮，保留其他高亮
        const newHtml = html.replace(/<span class="search-highlight[^"]*">(.*?)<\/span>/gi, '$1');
        parent.html(newHtml);
    });
};

// 更新搜尋狀態
window.updateSearchStatus = function(text) {
    $('#status-search').text(text);
};

// 高亮當前搜尋結果
window.highlightCurrentResult = function() {
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
};

// 滾動到元素
window.scrollToElement = function(element) {
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
};

// 跳轉到指定行號
window.jumpToLine = function(lineNumber) {
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
};

// 數字輸入框增減
window.changeNumber = function(inputId, delta) {
    const input = $(`#${inputId}`);
    const currentValue = parseInt(input.val()) || 0;
    const min = parseInt(input.attr('min')) || 0;
    const max = parseInt(input.attr('max')) || Infinity;
    const newValue = Math.max(min, Math.min(max, currentValue + delta));
    input.val(newValue);
    
    // 如果是範圍選擇器，立即儲存
    if (inputId.startsWith('range-')) {
        saveRangeSettings();
    }
};

// 快速範圍選擇
window.quickRangeSelect = function(value) {
    if (!value) return;
    
    if (value === 'all') {
        $('#range-start').val(1);
        $('#range-end').val(totalLines);
        $('#range-context').val(0);
    } else {
        const context = parseInt(value);
        $('#range-context').val(context);
        // 更新起始和結束行的建議值
        const center = Math.floor((currentStartLine + currentEndLine) / 2);
        $('#range-start').val(Math.max(1, center - context));
        $('#range-end').val(Math.min(totalLines, center + context));
    }
    
    // 儲存設定
    saveRangeSettings();
};