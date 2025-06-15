// 標記管理相關功能

// 初始化標記管理
function setupMarksManager() {
    updateMarksStatus();
    
    // 初始設置清除按鈕的顯示狀態
    $('.marks-panel-footer button:last').hide();
}

// 更新標記狀態
function updateMarksStatus() {
    const totalMarks = bookmarks.size + jumpPoints.size;
    
    if (totalMarks > 0) {
        $('.marks-fab').addClass('show');
        $('.marks-fab .badge').text(totalMarks);
    } else {
        $('.marks-fab').removeClass('show');
    }
    
    // 更新面板內容
    if ($('.marks-panel').hasClass('show')) {
        updateMarksList();
    }
}

// 切換標記面板
function toggleMarksPanel() {
    const panel = $('.marks-panel');
    
    if (panel.hasClass('show')) {
        hideMarksPanel();
    } else {
        showMarksPanel();
    }
}

// 顯示標記面板
function showMarksPanel() {
    const panel = $('.marks-panel');
    const activeTab = $('.marks-panel-tab.active').data('type');
    
    panel.addClass('show');
    updateMarksList();
    
    // 顯示對應的清除按鈕
    if (activeTab === 'jumps') {
        $('.marks-panel-footer button:first').show();
        $('.marks-panel-footer button:last').hide();
    } else {
        $('.marks-panel-footer button:first').hide();
        $('.marks-panel-footer button:last').show();
    }
}

// 隱藏標記面板
function hideMarksPanel() {
    $('.marks-panel').removeClass('show');
}

// 更新標記列表
function updateMarksList() {
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
                <small class="text-muted">在行號上按 ${activeTab === 'jumps' ? 'F2' : 'F3'} 新增</small>
            </div>
        `);
        return;
    }
    
    marks.forEach(lineNumber => {
        const lineElement = $(`#line-${lineNumber}`);
        let preview = '(載入中...)';
        
        if (lineElement.length > 0) {
            const content = lineElement.find('.line-content').text();
            preview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }
        
        const markItem = $(`
            <div class="marks-item ${activeTab === 'jumps' ? 'jump-point' : 'bookmark'}" 
                 data-line="${lineNumber}">
                <div class="marks-item-info">
                    <div class="marks-item-line">第 ${lineNumber} 行</div>
                    <div class="marks-item-preview">${preview}</div>
                </div>
                <div class="marks-item-actions">
                    <button onclick="goToMarkLine(${lineNumber})" title="跳轉到此行">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    <button onclick="removeMarkFromPanel('${activeTab}', ${lineNumber})" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `);
        
        body.append(markItem);
    });
}

// 從面板中移除標記
window.removeMarkFromPanel = function(type, lineNumber) {
    if (type === 'jumps') {
        toggleJumpPoint(lineNumber);
    } else {
        toggleBookmark(lineNumber);
    }
    updateMarksList();
    updateMarksStatus();
};

// 跳轉到標記行
window.goToMarkLine = function(lineNumber) {
    scrollToLine(lineNumber);
    
    // 高亮效果
    const lineElement = $(`#line-${lineNumber}`);
    if (lineElement.length > 0) {
        lineElement.addClass('animate__animated animate__flash');
        setTimeout(() => {
            lineElement.removeClass('animate__animated animate__flash');
        }, 1000);
    }
    
    showToast('success', `已跳轉到第 ${lineNumber} 行`);
};

// 清除所有書籤
function clearAllBookmarks() {
    if (bookmarks.size === 0) {
        showToast('info', '沒有書籤需要清除');
        return;
    }
    
    if (confirm(`確定要清除所有 ${bookmarks.size} 個書籤嗎？`)) {
        bookmarks.forEach(lineNumber => {
            $(`#line-${lineNumber} .line-number`).removeClass('bookmark');
        });
        bookmarks.clear();
        updateBookmarkStatus();
        updateMarksList();
        updateMarksStatus();
        showToast('success', '已清除所有書籤');
    }
}

// 清除所有跳轉點
function clearAllJumpPoints() {
    if (jumpPoints.size === 0) {
        showToast('info', '沒有跳轉點需要清除');
        return;
    }
    
    if (confirm(`確定要清除所有 ${jumpPoints.size} 個跳轉點嗎？`)) {
        jumpPoints.forEach(lineNumber => {
            $(`#line-${lineNumber} .line-number`).removeClass('jump-point');
        });
        jumpPoints.clear();
        updateJumpStatus();
        updateMarksList();
        updateMarksStatus();
        showToast('success', '已清除所有跳轉點');
    }
}

// 搜尋功能修復版 - 保留標記功能
function performSearchFixed() {
    const searchText = $('#search-input').val().trim();
    lastSearchText = searchText;
    clearSearchHighlights();
    
    if (!searchText) {
        updateSearchStatus('搜尋: 無');
        hideSearchResultsPanel();
        hideSearchResultsFab();
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
            regex = new RegExp(escapedText, 'gi');
        }
    } catch (e) {
        showToast('danger', '無效的正規表達式');
        return;
    }
    
    $('.line-content').each(function(index) {
        const $this = $(this);
        const content = $this.text();
        const lineNumber = parseInt($this.parent().data('line'));
        
        // 儲存現有的HTML結構（包含高亮顏色）
        let html = $this.html();
        let hasMatch = false;
        
        // 暫時移除現有的高亮標籤以便搜尋純文字
        const tempMarkers = [];
        let cleanContent = html.replace(/<span class="[^"]*"[^>]*>(.*?)<\/span>/gi, function(match, content, offset) {
            const marker = `__TEMP_${tempMarkers.length}__`;
            tempMarkers.push({ marker, content, match });
            return marker + content + marker;
        });
        
        // 在純文字中搜尋
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({
                text: match[0],
                index: match.index
            });
        }
        
        // 記錄搜尋結果
        matches.forEach(m => {
            hasMatch = true;
            searchResults.push({
                line: lineNumber,
                element: this,
                text: m.text
            });
        });
        
        if (hasMatch) {
            // 從後往前替換，避免索引變化
            let newHtml = content;
            for (let i = matches.length - 1; i >= 0; i--) {
                const m = matches[i];
                newHtml = newHtml.substring(0, m.index) + 
                         '<span class="search-highlight">' + m.text + '</span>' + 
                         newHtml.substring(m.index + m.text.length);
            }
            
            // 恢復其他高亮標籤
            tempMarkers.forEach(temp => {
                const markerRegex = new RegExp(temp.marker + '(.*?)' + temp.marker, 'g');
                newHtml = newHtml.replace(markerRegex, temp.match);
            });
            
            $this.html(newHtml);
        }
    });
    
    currentSearchIndex = 0;
    updateSearchStatus(`找到 ${searchResults.length} 個結果`);
    $('#search-info').text(`${searchResults.length > 0 ? currentSearchIndex + 1 : 0} / ${searchResults.length}`);
    
    if (searchResults.length > 0) {
        highlightCurrentResult();
        showSearchResultsPanel();
        showSearchResultsFab();
    } else {
        hideSearchResultsPanel();
        hideSearchResultsFab();
    }
}

// 顯示搜尋結果浮動按鈕
function showSearchResultsFab() {
    const fab = $('.search-results-fab');
    fab.addClass('show');
    fab.find('.badge').text(searchResults.length);
    
    // 脈動效果
    if (searchResults.length > 0) {
        fab.addClass('pulse');
        setTimeout(() => {
            fab.removeClass('pulse');
        }, 2000);
    }
}

// 隱藏搜尋結果浮動按鈕
function hideSearchResultsFab() {
    $('.search-results-fab').removeClass('show');
}

// 記住範圍選擇設定
function saveRangeSettings() {
    const settings = {
        start: $('#range-start').val(),
        end: $('#range-end').val(),
        context: $('#range-context').val()
    };
    localStorage.setItem('fileViewerRangeSettings', JSON.stringify(settings));
}

// 載入範圍選擇設定
function loadRangeSettings() {
    const saved = localStorage.getItem('fileViewerRangeSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.start) $('#range-start').val(settings.start);
            if (settings.end) $('#range-end').val(settings.end);
            if (settings.context) $('#range-context').val(settings.context);
        } catch (e) {
            console.error('載入範圍設定失敗:', e);
        }
    }
}

// 切換跳轉點（修復版）
function toggleJumpPoint(lineNumber) {
    const lineElement = $(`#line-${lineNumber} .line-number`);
    
    if (jumpPoints.has(lineNumber)) {
        jumpPoints.delete(lineNumber);
        lineElement.removeClass('jump-point');
        showToast('info', `已移除第 ${lineNumber} 行的跳轉點`);
    } else {
        jumpPoints.add(lineNumber);
        lineElement.addClass('jump-point');
        showToast('success', `已設定第 ${lineNumber} 行為跳轉點`);
    }
    
    updateJumpStatus();
    updateMarksStatus();
}

// 切換書籤（修復版）
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
    updateMarksStatus();
}

// 更新跳轉模式按鈕狀態
function updateJumpModeButton() {
    const btn = $('#jump-mode-btn');
    
    if (jumpModeEnabled) {
        btn.removeClass('btn-outline-secondary').addClass('btn-gradient-warning jump-mode-active');
        btn.html('<i class="fas fa-crosshairs me-1"></i>退出跳轉');
    } else {
        btn.removeClass('btn-gradient-warning jump-mode-active').addClass('btn-outline-secondary');
        btn.html('<i class="fas fa-crosshairs me-1"></i>跳轉模式');
    }
}

// 處理行點擊（根據跳轉模式）
function handleLineClick(lineNumber) {
    // 如果在跳轉模式下，不做任何操作
    if (jumpModeEnabled) {
        return;
    }
    
    // 正常模式下切換書籤
    toggleBookmark(lineNumber);
}

// 綁定行事件（修復版）
function bindLineEvents(lineElement) {
    const lineNumber = lineElement.data('line');
    
    lineElement.find('.line-number')
        .off('click') // 移除點擊事件
        .on('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLineDoubleClick(lineNumber);
        })
        .on('contextmenu', function(e) {
            showLineContextMenu(e, lineNumber);
        });
    
    lineElement.find('.line-content')
        .off('contextmenu') // 先移除舊事件
        .on('contextmenu', function(e) {
            showContentContextMenu(e, lineNumber);
        });
    
    // 重新應用已有的標記
    if (bookmarks.has(lineNumber)) {
        lineElement.find('.line-number').addClass('bookmark');
    }
    
    if (jumpPoints.has(lineNumber)) {
        lineElement.find('.line-number').addClass('jump-point');
    }
}

// 更新書籤狀態
window.updateBookmarkStatus = function() {
    $('#status-bookmarks').text(`書籤: ${bookmarks.size}`);
};

// 更新跳轉點狀態
window.updateJumpStatus = function() {
    $('#status-jumps').text(`跳轉點: ${jumpPoints.size}`);
};

// 滾動到指定行
window.scrollToLine = function(lineNumber) {
    const lineElement = $(`#line-${lineNumber}`);
    if (lineElement.length > 0) {
        scrollToElement(lineElement);
    } else {
        // 如果行不在當前顯示範圍，需要跳轉
        if (lineNumber < currentStartLine || lineNumber > currentEndLine) {
            jumpToLine(lineNumber);
        }
    }
};

// Toast 提示系統
window.showToast = function(type, message) {
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
};

window.removeToast = function(toastId) {
    const toast = $('#' + toastId);
    toast.addClass('hiding');
    setTimeout(() => {
        toast.remove();
    }, 300);
};

// 切換標記面板標籤
window.changeMarksTab = function(type) {
    $('.marks-panel-tab').removeClass('active');
    $(`.marks-panel-tab[data-type="${type}"]`).addClass('active');
    
    // 切換清除按鈕的顯示
    if (type === 'jumps') {
        $('.marks-panel-footer button:first').show();
        $('.marks-panel-footer button:last').hide();
    } else {
        $('.marks-panel-footer button:first').hide();
        $('.marks-panel-footer button:last').show();
    }
    
    updateMarksList();
};