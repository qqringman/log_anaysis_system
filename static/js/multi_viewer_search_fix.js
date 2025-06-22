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
                
                // 處理結果，確保有行號
                const processedResults = processSearchResults(event.data.results, event.data.pane);
                
                window.enhancedPendingResults.push({
                    ...event.data,
                    results: processedResults
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
            
            return {
                ...result,
                lineNumber: lineNumber,
                pane: pane || result.pane,
                uniqueId: `${pane || 'main'}-${lineNumber}-${index}`
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
                if (searchCount) searchCount.textContent = data.count || window.enhancedSearchResults.length;
                if (searchLines) searchLines.textContent = window.enhancedSearchResults.length;
            }
            
            // 啟用導航按鈕
            const prevBtn = document.getElementById('prev-search-btn');
            const nextBtn = document.getElementById('next-search-btn');
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
            
            // 分組顯示結果
            if (window.splitView) {
                displayGroupedResults(resultsDiv, window.enhancedSearchResults, data.keyword);
            } else {
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
                    ${renderSearchResultsList(grouped[source], keyword, source)}
                </div>
            `;
            firstPane = false;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // 平面顯示結果
    function displayFlatResults(container, results, keyword) {
        container.innerHTML = renderSearchResultsList(results, keyword);
    }
    
    // 渲染搜尋結果列表
    function renderSearchResultsList(results, keyword) {
        if (!results || results.length === 0) {
            return '<div class="no-results"><i class="fas fa-search"></i><p>沒有找到結果</p></div>';
        }
        
        // 為同一行的多個結果添加索引
        const processedResults = [];
        const lineMatches = {};
        
        results.forEach(result => {
            const lineNum = result.lineNumber;
            if (!lineMatches[lineNum]) {
                lineMatches[lineNum] = 0;
            }
            
            processedResults.push({
                ...result,
                matchNumberInLine: lineMatches[lineNum]++,
                totalMatchesInLine: results.filter(r => r.lineNumber === lineNum).length
            });
        });
        
        const html = processedResults.map((result, index) => {
            // 如果同一行有多個匹配，顯示匹配編號
            let matchInfo = '';
            if (result.totalMatchesInLine > 1) {
                matchInfo = ` <span class="match-info">(第 ${result.matchNumberInLine + 1}/${result.totalMatchesInLine} 個)</span>`;
            }
            
            // 高亮特定的匹配
            let highlightedContent = result.content || result.lineText || '';
            if (result.matchStart !== undefined && result.matchEnd !== undefined) {
                // 只高亮當前這個特定的匹配
                highlightedContent = 
                    escapeHtml(highlightedContent.substring(0, result.matchStart)) + 
                    '<span class="highlight">' + 
                    escapeHtml(highlightedContent.substring(result.matchStart, result.matchEnd)) + 
                    '</span>' + 
                    escapeHtml(highlightedContent.substring(result.matchEnd));
            } else {
                // 後備方案：高亮所有匹配
                highlightedContent = highlightKeyword(highlightedContent, keyword);
            }
            
            return `
                <div class="search-result-item ${index === 0 ? 'active' : ''}" 
                    data-index="${index}"
                    data-line="${result.lineNumber}"
                    data-match-index="${result.matchNumberInLine || 0}">
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
        }
    };
    
    // 覆蓋導航函數
    // 上一個搜尋結果
    window.prevSearchResult = function() {
        if (!window.searchResultsData || window.searchResultsData.length === 0) return;
        
        window.currentSearchIndex--;
        if (window.currentSearchIndex < 0) {
            window.currentSearchIndex = window.searchResultsData.length - 1;
        }
        
        highlightCurrentSearchResult();
        jumpToCurrentSearchResult();
    };

    // 下一個搜尋結果
    window.nextSearchResult = function() {
        if (!window.searchResultsData || window.searchResultsData.length === 0) return;
        
        window.currentSearchIndex++;
        if (window.currentSearchIndex >= window.searchResultsData.length) {
            window.currentSearchIndex = 0;
        }
        
        highlightCurrentSearchResult();
        jumpToCurrentSearchResult();
    };    

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
            if (window.searchResultsData && window.searchResultsData.length > 0) {
                // 確保 currentSearchIndex 在有效範圍內
                if (window.currentSearchIndex >= window.searchResultsData.length) {
                    window.currentSearchIndex = 0;
                } else if (window.currentSearchIndex < 0) {
                    window.currentSearchIndex = window.searchResultsData.length - 1;
                }
                
                countElement.textContent = `${window.currentSearchIndex + 1} / ${window.searchResultsData.length}`;
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
                    pane: pane,
                    source: 'enhanced-search'
                }, '*');
                console.log(`已發送搜尋請求到 ${pane} 面板`);
            } catch (error) {
                console.error(`發送搜尋請求失敗 (${pane}):`, error);
            }
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