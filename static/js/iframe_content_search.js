// iframe 內容搜尋功能
(function() {
    let searchHighlights = [];
    let currentHighlightIndex = 0;
    let searchKeyword = '';

    // 監聽來自父視窗的搜尋訊息
    window.addEventListener('message', function(event) {
        if (event.data.type === 'search') {
            const { options } = event.data;
            performSearch(options);
        } else if (event.data.type === 'clear-search') {
            clearHighlights();
        } else if (event.data.type === 'next-result') {
            navigateToNext();
        } else if (event.data.type === 'prev-result') {
            navigateToPrev();
        }
    });

    function performSearch(options) {
        // 清除之前的高亮
        clearHighlights();
        
        searchKeyword = options.keyword;
        if (!searchKeyword) return;

        const content = document.body.innerText || document.body.textContent || '';
        const regex = createSearchRegex(searchKeyword, options);
        
        // 查找所有匹配
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

            let match;
            const matches = [];
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

        // 更新計數並跳到第一個結果
        if (searchHighlights.length > 0) {
            currentHighlightIndex = 0;
            scrollToHighlight(0);
            
            // 通知父視窗搜尋結果
            window.parent.postMessage({
                type: 'search-results',
                count: searchHighlights.length,
                keyword: searchKeyword
            }, '*');
        } else {
            window.parent.postMessage({
                type: 'search-results',
                count: 0,
                keyword: searchKeyword
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
            searchHighlights.push(span);
            
            lastIndex = match.end;
        });
        
        // 添加剩餘的文本
        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
            );
        }
        
        parent.replaceChild(fragment, textNode);
    }

    function clearHighlights() {
        searchHighlights.forEach(highlight => {
            const parent = highlight.parentNode;
            const text = highlight.textContent;
            const textNode = document.createTextNode(text);
            parent.replaceChild(textNode, highlight);
            parent.normalize();
        });
        searchHighlights = [];
        currentHighlightIndex = 0;
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