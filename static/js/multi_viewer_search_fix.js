// 多檔案檢視器搜尋功能增強
(function() {
    console.log('搜尋功能增強模組已載入');
    
    // 覆蓋原本的 performSearch 函數
    const originalPerformSearch = window.performSearch;
    
    window.performSearch = function() {
        console.log('執行增強版搜尋');
        
        // 清除之前的超時
        if (window.searchTimeout) {
            clearTimeout(window.searchTimeout);
            window.searchTimeout = null;
        }
        
        const searchModal = document.getElementById('search-modal');
        if (!searchModal || !searchModal.classList.contains('show')) {
            console.log('搜尋對話框未開啟');
            return;
        }
        
        const keyword = document.getElementById('search-keyword');
        if (!keyword) {
            console.error('找不到搜尋關鍵字輸入框');
            return;
        }
        
        const keywordValue = keyword.value ? keyword.value.trim() : '';
        
        // 同步關鍵字到所有 iframe
        syncKeywordToAllIframes(keywordValue);
        
        const scopeElement = document.getElementById('search-scope');
        const scope = scopeElement ? scopeElement.value : 'active';
        const caseSensitive = document.getElementById('search-case-sensitive')?.checked || false;
        const wholeWord = document.getElementById('search-whole-word')?.checked || false;
        const regex = document.getElementById('search-regex')?.checked || false;
        
        console.log('搜尋參數:', { keywordValue, scope, caseSensitive, wholeWord, regex });
        
        const resultsDiv = document.getElementById('search-results');
        const searchStats = document.getElementById('search-stats');
        
        if (!resultsDiv) {
            console.error('搜尋結果容器不存在');
            return;
        }
        
        if (!keywordValue) {
            resultsDiv.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>輸入關鍵字開始搜尋檔案內容</p>
                </div>
            `;
            if (searchStats) searchStats.style.display = 'none';
            return;
        }
        
        // 顯示載入中
        resultsDiv.innerHTML = `
            <div class="search-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>正在搜尋檔案內容...</p>
            </div>
        `;
        
        if (searchStats) searchStats.style.display = 'none';
        
        // 重置搜尋結果
        window.enhancedSearchResults = [];
        window.currentSearchIndex = 0;
        
        // 延遲執行搜尋
        window.searchTimeout = setTimeout(() => {
            executeEnhancedSearch(keywordValue, scope, caseSensitive, wholeWord, regex);
        }, 300);
    };
    
    // 執行增強搜尋
    function executeEnhancedSearch(keyword, scope, caseSensitive, wholeWord, regex) {
        console.log('執行增強搜尋:', { keyword, scope });
        
        const searchOptions = {
            keyword,
            scope,
            caseSensitive,
            wholeWord,
            regex
        };
        
        // 清理之前的監聽器
        if (window.enhancedSearchHandler) {
            window.removeEventListener('message', window.enhancedSearchHandler);
            window.enhancedSearchHandler = null;
        }
        
        // 重置搜尋狀態
        window.enhancedPendingResults = [];
        window.enhancedResultsReceived = 0;
        window.enhancedExpectedResults = 0;
        
        // 計算預期的結果數量
        if (scope === 'all' && window.splitView) {
            window.enhancedExpectedResults = 2;
        } else {
            window.enhancedExpectedResults = 1;
        }
        
        // 創建訊息處理器
        const messageHandler = function(event) {
            if (event.data.type === 'search-results') {
                console.log('收到搜尋結果:', event.data);
                
                if (event.data.keyword !== keyword) {
                    console.log('忽略舊的搜尋結果');
                    return;
                }
                
                // 處理結果，確保有正確的 pane 資訊
                const processedResults = processSearchResults(
                    event.data.results, 
                    event.data.pane || (window.splitView ? null : 'main')
                );
                
                window.enhancedPendingResults.push({
                    ...event.data,
                    results: processedResults,
                    pane: event.data.pane || 'main'
                });
                
                window.enhancedResultsReceived++;
                
                if (window.enhancedResultsReceived >= window.enhancedExpectedResults) {
                    // 合併所有結果
                    const mergedResults = mergeSearchResults(window.enhancedPendingResults);
                    
                    console.log('合併後的搜尋結果:', mergedResults);
                    
                    // 顯示結果
                    const searchModal = document.getElementById('search-modal');
                    if (searchModal && searchModal.classList.contains('show')) {
                        displayEnhancedSearchResults(mergedResults);
                    }
                    
                    // 清理
                    window.removeEventListener('message', messageHandler);
                    window.enhancedSearchHandler = null;
                    window.enhancedPendingResults = [];
                    window.enhancedResultsReceived = 0;
                }
            }
        };
        
        window.enhancedSearchHandler = messageHandler;
        window.addEventListener('message', messageHandler);
        
        // 執行搜尋
        if (scope === 'all' && window.splitView) {
            searchInPane('left', searchOptions);
            searchInPane('right', searchOptions);
        } else if (scope === 'left') {
            searchInPane('left', searchOptions);
        } else if (scope === 'right') {
            searchInPane('right', searchOptions);
        } else {
            searchInActiveTab(searchOptions);
        }
        
        // 設置超時
        setTimeout(() => {
            const resultsDiv = document.getElementById('search-results');
            if (resultsDiv && resultsDiv.querySelector('.search-loading')) {
                if (window.enhancedPendingResults.length > 0) {
                    const mergedResults = mergeSearchResults(window.enhancedPendingResults);
                    displayEnhancedSearchResults(mergedResults);
                } else {
                    resultsDiv.innerHTML = `
                        <div class="no-results">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>搜尋超時，請重試</p>
                        </div>
                    `;
                }
                
                if (window.enhancedSearchHandler) {
                    window.removeEventListener('message', window.enhancedSearchHandler);
                    window.enhancedSearchHandler = null;
                }
            }
        }, 5000);
    }
    
    // 處理搜尋結果，確保有行號
    function processSearchResults(results, pane) {
        if (!results || !Array.isArray(results)) return [];
        
        // 檢查是否為單檔模式
        const isSingleFileMode = !window.splitView;
        
        return results.map((result, index) => {
            // 確保有行號
            let lineNumber = result.lineNumber;
            
            // 如果沒有 lineNumber，嘗試從其他欄位獲取
            if (!lineNumber) {
                if (result.line) lineNumber = result.line;
                else if (result.lineNo) lineNumber = result.lineNo;
                else if (result.content) {
                    // 嘗試從內容解析行號
                    const match = result.content.match(/^(\d+)[:：]/);
                    if (match) lineNumber = parseInt(match[1]);
                }
            }
            
            // 如果還是沒有行號，使用索引 + 1
            if (!lineNumber) {
                lineNumber = index + 1;
            }
            
            // 單檔模式強制使用 'main' 作為 pane
            const resultPane = isSingleFileMode ? 'main' : (result.pane || pane || 'main');
            
            return {
                ...result,
                lineNumber: lineNumber,
                pane: resultPane,
                uniqueId: `${resultPane}-${lineNumber}-${index}`,
                // 保存原始的 pane 資訊（如果有）
                originalPane: result.pane || pane
            };
        });
    }
    
    // 合併搜尋結果
    function mergeSearchResults(pendingResults) {
        const merged = {
            keyword: pendingResults[0]?.keyword || '',
            results: [],
            count: 0
        };
        
        pendingResults.forEach(result => {
            if (result.results && result.results.length > 0) {
                merged.results = merged.results.concat(result.results);
                merged.count += result.results.length;
            }
        });
        
        return merged;
    }
    
    // 顯示增強搜尋結果
    function displayEnhancedSearchResults(data) {
        console.log('顯示增強搜尋結果:', data);
        
        const resultsDiv = document.getElementById('search-results');
        const searchStats = document.getElementById('search-stats');
        
        if (!resultsDiv) return;
        
        window.enhancedSearchResults = data.results || [];
        window.currentSearchIndex = 0;
        
        resultsDiv.innerHTML = '';
        
        if (window.enhancedSearchResults.length > 0) {
            // 顯示統計
            if (searchStats) {
                searchStats.style.display = 'flex';
                const searchCount = document.getElementById('search-count');
                const searchLines = document.getElementById('search-lines');
                
                if (searchCount) searchCount.textContent = window.enhancedSearchResults.length;
                if (searchLines) {
                    const uniqueLines = new Set(window.enhancedSearchResults.map(r => r.lineNumber));
                    searchLines.textContent = uniqueLines.size;
                }
            }
            
            // 啟用導航按鈕
            const prevBtn = document.getElementById('prev-search-btn');
            const nextBtn = document.getElementById('next-search-btn');
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
            
            // 根據模式顯示結果
            if (window.splitView && hasMultiplePanes(window.enhancedSearchResults)) {
                // 分割視窗模式且有多個面板的結果
                displayGroupedResults(resultsDiv, window.enhancedSearchResults, data.keyword);
            } else {
                // 單檔模式或只有一個面板的結果
                displayFlatResults(resultsDiv, window.enhancedSearchResults, data.keyword);
            }
            
            updateSearchNavigation();
        } else {
            if (searchStats) searchStats.style.display = 'none';
            resultsDiv.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>沒有找到「${data.keyword || ''}」的相關結果</p>
                </div>
            `;
            
            const prevBtn = document.getElementById('prev-search-btn');
            const nextBtn = document.getElementById('next-search-btn');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
        }
    }

    // 輔助函數：檢查是否有多個面板的結果
    function hasMultiplePanes(results) {
        const panes = new Set(results.map(r => r.pane));
        return panes.size > 1;
    }

    // 分組顯示結果
    function displayGroupedResults(container, results, keyword) {
        const grouped = {};
        
        results.forEach(result => {
            const source = result.pane || 'main';
            if (!grouped[source]) {
                grouped[source] = [];
            }
            grouped[source].push(result);
        });
        
        let html = '<div class="search-results-tabs">';
        
        let firstTab = true;
        Object.keys(grouped).forEach(source => {
            const tabName = source === 'left' ? '左側視窗' : 
                        source === 'right' ? '右側視窗' : '主視窗';
            const icon = source === 'left' ? 'fa-arrow-left' : 
                        source === 'right' ? 'fa-arrow-right' : 'fa-file';
            
            html += `
                <button class="search-results-tab ${firstTab ? 'active' : ''}" 
                        onclick="switchEnhancedSearchTab('${source}')">
                    <i class="fas ${icon}"></i> ${tabName}
                    <span class="tab-count">${grouped[source].length}</span>
                </button>
            `;
            firstTab = false;
        });
        
        html += '</div><div class="search-results-content">';
        
        let firstPane = true;
        Object.keys(grouped).forEach(source => {
            html += `
                <div class="search-results-pane ${firstPane ? 'active' : ''}" 
                    id="search-results-${source}">
                    ${renderSearchResultsList(results, keyword, source)}  <!-- 傳入完整的 results -->
                </div>
            `;
            firstPane = false;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // 平面顯示結果
    function displayFlatResults(container, results, keyword) {
        // 單檔模式直接顯示所有結果，不分組
        container.innerHTML = `
            <div class="search-results-single">
                ${renderSearchResultsList(results, keyword, 'main')}
            </div>
        `;
    }
    
    // 渲染搜尋結果列表
    function renderSearchResultsList(results, keyword, source) {
        if (!results || results.length === 0) {
            return '<div class="no-results"><i class="fas fa-search"></i><p>沒有找到結果</p></div>';
        }
        
        // 如果有 source，只顯示該 source 的結果，但保持全域索引
        let filteredResults = results;
        if (source && source !== 'all') {
            filteredResults = results.map((result, globalIndex) => ({
                ...result,
                globalIndex: globalIndex  // 保存全域索引
            })).filter(result => result.pane === source || (!result.pane && source === 'main'));
        } else {
            // 沒有 source 時，添加全域索引
            filteredResults = results.map((result, globalIndex) => ({
                ...result,
                globalIndex: globalIndex
            }));
        }
        
        if (filteredResults.length === 0) {
            return '<div class="no-results"><i class="fas fa-search"></i><p>沒有找到結果</p></div>';
        }
        
        // 為同一行的多個結果添加索引
        const lineMatches = {};
        
        filteredResults.forEach(result => {
            const lineNum = result.lineNumber;
            if (!lineMatches[lineNum]) {
                lineMatches[lineNum] = 0;
            }
            
            result.matchNumberInLine = lineMatches[lineNum]++;
            result.totalMatchesInLine = filteredResults.filter(r => r.lineNumber === lineNum).length;
        });
        
        const html = filteredResults.map((result) => {
            const index = result.globalIndex !== undefined ? result.globalIndex : results.indexOf(result);
            
            // 如果同一行有多個匹配，顯示匹配編號
            let matchInfo = '';
            if (result.totalMatchesInLine > 1) {
                matchInfo = ` <span class="match-info">(第 ${result.matchNumberInLine + 1}/${result.totalMatchesInLine} 個)</span>`;
            }
            
            // 高亮特定的匹配
            let highlightedContent = result.content || result.lineText || '';
            if (result.matchStart !== undefined && result.matchEnd !== undefined) {
                highlightedContent = 
                    escapeHtml(highlightedContent.substring(0, result.matchStart)) + 
                    '<span class="highlight">' + 
                    escapeHtml(highlightedContent.substring(result.matchStart, result.matchEnd)) + 
                    '</span>' + 
                    escapeHtml(highlightedContent.substring(result.matchEnd));
            } else {
                highlightedContent = highlightKeyword(highlightedContent, keyword);
            }
            
            return `
                <div class="search-result-item ${index === window.currentSearchIndex ? 'active' : ''}" 
                    data-index="${index}"
                    data-line="${result.lineNumber}"
                    data-match-index="${result.matchNumberInLine || 0}"
                    data-pane="${result.pane || 'main'}"
                    onclick="window.jumpToEnhancedResult(${index})">
                    <div class="search-result-header">
                        <div class="search-result-line">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>行號</span>
                            <span class="line-number">${result.lineNumber}</span>
                            ${matchInfo}
                        </div>
                    </div>
                    <div class="search-result-content">
                        ${highlightedContent}
                    </div>
                </div>
            `;
        }).join('');
        
        // 在返回 HTML 之前，設置事件監聽器
        setTimeout(() => {
            setupSearchResultClickHandlers();
        }, 100);
        
        return html;
    }

    // 輔助函數：轉義 HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 高亮搜尋關鍵字
    function highlightSearchKeyword(text, keyword) {
        if (!keyword) return text;
        
        try {
            const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            return text;
        }
    }
    
    // 轉義正則表達式特殊字符
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    window.jumpToEnhancedResult = function(index) {
        console.log('跳轉到搜尋結果:', index);
        
        if (!window.enhancedSearchResults || index >= window.enhancedSearchResults.length) {
            console.error('無效的搜尋結果索引');
            return;
        }
        
        const result = window.enhancedSearchResults[index];
        if (!result) return;
        
        console.log('搜尋結果詳情:', result);
        
        // 更新當前索引
        window.currentSearchIndex = index;
        
        // 更新高亮
        setTimeout(() => {
            document.querySelectorAll('.search-result-item').forEach((item) => {
                const itemIndex = parseInt(item.dataset.index);
                if (itemIndex === index) {
                    item.classList.add('active');
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        }, 100);
        
        // 更新導航計數
        updateSearchNavigation();
        
        // 檢查是否為單檔模式
        const isSingleFileMode = !window.splitView;
        
        if (isSingleFileMode || result.pane === 'main') {
            // 單檔模式跳轉
            console.log(`單檔模式跳轉到第 ${result.lineNumber} 行`);
            
            // 方法1：如果有 activeTabId，使用標籤系統
            if (window.activeTabId && window.currentTabs) {
                const tab = window.currentTabs.find(t => t.id === window.activeTabId);
                if (tab && tab.content) {
                    const iframe = tab.content.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        sendJumpMessage(iframe, result);
                        return;
                    }
                }
            }
            
            // 方法2：直接從 DOM 尋找 iframe
            const fileViewer = document.getElementById('file-viewer');
            if (fileViewer) {
                const iframe = fileViewer.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    sendJumpMessage(iframe, result);
                    return;
                }
            }
            
            // 方法3：尋找任何可見的 iframe
            const allIframes = document.querySelectorAll('iframe');
            for (const iframe of allIframes) {
                if (iframe.offsetParent !== null && iframe.contentWindow) {
                    sendJumpMessage(iframe, result);
                    break;
                }
            }
        } else if (window.splitView && result.pane && (result.pane === 'left' || result.pane === 'right')) {
            // 分割視窗模式跳轉
            console.log(`跳轉到 ${result.pane} 視窗的第 ${result.lineNumber} 行`);
            
            const content = document.getElementById(`split-${result.pane}-content`);
            if (content) {
                const iframe = content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    sendJumpMessage(iframe, result);
                }
            }
        }
    };

    // 輔助函數：發送跳轉訊息
    function sendJumpMessage(iframe, result) {
        try {
            iframe.contentWindow.postMessage({
                type: 'jump-to-line',
                lineNumber: result.lineNumber,
                matchIndex: result.matchIndex || result.matchNumberInLine || 0,
                highlight: true
            }, '*');
            
            // 視覺反饋
            iframe.style.transition = 'box-shadow 0.3s ease';
            iframe.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.8)';
            setTimeout(() => {
                iframe.style.boxShadow = '';
            }, 1000);
            
            if (window.showToast) {
                window.showToast(`已跳轉到第 ${result.lineNumber} 行`, 'info');
            }
        } catch (error) {
            console.error('發送跳轉訊息失敗:', error);
        }
    }

    // 跳轉到增強搜尋結果
    window.jumpToEnhancedSearchResult = function(index, lineNumber, source) {
        console.log('跳轉到增強搜尋結果:', { index, lineNumber, source });
        
        // 更新當前索引
        window.currentSearchIndex = index;
        updateSearchNavigation();
        
        // 高亮當前結果
        document.querySelectorAll('.search-result-item').forEach((item, i) => {
            if (parseInt(item.dataset.index) === index) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
        
        // 關閉搜尋對話框
        if (window.closeSearchModal) {
            window.closeSearchModal();
        }
        
        // 延遲執行跳轉
        setTimeout(() => {
            if (window.splitView && source && (source === 'left' || source === 'right')) {
                jumpToLineInPane(lineNumber, source);
            } else {
                jumpToLineInActiveTab(lineNumber);
            }
        }, 100);
    };
    
    // 跳轉到分割視窗中的指定行
    function jumpToLineInPane(lineNumber, pane, matchIndex) {
        const content = document.getElementById(`split-${pane}-content`);
        if (!content) return;
        
        const iframe = content.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) return;
        
        console.log(`發送跳轉訊息到 ${pane} 視窗: 行號 ${lineNumber}`);
        
        iframe.contentWindow.postMessage({
            type: 'jump-to-line',
            lineNumber: lineNumber,
            matchIndex: matchIndex,
            highlight: true
        }, '*');
    }
    
    // 跳轉到主視窗中的指定行
    function jumpToLineInActiveTab(lineNumber, matchIndex) {
        if (!window.activeTabId) return;
        
        const tab = window.currentTabs.find(t => t.id === window.activeTabId);
        if (!tab || !tab.content) return;
        
        const iframe = tab.content.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) return;
        
        console.log(`發送跳轉訊息到主視窗: 行號 ${lineNumber}`);
        
        iframe.contentWindow.postMessage({
            type: 'jump-to-line',
            lineNumber: lineNumber,
            matchIndex: matchIndex,
            highlight: true
        }, '*');
    }
    
    // 切換搜尋頁籤
    window.switchEnhancedSearchTab = function(tab) {
        console.log('切換到頁籤:', tab);
        
        document.querySelectorAll('.search-results-tab').forEach(t => {
            t.classList.remove('active');
        });
        
        const clickedTab = Array.from(document.querySelectorAll('.search-results-tab'))
            .find(t => t.onclick && t.onclick.toString().includes(`'${tab}'`));
        
        if (clickedTab) {
            clickedTab.classList.add('active');
        }
        
        document.querySelectorAll('.search-results-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const targetPane = document.getElementById(`search-results-${tab}`);
        if (targetPane) {
            targetPane.classList.add('active');
            
            // === 新增：切換頁籤後重新高亮當前結果 ===
            setTimeout(() => {
                if (window.currentSearchIndex !== undefined) {
                    document.querySelectorAll('.search-result-item').forEach((item) => {
                        const itemIndex = parseInt(item.dataset.index);
                        if (itemIndex === window.currentSearchIndex) {
                            item.classList.add('active');
                            // 如果當前結果在這個頁籤中，滾動到可見
                            if (item.offsetParent !== null) {
                                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                        } else {
                            item.classList.remove('active');
                        }
                    });
                }
            }, 50);
        }
    };
    
    // 覆蓋全域的導航函數
    window.prevSearchResult = function() {
        console.log('上一個搜尋結果');
        
        if (!window.enhancedSearchResults || window.enhancedSearchResults.length === 0) {
            console.log('沒有搜尋結果');
            return;
        }
        
        window.currentSearchIndex--;
        if (window.currentSearchIndex < 0) {
            window.currentSearchIndex = window.enhancedSearchResults.length - 1;
        }
        
        jumpToCurrentResult();
    };

    window.nextSearchResult = function() {
        console.log('下一個搜尋結果');
        
        if (!window.enhancedSearchResults || window.enhancedSearchResults.length === 0) {
            console.log('沒有搜尋結果');
            return;
        }
        
        window.currentSearchIndex++;
        if (window.currentSearchIndex >= window.enhancedSearchResults.length) {
            window.currentSearchIndex = 0;
        }
        
        jumpToCurrentResult();
    };

    // 跳轉到當前索引的結果
    function jumpToCurrentResult() {
        if (!window.enhancedSearchResults || window.currentSearchIndex >= window.enhancedSearchResults.length) {
            return;
        }
        
        // 使用已定義的跳轉函數
        window.jumpToEnhancedResult(window.currentSearchIndex);
    }

    // 高亮當前搜尋結果
    function highlightCurrentSearchResult() {
        // 移除所有高亮
        document.querySelectorAll('.search-result-item').forEach((item, index) => {
            if (index === window.currentSearchIndex) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
        
        // 更新計數顯示
        updateSearchNavigation();
    }

    // 跳轉到當前搜尋結果
    function jumpToCurrentSearchResult() {
        if (!window.searchResultsData || window.currentSearchIndex >= window.searchResultsData.length) return;
        
        const result = window.searchResultsData[window.currentSearchIndex];
        if (result) {
            jumpToSearchResult(window.currentSearchIndex, result.lineNumber);
        }
    }

    // 更新搜尋導航狀態
    function updateSearchNavigation() {
        const countElement = document.querySelector('.search-result-count');
        if (countElement) {
            if (window.enhancedSearchResults && window.enhancedSearchResults.length > 0) {
                if (window.currentSearchIndex >= window.enhancedSearchResults.length) {
                    window.currentSearchIndex = 0;
                } else if (window.currentSearchIndex < 0) {
                    window.currentSearchIndex = window.enhancedSearchResults.length - 1;
                }
                
                countElement.textContent = `${window.currentSearchIndex + 1} / ${window.enhancedSearchResults.length}`;
            } else {
                countElement.textContent = '0 / 0';
            }
        }
    }

    // 跳轉到搜尋結果
    window.jumpToSearchResult = function(index, lineNumber) {
        console.log('跳轉到搜尋結果:', { index, lineNumber });
        
        // 更新當前索引
        window.currentSearchIndex = index;
        
        // 高亮當前結果
        highlightCurrentSearchResult();
        
        // 根據當前模式跳轉
        if (window.splitView) {
            // 分割視窗模式
            const result = window.searchResultsData[index];
            if (result && result.pane) {
                jumpToLineInPane(lineNumber, result.pane, result.matchNumberInLine);
            } else {
                // 嘗試在當前活動的面板跳轉
                const leftContent = document.getElementById('split-left-content');
                const rightContent = document.getElementById('split-right-content');
                
                if (leftContent && leftContent.dataset.filePath) {
                    jumpToLineInPane(lineNumber, 'left', result.matchNumberInLine);
                } else if (rightContent && rightContent.dataset.filePath) {
                    jumpToLineInPane(lineNumber, 'right', result.matchNumberInLine);
                }
            }
        } else {
            // 一般模式
            jumpToLineInActiveTab(lineNumber, index);
        }
    }; 
    
    // 在特定面板中搜尋
    function searchInPane(pane, options) {
        console.log(`在 ${pane} 面板搜尋:`, options);
        
        const content = document.getElementById(`split-${pane}-content`);
        const iframe = content?.querySelector('iframe');
        
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({
                    type: 'search',
                    options: options,
                    pane: pane,  // 確保傳遞 pane 資訊
                    source: 'enhanced-search'
                }, '*');
                console.log(`已發送搜尋請求到 ${pane} 面板`);
            } catch (error) {
                console.error(`發送搜尋請求失敗 (${pane}):`, error);
            }
        } else {
            console.warn(`找不到 ${pane} 面板的 iframe`);
            // 如果找不到 iframe，仍然要處理結果
            window.postMessage({
                type: 'search-results',
                keyword: options.keyword,
                results: [],
                count: 0,
                pane: pane  // 確保傳遞 pane 資訊
            }, '*');
        }
    }
    
    // 在活動標籤中搜尋
    function searchInActiveTab(options) {
        console.log('在活動標籤中搜尋:', options);
        
        if (window.activeTabId) {
            const tab = window.currentTabs.find(t => t.id === window.activeTabId);
            if (tab && tab.content) {
                const iframe = tab.content.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'search',
                            options: options,
                            source: 'enhanced-search'
                        }, '*');
                        console.log('已發送搜尋請求到活動標籤');
                    } catch (error) {
                        console.error('發送搜尋請求失敗:', error);
                    }
                }
            }
        }
        else{
            console.log('沒有 activeTabId，嘗試直接從 DOM 尋找 iframe');
            
            // 方法1：從主檔案檢視器容器尋找 iframe
            const fileViewer = document.getElementById('file-viewer');
            if (fileViewer) {
                const iframe = fileViewer.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    console.log('從 file-viewer 找到 iframe');
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'search',
                            options: options,
                            pane: 'main',
                            source: 'enhanced-search'
                        }, '*');
                        console.log('已發送搜尋請求到 iframe');
                        return;
                    } catch (error) {
                        console.error('發送搜尋請求失敗:', error);
                    }
                }
            }
            
            // 方法2：尋找所有可見的 iframe
            const allIframes = document.querySelectorAll('iframe');
            console.log('找到的 iframe 數量:', allIframes.length);
            
            let foundIframe = false;
            allIframes.forEach((iframe, index) => {
                // 檢查 iframe 是否可見且有內容
                if (iframe.offsetParent !== null && iframe.contentWindow) {
                    console.log(`嘗試發送到第 ${index + 1} 個 iframe`);
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'search',
                            options: options,
                            pane: 'main',
                            source: 'enhanced-search'
                        }, '*');
                        foundIframe = true;
                        console.log(`成功發送搜尋請求到第 ${index + 1} 個 iframe`);
                    } catch (error) {
                        console.error(`發送到第 ${index + 1} 個 iframe 失敗:`, error);
                    }
                }
            });
            
            if (!foundIframe) {
                console.error('找不到任何可用的 iframe');
                // 發送空結果以避免卡住
                window.postMessage({
                    type: 'search-results',
                    keyword: options.keyword,
                    results: [],
                    count: 0,
                    pane: 'main'
                }, '*');
            }           
        }
    }
    
    // 同步關鍵字到所有 iframe
    function syncKeywordToAllIframes(keyword) {
        console.log('同步關鍵字到所有 iframe:', keyword);
        
        if (window.currentTabs) {
            window.currentTabs.forEach(tab => {
                if (tab.content) {
                    const iframe = tab.content.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        try {
                            iframe.contentWindow.postMessage({
                                type: 'sync-search-input',
                                keyword: keyword,
                                targetId: 'search-input'
                            }, '*');
                        } catch (error) {
                            console.warn('無法同步到標籤:', error);
                        }
                    }
                }
            });
        }
        
        if (window.splitView) {
            ['left', 'right'].forEach(pane => {
                const content = document.getElementById(`split-${pane}-content`);
                if (content) {
                    const iframe = content.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        try {
                            iframe.contentWindow.postMessage({
                                type: 'sync-search-input',
                                keyword: keyword,
                                targetId: 'search-input'
                            }, '*');
                        } catch (error) {
                            console.warn(`無法同步到 ${pane} 視窗:`, error);
                        }
                    }
                }
            });
        }
    }
    
})();