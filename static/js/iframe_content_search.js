// iframe 內容搜尋功能
(function() {
    let searchHighlights = [];
    let currentHighlightIndex = 0;
    let searchKeyword = '';
    let isSearching = false; // 新增：防止重複搜尋
    let searchTimeout = null; // 新增：超時計時器

    // 監聽來自父視窗的搜尋訊息
    window.addEventListener('message', function(event) {
        // 清除之前的超時計時器
        if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
        }
        
        // 如果正在搜尋，等待一下再處理新請求
        if (isSearching) {
            console.log('正在處理前一個搜尋，稍後重試...');
            // 延遲 100ms 再處理新請求
            searchTimeout = setTimeout(() => {
                isSearching = false;
                window.dispatchEvent(new MessageEvent('message', { data: event.data }));
            }, 100);
            return;
        }
        
        if (event.data.type === 'jump-to-line') {
            const { lineNumber, matchIndex } = event.data;
            jumpToLine(lineNumber, matchIndex);
        }
        else if (event.data.type === 'search') {
            isSearching = true;
            const { options } = event.data;
            
            // 使用 Promise 確保搜尋完成後重置標記
            new Promise((resolve) => {
                setTimeout(() => {
                    // 傳遞完整的 event.data 作為第二個參數
                    performSearch(options, event.data);
                    resolve();
                }, 10);
            }).finally(() => {
                // 確保標記被重置
                setTimeout(() => {
                    isSearching = false;
                }, 50);
            });
        } else if (event.data.type === 'clear-search') {
            clearHighlights();
            isSearching = false;
        } else if (event.data.type === 'next-result') {
            navigateToNext();
        } else if (event.data.type === 'prev-result') {
            navigateToPrev();
        }
    });

    function jumpToLine(lineNumber, matchIndex) {
        // 確保 matchIndex 是有效的數字
        matchIndex = parseInt(matchIndex) || 0;
        
        // 找到對應的高亮元素
        if (searchHighlights && searchHighlights[matchIndex]) {
            scrollToHighlight(matchIndex);
        } else {
            console.warn('找不到指定的搜尋結果:', matchIndex);
        }
    }

    function createSearchRegex(keyword, options) {
        let flags = 'g';
        if (!options.caseSensitive) flags += 'i';
        
        // 處理正則表達式選項
        if (options.regex === true) {  // 明確檢查是否為 true
            try {
                // 測試正則表達式是否有效
                new RegExp(keyword, flags);
                // 如果有效，直接返回
                return new RegExp(keyword, flags);
            } catch (e) {
                console.error('無效的正則表達式:', e.message);
                // 顯示錯誤訊息給用戶
                window.parent.postMessage({
                    type: 'search-error',
                    message: `正則表達式錯誤: ${e.message}`
                }, '*');
                // 返回一個永遠不會匹配的正則
                return new RegExp('(?!.*)', flags);
            }
        }
        
        // 非正則模式 - 轉義特殊字符
        let pattern = escapeRegex(keyword);
        if (options.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        
        return new RegExp(pattern, flags);
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlightMatches(textNode, matches) {
        const parent = textNode.parentNode;
        
        // 檢查父節點是否有效
        if (!parent) {
            console.warn('文字節點沒有父節點');
            return;
        }
        
        const text = textNode.textContent;
        const fragment = document.createDocumentFragment();
        
        let lastIndex = 0;
        matches.forEach(match => {
            // 添加匹配前的文本
            if (match.start > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(text.substring(lastIndex, match.start))
                );
            }
            
            // 添加高亮的匹配文本
            const span = document.createElement('span');
            span.className = 'search-highlight';
            span.textContent = text.substring(match.start, match.end);
            fragment.appendChild(span);
            
            // 確保元素在 DOM 中才加入陣列
            searchHighlights.push(span);
            
            lastIndex = match.end;
        });
        
        // 添加剩餘的文本
        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
            );
        }
        
        try {
            parent.replaceChild(fragment, textNode);
        } catch (error) {
            console.error('替換文字節點時發生錯誤:', error);
        }
    }

    function clearHighlights() {
        // 重置搜尋狀態
        isSearching = false;
        
        // 清除超時計時器
        if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
        }
        
        searchHighlights.forEach(highlight => {
            // 檢查高亮元素是否還在 DOM 中
            if (highlight && highlight.parentNode) {
                const parent = highlight.parentNode;
                const text = highlight.textContent;
                const textNode = document.createTextNode(text);
                
                try {
                    parent.replaceChild(textNode, highlight);
                    parent.normalize();
                } catch (error) {
                    console.warn('清除高亮時發生錯誤:', error);
                }
            }
        });
        
        // 清空陣列
        searchHighlights = [];
        currentHighlightIndex = 0;
        
        // 額外的清理：移除所有殘留的高亮
        const remainingHighlights = document.querySelectorAll('.search-highlight');
        remainingHighlights.forEach(el => {
            if (el && el.parentNode) {
                const parent = el.parentNode;
                const text = el.textContent;
                const textNode = document.createTextNode(text);
                
                try {
                    parent.replaceChild(textNode, el);
                    parent.normalize();
                } catch (error) {
                    console.warn('清除殘留高亮時發生錯誤:', error);
                }
            }
        });
    }

    function scrollToHighlight(index) {
        if (index < 0 || index >= searchHighlights.length) return;
        
        // 移除所有當前高亮
        searchHighlights.forEach(h => h.classList.remove('current-highlight'));
        
        // 添加當前高亮
        const highlight = searchHighlights[index];
        highlight.classList.add('current-highlight');
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        currentHighlightIndex = index;
    }

    function navigateToNext() {
        if (searchHighlights.length === 0) return;
        const nextIndex = (currentHighlightIndex + 1) % searchHighlights.length;
        scrollToHighlight(nextIndex);
        updatePosition();
    }

    function navigateToPrev() {
        if (searchHighlights.length === 0) return;
        const prevIndex = (currentHighlightIndex - 1 + searchHighlights.length) % searchHighlights.length;
        scrollToHighlight(prevIndex);
        updatePosition();
    }

    function updatePosition() {
        window.parent.postMessage({
            type: 'search-position',
            current: currentHighlightIndex + 1,
            total: searchHighlights.length
        }, '*');
    }

    function performSearch(options, eventData) {
        // 設置預設值，避免 undefined 錯誤
        eventData = eventData || {};
        
        // 先嘗試清理現有高亮
        try {
            clearHighlights();
        } catch (error) {
            console.warn('清理高亮時發生錯誤，嘗試強制清理:', error);
            // 強制清理
            searchHighlights = [];
            currentHighlightIndex = 0;
            
            // 移除所有高亮類別
            const allHighlights = document.querySelectorAll('.search-highlight');
            allHighlights.forEach(el => {
                if (el) {
                    el.classList.remove('search-highlight', 'current-highlight');
                    // 嘗試解包元素
                    if (el.parentNode) {
                        const parent = el.parentNode;
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                }
            });
        }
        
        searchKeyword = options.keyword;
        if (!searchKeyword) {
            // 沒有關鍵字，重置搜尋狀態
            isSearching = false;
            return;
        }

        console.log('開始搜尋:', options);
        const results = [];
        
        try {
            const regex = createSearchRegex(searchKeyword, options);
            
            // 獲取所有文字行
            const lines = document.body.innerText.split('\n');
            
            lines.forEach((line, lineIndex) => {
                let match;
                regex.lastIndex = 0; // 重置正則表達式
                while ((match = regex.exec(line)) !== null) {
                    results.push({
                        lineNumber: lineIndex + 1,
                        content: line,
                        matchStart: match.index,
                        matchEnd: match.index + match[0].length,
                        matchText: match[0]
                    });
                    // 防止無限循環（對於空字串匹配）
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                }
            });

            // 高亮顯示
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent;
                if (!text) continue;

                let matches = [];
                let match;
                regex.lastIndex = 0; // 重置正則表達式
                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        text: match[0]
                    });
                    // 防止無限循環
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                }

                if (matches.length > 0) {
                    highlightMatches(node, matches);
                }
            }

            // 通知父視窗搜尋結果
            if (searchHighlights.length > 0) {
                currentHighlightIndex = 0;
                scrollToHighlight(0);
                
                window.parent.postMessage({
                    type: 'search-results',
                    count: searchHighlights.length,
                    keyword: searchKeyword,
                    results: results,
                    pane: eventData.pane || null,  // 確保傳遞 pane 資訊
                    source: eventData.source || 'iframe'
                }, '*');
            } else {
                window.parent.postMessage({
                    type: 'search-results',
                    count: 0,
                    keyword: searchKeyword,
                    results: [],
                    pane: eventData.pane || null,  // 確保傳遞 pane 資訊
                    source: eventData.source || 'iframe'
                }, '*');
            }
        } catch (error) {
            console.error('搜尋過程發生錯誤:', error);
            // 發送錯誤訊息
            window.parent.postMessage({
                type: 'search-error',
                message: error.message,
                keyword: searchKeyword
            }, '*');
        } finally {
            // 確保搜尋狀態被重置
            setTimeout(() => {
                isSearching = false;
            }, 100);
        }
    }

    // 添加樣式
    const style = document.createElement('style');
    style.textContent = `
        .search-highlight {
            background-color: #ffeb3b;
            color: #000;
            padding: 0 2px;
            border-radius: 2px;
        }
        .search-highlight.current-highlight {
            background-color: #ff9800;
            color: #fff;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
})();