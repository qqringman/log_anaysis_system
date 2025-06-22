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
        console.log('跳轉到行號:', lineNumber, '匹配索引:', matchIndex);
        
        lineNumber = parseInt(lineNumber);
        if (!lineNumber || lineNumber < 1) return;
        
        // 直接尋找行元素
        const lineElement = document.getElementById(`line-${lineNumber}`);
        if (lineElement) {
            // 滾動到元素
            lineElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // 添加臨時高亮效果
            lineElement.classList.add('highlight-flash');
            setTimeout(() => {
                lineElement.classList.remove('highlight-flash');
            }, 2000);
            
            // 如果有特定的匹配索引，嘗試找到並高亮特定的匹配
            if (typeof matchIndex === 'number' && matchIndex >= 0) {
                // 找到該行內的所有高亮元素
                const lineHighlights = lineElement.querySelectorAll('.search-highlight');
                if (lineHighlights[matchIndex]) {
                    // 特別標記這個高亮
                    lineHighlights[matchIndex].classList.add('current-highlight');
                    lineHighlights[matchIndex].scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
            }
            
            return true;
        } else {
            console.warn('找不到行元素:', `line-${lineNumber}`);
            // 嘗試其他方式跳轉
            addLineHighlight(lineNumber);
            return false;
        }
    }

    // 新增行高亮效果
    function addLineHighlight(lineNumber) {
        // 創建或更新樣式
        let style = document.getElementById('temp-line-highlight-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'temp-line-highlight-style';
            document.head.appendChild(style);
        }
        
        style.textContent = `
            @keyframes flash-highlight {
                0% { background-color: #ffeb3b; }
                50% { background-color: #fff59d; }
                100% { background-color: transparent; }
            }
            .temp-line-highlight {
                animation: flash-highlight 2s ease-out;
            }
        `;
        
        // 嘗試找到並高亮對應的元素
        setTimeout(() => {
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                if (el.innerText && el.innerText.includes(searchKeyword)) {
                    el.classList.add('temp-line-highlight');
                    setTimeout(() => {
                        el.classList.remove('temp-line-highlight');
                    }, 2000);
                }
            });
        }, 300);
    }

    // 根據行號跳轉
    function jumpToLineNumber(targetLine) {
        console.log('跳轉到行號:', targetLine);
        
        const textContent = document.body.innerText || document.body.textContent || '';
        const lines = textContent.split('\n');
        
        if (targetLine > lines.length) {
            console.warn('行號超出範圍');
            return;
        }
        
        // 創建一個臨時元素來計算位置
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.whiteSpace = 'pre-wrap';
        tempDiv.style.width = document.body.clientWidth + 'px';
        document.body.appendChild(tempDiv);
        
        // 計算目標行的大概位置
        let textUpToLine = lines.slice(0, targetLine - 1).join('\n');
        tempDiv.textContent = textUpToLine;
        const approximateY = tempDiv.offsetHeight;
        
        document.body.removeChild(tempDiv);
        
        // 滾動到計算出的位置
        window.scrollTo({
            top: approximateY,
            behavior: 'smooth'
        });
        
        // 嘗試高亮該行
        highlightLine(targetLine);
    }

    // 高亮指定行
    function highlightLine(lineNumber) {
        // 清除之前的行高亮
        document.querySelectorAll('.line-highlight').forEach(el => {
            el.classList.remove('line-highlight');
        });
        
        // 添加臨時高亮樣式
        const style = document.getElementById('line-highlight-style');
        if (!style) {
            const newStyle = document.createElement('style');
            newStyle.id = 'line-highlight-style';
            newStyle.textContent = `
                .line-highlight {
                    background-color: #ffeb3b !important;
                    animation: highlight-fade 2s ease-out;
                }
                @keyframes highlight-fade {
                    0% { background-color: #ffeb3b; }
                    100% { background-color: transparent; }
                }
            `;
            document.head.appendChild(newStyle);
        }
        
        // 嘗試找到並高亮該行的元素
        // 這部分可能需要根據實際的 HTML 結構調整
        const allTextNodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        let currentLine = 1;
        
        while (node = walker.nextNode()) {
            const text = node.textContent;
            const lines = text.split('\n');
            
            if (currentLine <= lineNumber && lineNumber < currentLine + lines.length) {
                // 找到包含目標行的節點
                if (node.parentElement) {
                    node.parentElement.classList.add('line-highlight');
                    node.parentElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
                break;
            }
            
            currentLine += lines.length - 1;
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
        
        // 方法1：使用儲存的高亮陣列
        searchHighlights.forEach(highlight => {
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
        
        // 方法2：額外的清理 - 移除所有殘留的高亮
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
        eventData = eventData || {};
        
        // 清理現有高亮
        clearHighlights();
        
        searchKeyword = options.keyword;
        if (!searchKeyword) {
            isSearching = false;
            return;
        }

        console.log('搜尋檔案內容:', options);
        const results = [];
        
        try {
            const regex = createSearchRegex(searchKeyword, options);
            
            // 搜尋所有帶有 line-xxx id 的元素
            const lineElements = document.querySelectorAll('[id^="line-"]');
            console.log('找到行元素數量:', lineElements.length);
            
            lineElements.forEach(lineElement => {
                // 從 id 中提取行號
                const lineNumber = parseInt(lineElement.id.replace('line-', ''));
                if (isNaN(lineNumber)) return;
                
                // 獲取行內容（可能在 .line-content 元素中）
                let lineContent = '';
                const contentElement = lineElement.querySelector('.line-content');
                if (contentElement) {
                    lineContent = contentElement.textContent || contentElement.innerText || '';
                } else {
                    lineContent = lineElement.textContent || lineElement.innerText || '';
                }
                
                // 搜尋匹配
                let match;
                regex.lastIndex = 0;
                
                while ((match = regex.exec(lineContent)) !== null) {
                    // 為每個匹配創建一個結果
                    results.push({
                        lineNumber: lineNumber,
                        content: lineContent.trim() || lineContent,
                        matchStart: match.index,
                        matchEnd: match.index + match[0].length,
                        matchText: match[0],
                        pane: eventData.pane || null,
                        // 移除 lineElement，因為 DOM 元素無法被序列化
                        // lineElement: lineElement,  // 移除這行
                        matchIndex: match.index,
                        fullMatch: {
                            start: match.index,
                            end: match.index + match[0].length,
                            text: match[0]
                        }
                    });
                    
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                }
            });

            console.log('搜尋結果數量:', results.length);

            // 高亮顯示
            if (results.length > 0) {
                highlightSearchResultsInElements(results, regex);
            }
            
            // 回傳結果給父視窗
            window.parent.postMessage({
                type: 'search-results',
                count: results.length,
                keyword: searchKeyword,
                results: results,
                pane: eventData.pane || null,
                source: 'iframe-content'
            }, '*');
            
        } catch (error) {
            console.error('搜尋錯誤:', error);
            window.parent.postMessage({
                type: 'search-error',
                message: error.message
            }, '*');
        } finally {
            isSearching = false;
        }
    }

    // 在元素中高亮搜尋結果
    function highlightSearchResultsInElements(results, regex) {
        // 按行號分組結果
        const resultsByLine = {};
        results.forEach(result => {
            if (!resultsByLine[result.lineNumber]) {
                resultsByLine[result.lineNumber] = [];
            }
            resultsByLine[result.lineNumber].push(result);
        });
        
        // 處理每一行
        Object.keys(resultsByLine).forEach(lineNumber => {
            const lineResults = resultsByLine[lineNumber];
            const lineElement = document.getElementById(`line-${lineNumber}`);
            if (!lineElement) return;
            
            // 找到內容元素
            let contentElement = lineElement.querySelector('.line-content');
            if (!contentElement) {
                // 如果沒有 .line-content，可能整個元素就是內容
                contentElement = lineElement;
            }
            
            // 獲取所有文字節點
            const walker = document.createTreeWalker(
                contentElement,
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
                regex.lastIndex = 0;
                
                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        text: match[0]
                    });
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                }
                
                if (matches.length > 0) {
                    highlightMatches(node, matches);
                }
            }
        });
    }

    // 高亮搜尋結果
    function highlightSearchResults(regex) {
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
            regex.lastIndex = 0;
            
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }

            if (matches.length > 0) {
                highlightMatches(node, matches);
            }
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


// iframe 內的搜尋同步處理
(function() {
    console.log('iframe 搜尋同步腳本已載入');
    
    // 監聽來自父視窗的訊息
    window.addEventListener('message', function(event) {
        // 忽略非同步訊息
        if (!event.data || !event.data.type) return;
        
        // 處理搜尋輸入同步
        if (event.data.type === 'sync-search-input') {
            const keyword = event.data.keyword;
            const targetId = event.data.targetId || 'search-input';
            
            console.log(`同步關鍵字 "${keyword}" 到 #${targetId}`);
            
            // 找到目標輸入框
            const searchInput = document.getElementById(targetId);
            
            if (searchInput) {
                // 設置值
                searchInput.value = keyword;
                
                // 觸發事件以確保其他功能正常運作
                // 觸發 input 事件
                const inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                searchInput.dispatchEvent(inputEvent);
                
                // 觸發 change 事件
                const changeEvent = new Event('change', {
                    bubbles: true,
                    cancelable: true,
                });
                searchInput.dispatchEvent(changeEvent);
                
                // 觸發 keyup 事件（某些腳本可能監聽這個）
                const keyupEvent = new KeyboardEvent('keyup', {
                    bubbles: true,
                    cancelable: true,
                    key: keyword.slice(-1),  // 最後一個字符
                    code: 'Key' + keyword.slice(-1).toUpperCase()
                });
                searchInput.dispatchEvent(keyupEvent);
                
                console.log(`成功同步關鍵字到 #${targetId}`);
            } else {
                console.warn(`找不到 ID 為 "${targetId}" 的輸入框`);
                
                // 嘗試其他方式尋找搜尋框
                const possibleSelectors = [
                    'input#search-input',
                    'input.search-input',
                    'input[placeholder*="搜尋"]',
                    'input[type="search"]'
                ];
                
                for (const selector of possibleSelectors) {
                    const input = document.querySelector(selector);
                    if (input) {
                        console.log(`使用選擇器 "${selector}" 找到搜尋框`);
                        input.value = keyword;
                        
                        // 觸發事件
                        ['input', 'change', 'keyup'].forEach(eventType => {
                            const event = new Event(eventType, {
                                bubbles: true,
                                cancelable: true,
                            });
                            input.dispatchEvent(event);
                        });
                        
                        break;
                    }
                }
            }
        }
    });
    
    // 偵測頁面載入完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM 載入完成，搜尋同步功能已就緒');
        });
    } else {
        console.log('搜尋同步功能已就緒');
    }
})();