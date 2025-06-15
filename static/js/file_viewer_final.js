// Enhanced File Viewer 最終功能修復

// 全域變數確保正確初始化
window.useRegex = window.useRegex || false;
window.searchResults = window.searchResults || [];
window.currentSearchIndex = window.currentSearchIndex || 0;
window.lastSearchText = window.lastSearchText || '';

// 禁用所有 Toast 提示
window.showToast = function(type, message) {
    // 不顯示任何提示
    console.log(`[${type}] ${message}`);
};

// 修復快速導航按鈕顯示邏輯
function updateQuickNavButtons() {
    const container = $('.quick-nav-buttons');
    
    if (jumpModeEnabled) {
        // 只在跳轉模式下顯示
        if (bookmarks.size > 0 || jumpPoints.size > 0) {
            container.addClass('show');
            
            // 根據數量顯示/隱藏對應按鈕
            if (bookmarks.size > 0) {
                container.find('.btn-quick-nav:not(.warning)').show();
            } else {
                container.find('.btn-quick-nav:not(.warning)').hide();
            }
            
            if (jumpPoints.size > 0) {
                container.find('.btn-quick-nav.warning').show();
            } else {
                container.find('.btn-quick-nav.warning').hide();
            }
        } else {
            container.removeClass('show');
        }
    } else {
        // 非跳轉模式下隱藏
        container.removeClass('show');
    }
}

// 修復標記管理面板項目結構
function updateMarksListFixed() {
    const body = $('.marks-panel-body');
    const activeTab = $('.marks-panel-tab.active').data('type');
    body.empty();
    
    let marks = [];
    
    if (activeTab === 'jumps') {
        marks = Array.from(jumpPoints).sort((a, b) => a - b);
    } else {
        marks = Array.from(bookmarks).sort((a, b) => a - b);
    }
    
    if (marks.length === 0) {
        body.append(`
            <div class="marks-empty">
                <i class="fas fa-${activeTab === 'jumps' ? 'crosshairs' : 'bookmark'}"></i>
                <p>沒有${activeTab === 'jumps' ? '跳轉點' : '書籤'}</p>
                <small class="text-muted">在行號上點擊圖示新增</small>
            </div>
        `);
        return;
    }
    
    marks.forEach(lineNumber => {
        const lineElement = $(`#line-${lineNumber}`);
        let preview = '(載入中...)';
        
        if (lineElement.length > 0) {
            const content = lineElement.find('.line-content').text();
            preview = content.substring(0, 80) + (content.length > 80 ? '...' : '');
        }
        
        const markItem = $(`
            <div class="marks-item ${activeTab === 'jumps' ? 'jump-point' : 'bookmark'}" 
                 data-line="${lineNumber}">
                <div class="marks-item-info">
                    <div class="marks-item-actions">
                        <button onclick="goToMarkLine(${lineNumber})" title="跳轉到此行">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button onclick="removeMarkFromPanel('${activeTab}', ${lineNumber})" title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="marks-item-line">第 ${lineNumber} 行</div>
                    <div class="marks-item-preview">${preview}</div>
                </div>
            </div>
        `);
        
        body.append(markItem);
    });
}

// 修復匯出功能
function fixExportFunctionality() {
    // 確保匯出按鈕可點擊
    $('.btn-export').off('click').on('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const dropdown = $('.export-dropdown');
        const isOpen = dropdown.hasClass('show');
        
        if (!isOpen) {
            const btnOffset = $(this).offset();
            const btnHeight = $(this).outerHeight();
            const btnWidth = $(this).outerWidth();
            
            const dropdownWidth = 320;
            let left = btnOffset.left;
            
            if (left + dropdownWidth > $(window).width()) {
                left = btnOffset.left + btnWidth - dropdownWidth;
            }
            
            dropdown.css({
                position: 'fixed',
                top: btnOffset.top + btnHeight + 5,
                left: left,
                'pointer-events': 'auto',
                'z-index': 99999
            });
            
            dropdown.addClass('show');
        } else {
            dropdown.removeClass('show');
        }
    });
    
    // 確保選項可點擊
    $('.export-option').off('click').on('click', function(e) {
        e.stopPropagation();
        const onclick = $(this).attr('onclick');
        if (onclick) {
            eval(onclick);
        }
    });
}

// 修復 Regex 搜尋功能
function setupRegexSearchFixed() {
    let searchTimeout;
    
    $('#search-input').off('input.regex').on('input.regex', function() {
        clearTimeout(searchTimeout);
        
        const searchText = $(this).val().trim();
        
        if (!searchText) {
            performSearchEnhancedFixed();
            return;
        }
        
        // 根據模式設置延遲
        const delay = useRegex ? 1000 : 300;
        
        searchTimeout = setTimeout(() => {
            performSearchEnhancedFixed();
        }, delay);
    });
}

// 增強搜尋功能修復版
function performSearchEnhancedFixed() {
    const searchText = $('#search-input').val().trim();
    lastSearchText = searchText;
    
    // 清除之前的搜尋高亮
    clearSearchHighlights();
    
    if (!searchText) {
        updateSearchStatus('搜尋: 無');
        hideSearchResultsFab();
        searchResults = [];
        $('#search-info').text('0 / 0');
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
        console.error('無效的正規表達式:', e);
        return;
    }
    
    $('.line-content').each(function() {
        const $this = $(this);
        const content = $this.text();
        const lineNumber = parseInt($this.parent().data('line'));
        
        let html = $this.html();
        
        // 保存現有的高亮
        const existingHighlights = [];
        html = html.replace(/<span class="highlight-color-(\d+)"[^>]*>(.*?)<\/span>/gi, function(match, colorNum, highlightedText) {
            const placeholder = `__HIGHLIGHT_${existingHighlights.length}__`;
            existingHighlights.push({ placeholder, match });
            return placeholder;
        });
        
        // 搜尋匹配
        let matches = [];
        let match;
        regex.lastIndex = 0; // 重置 regex
        
        while ((match = regex.exec(content)) !== null) {
            matches.push({
                text: match[0],
                index: match.index,
                length: match[0].length
            });
            
            searchResults.push({
                line: lineNumber,
                element: this,
                text: match[0]
            });
        }
        
        // 從後往前替換搜尋匹配
        let newContent = content;
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            newContent = newContent.substring(0, m.index) + 
                        '<span class="search-highlight">' + 
                        newContent.substring(m.index, m.index + m.length) + 
                        '</span>' + 
                        newContent.substring(m.index + m.length);
        }
        
        // 恢復原有的高亮
        existingHighlights.forEach(item => {
            newContent = newContent.replace(item.placeholder, item.match);
        });
        
        if (matches.length > 0) {
            $this.html(newContent);
        }
    });
    
    currentSearchIndex = 0;
    updateSearchStatus(`找到 ${searchResults.length} 個結果`);
    $('#search-info').text(`${searchResults.length > 0 ? currentSearchIndex + 1 : 0} / ${searchResults.length}`);
    
    if (searchResults.length > 0) {
        highlightCurrentResult();
        showSearchResultsFabOnly();
    } else {
        hideSearchResultsFab();
    }
}

// 修復智能高亮功能
window.highlightSelected = function() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) return;
    
    // 使用下一個顏色
    const colorIndex = (Object.keys(highlightColors).length % 10) + 1;
    highlightWithColor(selectedText, colorIndex);
};

window.highlightWithColor = function(text, color) {
    if (!text) return;
    
    // 儲存高亮資訊
    if (!window.highlightColors) {
        window.highlightColors = {};
    }
    
    if (!highlightColors[text]) {
        highlightColors[text] = [];
    }
    highlightColors[text].push(color);
    
    // 添加到活躍顏色集合
    if (!window.activeHighlightColors) {
        window.activeHighlightColors = new Set();
    }
    activeHighlightColors.add(color);
    updateHighlightJumper();
    
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedText})`, 'gi');
    
    $('.line-content').each(function() {
        const $this = $(this);
        let html = $this.html();
        
        // 保護現有的標籤
        const protectedContent = [];
        html = html.replace(/<[^>]+>([^<]*)<\/[^>]+>/g, function(match) {
            const marker = `__PROTECTED_${protectedContent.length}__`;
            protectedContent.push({ marker, match });
            return marker;
        });
        
        // 應用新的高亮
        html = html.replace(regex, `<span class="highlight-color-${color}">$1</span>`);
        
        // 恢復保護的內容
        protectedContent.forEach(item => {
            html = html.replace(item.marker, item.match);
        });
        
        $this.html(html);
    });
};

// 更新跳轉點和書籤狀態
window.updateJumpModeState = function() {
    updateJumpModeButton();
    updateQuickNavButtons();
    updateJumpStatus();
    updateBookmarkStatus();
};

// 覆蓋原有函數
window.toggleJumpMode = function() {
    jumpModeEnabled = !jumpModeEnabled;
    updateJumpModeState();
};

window.toggleBookmark = function(lineNumber) {
    const lineElement = $(`#line-${lineNumber} .line-number`);
    
    if (bookmarks.has(lineNumber)) {
        bookmarks.delete(lineNumber);
        lineElement.removeClass('bookmark');
    } else {
        bookmarks.add(lineNumber);
        lineElement.addClass('bookmark');
    }
    
    updateBookmarkStatus();
    updateMarksStatus();
    updateQuickNavButtons();
    updateLineIconsState(lineNumber);
};

window.toggleJumpPoint = function(lineNumber) {
    const lineElement = $(`#line-${lineNumber} .line-number`);
    
    if (jumpPoints.has(lineNumber)) {
        jumpPoints.delete(lineNumber);
        lineElement.removeClass('jump-point');
    } else {
        jumpPoints.add(lineNumber);
        lineElement.addClass('jump-point');
    }
    
    updateJumpStatus();
    updateMarksStatus();
    updateQuickNavButtons();
    updateLineIconsState(lineNumber);
};

// 覆蓋更新標記列表函數
window.updateMarksList = updateMarksListFixed;

// 初始化最終修復
function initializeFinalFixes() {
    // 修復匯出功能
    fixExportFunctionality();
    
    // 修復 Regex 搜尋
    setupRegexSearchFixed();
    
    // 更新快速導航按鈕
    updateQuickNavButtons();
    
    // 替換搜尋函數
    window.performSearch = performSearchEnhancedFixed;
    window.performSearchFixed = performSearchEnhancedFixed;
    window.performSearchEnhanced = performSearchEnhancedFixed;
    
    // 確保右鍵選單有智能高亮選項
    fixContextMenu();
    
    // 監聽標記變化
    const originalToggleBookmark = window.toggleBookmark;
    const originalToggleJumpPoint = window.toggleJumpPoint;
    
    // 美化跳轉行號輸入框
    beautifyJumpLineInput();
}

// 美化跳轉行號輸入框
function beautifyJumpLineInput() {
    const jumpLineGroup = $('#jump-line').parent();
    jumpLineGroup.attr('id', 'jump-line-wrapper');
    jumpLineGroup.removeClass('input-group').css('width', '240px');
}

// 修復右鍵選單
function fixContextMenu() {
    // 監聽右鍵選單事件
    $(document).on('contextmenu', '.line-content', function(e) {
        setTimeout(() => {
            // 確保智能高亮選項存在
            if ($('.context-menu-item:contains("智能高亮")').length === 0) {
                // 在第一個分隔線前插入智能高亮選項
                const firstSeparator = $('.context-menu-separator').first();
                if (firstSeparator.length > 0) {
                    $(`<div class="context-menu-item highlight-item" onclick="highlightSelected()">
                        <i class="fas fa-highlighter"></i>
                        <span>智能高亮</span>
                    </div>`).insertBefore(firstSeparator);
                }
            }
        }, 10);
    });
}

// 清除搜尋高亮但保留顏色高亮
window.clearSearchHighlights = function() {
    $('.search-highlight').each(function() {
        const $this = $(this);
        const text = $this.text();
        $this.replaceWith(text);
    });
};

// 在頁面載入完成後初始化
$(document).ready(function() {
    // 等待其他腳本載入完成
    setTimeout(() => {
        initializeFinalFixes();
    }, 100);
});

// 確保全域函數可用
window.updateQuickNavButtons = updateQuickNavButtons;
window.updateJumpModeState = updateJumpModeState;
window.performSearchEnhancedFixed = performSearchEnhancedFixed;
window.updateMarksListFixed = updateMarksListFixed;