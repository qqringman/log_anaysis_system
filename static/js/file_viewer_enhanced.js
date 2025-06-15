// Enhanced File Viewer 功能修復和增強

// 美化數字輸入框
function beautifyNumberInputs() {
    // 範圍選擇器的數字輸入
    $('#range-start, #range-end, #range-context').each(function() {
        const input = $(this);
        const parent = input.parent();
        
        // 移除原有的控制按鈕
        parent.find('.number-input-controls').remove();
        
        // 創建新的包裝器
        const wrapper = $('<div class="form-control-number"></div>');
        input.wrap(wrapper);
        
        // 添加新的控制按鈕
        const controls = $(`
            <div class="number-controls">
                <button type="button" onclick="changeNumberValue(this, 1)">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button type="button" onclick="changeNumberValue(this, -1)">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `);
        
        //input.after(controls);
        
        // 移除原有的 form-control class
        input.removeClass('form-control');
    });
    
    // 跳轉行號輸入
    const jumpLineGroup = $('#jump-line').parent();
    //jumpLineGroup.attr('id', 'jump-line-group');
    //jumpLineGroup.addClass('form-control-number');
    
    //$('#jump-line').removeClass('form-control');
    
    // 添加數字控制
    const jumpControls = $(`
        <div class="number-controls">
            <button type="button" onclick="changeNumberValue(this, 1)">
                <i class="fas fa-chevron-up"></i>
            </button>
            <button type="button" onclick="changeNumberValue(this, -1)">
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>
    `);
    
    //$('#jump-line').after(jumpControls);
}

// 數字輸入框增減
window.changeNumberValue = function(button, delta) {
    const input = $(button).closest('.form-control-number').find('input');
    const currentValue = parseInt(input.val()) || 0;
    const min = parseInt(input.attr('min')) || 0;
    const max = parseInt(input.attr('max')) || Infinity;
    
    // 根據輸入框類型調整增減幅度
    let step = 1;
    if (input.attr('id') === 'range-context') {
        step = 10;
    } else if (input.attr('id') === 'jump-line') {
        step = 10;
    }
    
    const newValue = Math.max(min, Math.min(max, currentValue + (delta * step)));
    input.val(newValue);
    
    // 如果是範圍選擇器，立即儲存
    if (input.attr('id') && input.attr('id').startsWith('range-')) {
        saveRangeSettings();
    }
};

// 修復搜尋延遲（Regex 模式 1 秒）
function setupSearchWithDelayFixed() {
    let searchTimeout;
    
    $('#search-input').off('input').on('input', function() {
        clearTimeout(searchTimeout);
        
        const delay = useRegex ? 1000 : 300; // Regex 模式 1 秒，一般模式 0.3 秒
        
        searchTimeout = setTimeout(() => {
            performSearchEnhanced();
        }, delay);
    });
}

// 增強搜尋功能 - 不自動顯示搜尋結果面板
function performSearchEnhanced() {
    const searchText = $('#search-input').val().trim();
    lastSearchText = searchText;
    clearSearchHighlights();
    
    if (!searchText) {
        updateSearchStatus('搜尋: 無');
        hideSearchResultsFab();
        searchResults = [];
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
        const $this = $(this);
        const content = $this.text();
        const lineNumber = parseInt($this.parent().data('line'));
        
        let html = $this.html();
        let hasMatch = false;
        
        // 暫時移除現有的高亮標籤
        const tempMarkers = [];
        let cleanContent = html.replace(/<span class="[^"]*"[^>]*>(.*?)<\/span>/gi, function(match, content, offset) {
            const marker = `__TEMP_${tempMarkers.length}__`;
            tempMarkers.push({ marker, content, match });
            return marker + content + marker;
        });
        
        // 搜尋並收集匹配
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
            // 從後往前替換
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
        // 只顯示搜尋按鈕，不自動打開面板
        showSearchResultsFabOnly();
    } else {
        hideSearchResultsFab();
    }
}

// 只顯示搜尋結果按鈕
function showSearchResultsFabOnly() {
    const fab = $('.search-results-fab');
    fab.addClass('has-results');
    fab.find('.badge').text(searchResults.length);
}

// 修復跳轉模式邏輯
window.toggleJumpModeFixed = function() {
    jumpModeEnabled = !jumpModeEnabled;
    updateJumpModeButton();
    
    if (!jumpModeEnabled) {
        // 退出跳轉模式時隱藏導航提示
        $('#jump-navigation').hide();
    }
    
    // 不顯示 toast 提示
};

// 跳轉功能不顯示 toast
function gotoNextJumpSilent() {
    if (!jumpModeEnabled) return;
    
    if (jumpPoints.size === 0) return;
    
    const sortedJumps = Array.from(jumpPoints).sort((a, b) => a - b);
    const currentLine = getCurrentLine();
    
    let nextJump = sortedJumps.find(line => line > currentLine);
    if (!nextJump) {
        nextJump = sortedJumps[0];
    }
    
    scrollToLine(nextJump);
    updateJumpStatus();
}

function gotoPreviousJumpSilent() {
    if (!jumpModeEnabled) return;
    
    if (jumpPoints.size === 0) return;
    
    const sortedJumps = Array.from(jumpPoints).sort((a, b) => b - a);
    const currentLine = getCurrentLine();
    
    let prevJump = sortedJumps.find(line => line < currentLine);
    if (!prevJump) {
        prevJump = sortedJumps[0];
    }
    
    scrollToLine(prevJump);
    updateJumpStatus();
}

function gotoNextBookmarkSilent() {
    if (!jumpModeEnabled) return;
    
    if (bookmarks.size === 0) return;
    
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => a - b);
    const currentLine = getCurrentLine();
    
    let nextBookmark = sortedBookmarks.find(line => line > currentLine);
    if (!nextBookmark) {
        nextBookmark = sortedBookmarks[0];
    }
    
    scrollToLine(nextBookmark);
    updateStatus();
}

function gotoPreviousBookmarkSilent() {
    if (!jumpModeEnabled) return;
    
    if (bookmarks.size === 0) return;
    
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => b - a);
    const currentLine = getCurrentLine();
    
    let prevBookmark = sortedBookmarks.find(line => line < currentLine);
    if (!prevBookmark) {
        prevBookmark = sortedBookmarks[0];
    }
    
    scrollToLine(prevBookmark);
    updateStatus();
}

// 添加行號圖示
function addLineIcons() {
    $('.code-line').each(function() {
        const lineNumber = $(this).data('line');
        const lineNumberElement = $(this).find('.line-number');
        
        // 檢查是否已經有圖示
        if (lineNumberElement.find('.line-icons').length === 0) {
            const icons = $(`
                <div class="line-icons">
                    <div class="line-icon bookmark-icon" onclick="toggleBookmarkIcon(${lineNumber})" title="書籤">
                        📌
                    </div>
                    <div class="line-icon jump-icon" onclick="toggleJumpIcon(${lineNumber})" title="跳轉點">
                        🎯
                    </div>
                </div>
            `);
            
            lineNumberElement.append(icons);
            
            // 更新圖示狀態
            updateLineIconsState(lineNumber);
        }
    });
}

// 更新行圖示狀態
function updateLineIconsState(lineNumber) {
    const bookmarkIcon = $(`#line-${lineNumber} .bookmark-icon`);
    const jumpIcon = $(`#line-${lineNumber} .jump-icon`);
    
    if (bookmarks.has(lineNumber)) {
        bookmarkIcon.addClass('active');
    } else {
        bookmarkIcon.removeClass('active');
    }
    
    if (jumpPoints.has(lineNumber)) {
        jumpIcon.addClass('active');
    } else {
        jumpIcon.removeClass('active');
    }
}

// 點擊書籤圖示
window.toggleBookmarkIcon = function(lineNumber) {
    toggleBookmark(lineNumber);
    updateLineIconsState(lineNumber);
};

// 點擊跳轉點圖示
window.toggleJumpIcon = function(lineNumber) {
    toggleJumpPoint(lineNumber);
    updateLineIconsState(lineNumber);
};

// 美化確認對話框
function showConfirmDialog(title, message, onConfirm) {
    const dialog = $(`
        <div class="confirm-dialog-overlay" onclick="closeConfirmDialog()"></div>
        <div class="confirm-dialog">
            <div class="confirm-dialog-header">
                <h5>${title}</h5>
            </div>
            <div class="confirm-dialog-body">
                ${message}
            </div>
            <div class="confirm-dialog-footer">
                <button class="btn btn-outline-secondary" onclick="closeConfirmDialog()">
                    <i class="fas fa-times me-1"></i>取消
                </button>
                <button class="btn btn-danger" id="confirm-dialog-ok">
                    <i class="fas fa-check me-1"></i>確定
                </button>
            </div>
        </div>
    `);
    
    $('body').append(dialog);
    
    $('#confirm-dialog-ok').click(function() {
        closeConfirmDialog();
        if (onConfirm) onConfirm();
    });
}

window.closeConfirmDialog = function() {
    $('.confirm-dialog-overlay, .confirm-dialog').remove();
};

// 重寫清除函數使用美化對話框
window.clearAllBookmarksEnhanced = function() {
    if (bookmarks.size === 0) {
        showToast('info', '沒有書籤需要清除');
        return;
    }
    
    showConfirmDialog(
        '清除所有書籤',
        `確定要清除所有 ${bookmarks.size} 個書籤嗎？此操作無法復原。`,
        function() {
            bookmarks.forEach(lineNumber => {
                $(`#line-${lineNumber} .line-number`).removeClass('bookmark');
                updateLineIconsState(lineNumber);
            });
            bookmarks.clear();
            updateBookmarkStatus();
            updateMarksList();
            updateMarksStatus();
            showToast('success', '已清除所有書籤');
        }
    );
};

window.clearAllJumpPointsEnhanced = function() {
    if (jumpPoints.size === 0) {
        showToast('info', '沒有跳轉點需要清除');
        return;
    }
    
    showConfirmDialog(
        '清除所有跳轉點',
        `確定要清除所有 ${jumpPoints.size} 個跳轉點嗎？此操作無法復原。`,
        function() {
            jumpPoints.forEach(lineNumber => {
                $(`#line-${lineNumber} .line-number`).removeClass('jump-point');
                updateLineIconsState(lineNumber);
            });
            jumpPoints.clear();
            updateJumpStatus();
            updateMarksList();
            updateMarksStatus();
            showToast('success', '已清除所有跳轉點');
        }
    );
};

// 修復鍵盤快捷鍵
function setupKeyboardShortcutsEnhanced() {
    $(document).off('keydown.enhanced').on('keydown.enhanced', function(e) {
        // F2 - 只在跳轉模式下有效
        if (e.which === 113 && jumpModeEnabled) {
            e.preventDefault();
            if (e.shiftKey) {
                gotoPreviousJumpSilent();
            } else {
                gotoNextJumpSilent();
            }
        }
        
        // F3 - 只在跳轉模式下有效
        if (e.which === 114 && jumpModeEnabled) {
            e.preventDefault();
            if (e.shiftKey) {
                gotoPreviousBookmarkSilent();
            } else {
                gotoNextBookmarkSilent();
            }
        }
        
        // 其他快捷鍵保持不變
        if (e.ctrlKey && e.which === 70) {
            e.preventDefault();
            $('#search-input').focus().select();
        }
        
        if (e.which === 27) {
            if ($('#search-input').is(':focus')) {
                clearSearch();
            }
            hideContextMenu();
            hideSearchResultsPanel();
            hideMarksPanel();
            closeConfirmDialog();
        }
        
        if (e.ctrlKey && e.which === 71) {
            e.preventDefault();
            $('#jump-line').focus().select();
        }
        
        if (e.which === 13 && $('#search-input').is(':focus')) {
            e.preventDefault();
            if (e.shiftKey) {
                findPrevious();
            } else {
                findNext();
            }
        }
        
        if (e.which === 13 && $('#jump-line').is(':focus')) {
            e.preventDefault();
            jumpToLine();
        }
    });
}

// 初始化增強功能
function initializeEnhancements() {
    
    // 美化數字輸入框
    beautifyNumberInputs();
    
    // 設置搜尋延遲
    setupSearchWithDelayFixed();
    
    // 設置鍵盤快捷鍵
    setupKeyboardShortcutsEnhanced();
    
    // 添加行號圖示
    addLineIcons();
    
    // 替換原有函數
    window.toggleJumpMode = toggleJumpModeFixed;
    window.performSearch = performSearchEnhanced;
    window.clearAllBookmarks = clearAllBookmarksEnhanced;
    window.clearAllJumpPoints = clearAllJumpPointsEnhanced;
    window.gotoNextJump = gotoNextJumpSilent;
    window.gotoPreviousJump = gotoPreviousJumpSilent;
    window.gotoNextBookmark = gotoNextBookmarkSilent;
    window.gotoPreviousBookmark = gotoPreviousBookmarkSilent;
    
    // 確保載入更多內容時添加圖示
    const originalBindLineEvents = window.bindLineEvents;
    window.bindLineEvents = function(lineElement) {
        originalBindLineEvents.call(this, lineElement);
        
        // 添加圖示到新載入的行
        const lineNumber = lineElement.data('line');
        const lineNumberElement = lineElement.find('.line-number');
        
        if (lineNumberElement.find('.line-icons').length === 0) {
            const icons = $(`
                <div class="line-icons">
                    <div class="line-icon bookmark-icon" onclick="toggleBookmarkIcon(${lineNumber})" title="書籤">
                        📌
                    </div>
                    <div class="line-icon jump-icon" onclick="toggleJumpIcon(${lineNumber})" title="跳轉點">
                        🎯
                    </div>
                </div>
            `);
            
            lineNumberElement.append(icons);
            updateLineIconsState(lineNumber);
        }
    };
}

// 在頁面載入完成後初始化
$(document).ready(function() {
    initializeEnhancements();
});

// 隱藏搜尋結果浮動按鈕
window.hideSearchResultsFab = function() {
    $('.search-results-fab').removeClass('has-results');
};

// 隱藏搜尋結果面板
window.hideSearchResultsPanel = function() {
    $('.search-results-panel').removeClass('show');
};

// 隱藏標記管理面板
window.hideMarksPanel = function() {
    $('.marks-panel').removeClass('show');
};

// 隱藏右鍵選單
window.hideContextMenu = function() {
    $('#context-menu').hide();
};

// 全域函數
window.getCurrentLine = function() {
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
};

// 清除搜尋
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
};

// 其他必要的全域函數
window.scrollToLine = scrollToLine;
window.updateSearchStatus = function(text) {
    $('#status-search').text(text);
};
window.updateJumpStatus = function() {
    $('#status-jumps').text(`跳轉點: ${jumpPoints.size}`);
};
window.updateStatus = function() {
    updateCurrentLineStatus();
    updateBookmarkStatus();
    updateJumpStatus();
    updateTargetStatus();
    $('#status-position').text(`${currentStartLine}-${currentEndLine} / ${totalLines}`);
};
window.updateMarksList = updateMarksList;
window.updateMarksStatus = updateMarksStatus;

// 搜尋導航函數
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

window.highlightCurrentResult = function() {
    $('.search-highlight').removeClass('current');
    if (searchResults.length > 0 && currentSearchIndex < searchResults.length) {
        const result = searchResults[currentSearchIndex];
        
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

// 必要的輔助函數
window.updateCurrentLineStatus = function() {
    const currentLine = getCurrentLine();
    $('#status-line').text(`第 ${currentLine} 行`);
};

window.updateTargetStatus = function() {
    $('#status-target').text(`目標: 第 ${currentTargetLine} 行`);
};

window.updateBookmarkStatus = function() {
    $('#status-bookmarks').text(`書籤: ${bookmarks.size}`);
};

window.clearSearchHighlights = function() {
    $('.search-highlight').each(function() {
        const parent = $(this).parent();
        const html = parent.html();
        const newHtml = html.replace(/<span class="search-highlight[^"]*">(.*?)<\/span>/gi, '$1');
        parent.html(newHtml);
    });
};

window.scrollToElement = function(element) {
    const container = $('#line-container');
    const elementTop = element.position().top;
    const containerHeight = container.height();
    const scrollTo = container.scrollTop() + elementTop - (containerHeight / 2);
    
    container.animate({ scrollTop: scrollTo }, 300);
};

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

// 儲存範圍設定
window.saveRangeSettings = function() {
    const settings = {
        start: $('#range-start').val(),
        end: $('#range-end').val(),
        context: $('#range-context').val()
    };
    localStorage.setItem('fileViewerRangeSettings', JSON.stringify(settings));
};

// 其他可能需要的函數
window.showToast = window.showToast || function(type, message) {
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

// 處理行雙擊
window.handleLineDoubleClick = function(lineNumber) {
    showToast('info', `正在載入第 ${lineNumber} 行的上下文...`);
    
    const url = new URL(window.location);
    url.searchParams.set('line', lineNumber);
    url.searchParams.set('start', Math.max(1, lineNumber - 200));
    url.searchParams.set('end', Math.min(totalLines, lineNumber + 200));
    url.searchParams.set('context', 200);
    url.searchParams.set('from', currentTargetLine);
    window.location.href = url.toString();
};

// 右鍵選單相關
window.showLineContextMenu = function(event, lineNumber) {
    event.preventDefault();
    // 這個函數應該在 file_viewer.js 中定義
    if (typeof showContextMenu === 'function') {
        showContextMenu(event, 'line', lineNumber);
    }
};

window.showContentContextMenu = function(event, lineNumber) {
    event.preventDefault();
    // 這個函數應該在 file_viewer.js 中定義
    if (typeof showContextMenu === 'function') {
        showContextMenu(event, 'content', lineNumber);
    }
};

// 防抖函數
window.debounce = window.debounce || function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};