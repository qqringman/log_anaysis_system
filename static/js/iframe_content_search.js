// iframe 內容搜尋功能
(function() {
    let searchHighlights = [];
    let currentHighlightIndex = 0;
    let searchKeyword = '';
    let isSearching = false; // 新增：防止重複搜尋

    // 監聽來自父視窗的搜尋訊息
    window.addEventListener('message', function(event) {
        // 防止重複處理
        if (isSearching) {
            console.log('搜尋進行中，忽略新請求');
            return;
        }
        
        if (event.data.type === 'jump-to-line') {
            const { lineNumber, matchIndex } = event.data;
            jumpToLine(lineNumber, matchIndex);
        }
        else if (event.data.type === 'search') {
            isSearching = true;
            const { options } = event.data;
            
            // 延遲執行，確保 DOM 穩定
            setTimeout(() => {
                performSearch(options);
                isSearching = false;
            }, 100);
        } else if (event.data.type === 'clear-search') {
            clearHighlights();
        } else if (event.data.type === 'next-result') {
            navigateToNext();
        } else if (event.data.type === 'prev-result') {
            navigateToPrev();
        }
    });

    function jumpToLine(lineNumber, matchIndex) {
        // 找到對應的高亮元素
        if (searchHighlights[matchIndex]) {
            scrollToHighlight(matchIndex);
        }
    }

    function performSearch(options) {
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
        if (!searchKeyword) return;

        const results = [];
        const regex = createSearchRegex(searchKeyword, options);
        
        // 獲取所有文字行
        const lines = document.body.innerText.split('\n');
        
        lines.forEach((line, lineIndex) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                results.push({
                    lineNumber: lineIndex + 1,
                    content: line,
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                    matchText: match[0]
                });
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
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
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
                results: results // 傳送行號和內容
            }, '*');
        } else {
            window.parent.postMessage({
                type: 'search-results',
                count: 0,
                keyword: searchKeyword,
                results: []
            }, '*');
        }
    }

    function createSearchRegex(keyword, options) {
        let flags = 'g';
        if (!options.caseSensitive) flags += 'i';
        
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