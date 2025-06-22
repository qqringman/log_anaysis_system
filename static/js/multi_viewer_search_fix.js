// 多檔案檢視器搜尋功能修復
(function() {
    console.log('搜尋功能修復模組已載入');
    
    // 儲存原始的 displaySearchResults 函數
    const originalDisplaySearchResults = window.displaySearchResults;
    
    // 重寫 displaySearchResults 函數以修復行號顯示
    window.displaySearchResults = function(data) {
        console.log('修復版 displaySearchResults:', data);
        
        const resultsDiv = document.getElementById('search-results');
        const searchStats = document.getElementById('search-stats');
        
        if (!resultsDiv) {
            console.error('找不到搜尋結果容器');
            return;
        }
        
        // 清除超時計時器
        if (window.searchTimeoutId) {
            clearTimeout(window.searchTimeoutId);
            window.searchTimeoutId = null;
        }
        
        // 確保搜尋對話框是開啟的
        const searchModal = document.getElementById('search-modal');
        if (!searchModal || !searchModal.classList.contains('show')) {
            console.log('搜尋對話框已關閉，忽略結果');
            return;
        }
        
        // 保存搜尋結果數據
        window.searchResultsData = data.results || [];
        window.currentSearchIndex = 0;
        
        resultsDiv.innerHTML = '';
        
        if (window.searchResultsData.length > 0) {
            // 顯示統計
            if (searchStats) {
                searchStats.style.display = 'flex';
                const searchCount = document.getElementById('search-count');
                const searchLines = document.getElementById('search-lines');
                if (searchCount) searchCount.textContent = data.count || window.searchResultsData.length;
                if (searchLines) searchLines.textContent = window.searchResultsData.length;
            }
            
            // 啟用導航按鈕
            const prevBtn = document.getElementById('prev-search-btn');
            const nextBtn = document.getElementById('next-search-btn');
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
            
            // 根據來源分組顯示結果
            const groupedResults = groupSearchResults(window.searchResultsData);
            
            // 如果在分割視窗模式且有多個來源，顯示分組
            if (window.splitView && Object.keys(groupedResults).length > 1) {
                displayGroupedResults(resultsDiv, groupedResults, data.keyword);
            } else {
                // 單一來源或非分割模式，直接顯示所有結果
                displayFlatResults(resultsDiv, window.searchResultsData, data.keyword);
            }
        } else {
            // 無結果
            if (searchStats) searchStats.style.display = 'none';
            resultsDiv.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>沒有找到「${data.keyword || ''}」的相關結果</p>
                </div>
            `;
            
            // 停用導航按鈕
            const prevBtn = document.getElementById('prev-search-btn');
            const nextBtn = document.getElementById('next-search-btn');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
        }
    };
    
    // 分組搜尋結果
    function groupSearchResults(results) {
        const grouped = {};
        
        results.forEach(result => {
            const source = result.pane || 'main';
            if (!grouped[source]) {
                grouped[source] = [];
            }
            grouped[source].push(result);
        });
        
        return grouped;
    }
    
    // 顯示分組結果
    function displayGroupedResults(container, groupedResults, keyword) {
        let html = '<div class="search-results-tabs">';
        
        // 建立頁籤
        let firstTab = true;
        Object.keys(groupedResults).forEach(source => {
            const tabName = source === 'left' ? '左側視窗' : 
                          source === 'right' ? '右側視窗' : '主視窗';
            const icon = source === 'left' ? 'fa-arrow-left' : 
                        source === 'right' ? 'fa-arrow-right' : 'fa-file';
            
            html += `
                <button class="search-results-tab ${firstTab ? 'active' : ''}" 
                        onclick="switchSearchResultsTab('${source}')">
                    <i class="fas ${icon}"></i> ${tabName}
                    <span class="tab-count">${groupedResults[source].length}</span>
                </button>
            `;
            firstTab = false;
        });
        
        html += '</div><div class="search-results-content">';
        
        // 建立內容區域
        let firstPane = true;
        Object.keys(groupedResults).forEach(source => {
            html += `
                <div class="search-results-pane ${firstPane ? 'active' : ''}" 
                     id="search-results-${source}">
                    ${renderSearchResultsList(groupedResults[source], keyword, source)}
                </div>
            `;
            firstPane = false;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // 顯示平面結果（不分組）
    function displayFlatResults(container, results, keyword) {
        container.innerHTML = renderSearchResultsList(results, keyword);
    }
    
    // 渲染搜尋結果列表
    function renderSearchResultsList(results, keyword, source) {
        return results.map((result, index) => {
            // 確保有行號
            const lineNumber = result.lineNumber || extractLineNumber(result);
            
            // 獲取結果在全域陣列中的索引
            const globalIndex = window.searchResultsData.findIndex(r => r === result);
            
            return `
                <div class="search-result-item" 
                     onclick="jumpToSearchResultFixed(${globalIndex}, ${lineNumber}, '${source || ''}')"
                     data-line="${lineNumber}">
                    <div class="search-result-header">
                        <div class="search-result-line">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>行號</span>
                            <span class="line-number">${lineNumber}</span>
                        </div>
                    </div>
                    <div class="search-result-content">
                        ${highlightSearchKeyword(result.content || result.lineText || '', keyword)}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 從結果中提取行號
    function extractLineNumber(result) {
        // 嘗試從不同欄位取得行號
        if (result.lineNumber) return result.lineNumber;
        if (result.line) return result.line;
        if (result.lineNo) return result.lineNo;
        
        // 如果都沒有，嘗試從內容解析
        if (result.content) {
            const match = result.content.match(/^(\d+):/);
            if (match) return parseInt(match[1]);
        }
        
        return 1; // 預設回傳第一行
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
    
    // 切換搜尋結果頁籤
    window.switchSearchResultsTab = function(tab) {
        // 切換頁籤樣式
        document.querySelectorAll('.search-results-tab').forEach(t => {
            t.classList.remove('active');
        });
        
        const clickedTab = Array.from(document.querySelectorAll('.search-results-tab'))
            .find(t => t.onclick && t.onclick.toString().includes(`'${tab}'`));
        
        if (clickedTab) {
            clickedTab.classList.add('active');
        }
        
        // 切換內容
        document.querySelectorAll('.search-results-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const targetPane = document.getElementById(`search-results-${tab}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    };
    
    // 修復版的跳轉函數
    window.jumpToSearchResultFixed = function(index, lineNumber, source) {
        console.log('跳轉到搜尋結果（修復版）:', { index, lineNumber, source });
        
        // 關閉搜尋對話框
        if (window.closeSearchModal) {
            window.closeSearchModal();
        }
        
        // 延遲執行跳轉，確保對話框已關閉
        setTimeout(() => {
            if (window.splitView && source && (source === 'left' || source === 'right')) {
                // 分割視窗模式
                jumpToLineInPane(lineNumber, source);
            } else {
                // 一般模式
                jumpToLineInActiveTab(lineNumber);
            }
        }, 100);
    };
    
    // 跳轉到分割視窗中的指定行
    function jumpToLineInPane(lineNumber, pane) {
        const content = document.getElementById(`split-${pane}-content`);
        if (!content) {
            console.error(`找不到 ${pane} 視窗`);
            return;
        }
        
        const iframe = content.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) {
            console.error(`找不到 ${pane} 視窗的 iframe`);
            return;
        }
        
        // 發送跳轉訊息
        console.log(`發送跳轉訊息到 ${pane} 視窗: 行號 ${lineNumber}`);
        
        // 使用與 enhanced_file_viewer.html 相同的訊息格式
        iframe.contentWindow.postMessage({
            type: 'jump-to-line',
            lineNumber: lineNumber,
            highlight: true
        }, '*');
        
        // 視覺反饋
        iframe.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.6)';
        setTimeout(() => {
            iframe.style.boxShadow = '';
        }, 1500);
        
        // 顯示提示
        window.showToast && window.showToast(
            `已跳轉到${pane === 'left' ? '左側' : '右側'}視窗第 ${lineNumber} 行`, 
            'success'
        );
    }
    
    // 跳轉到主視窗中的指定行
    function jumpToLineInActiveTab(lineNumber) {
        if (!window.activeTabId) {
            console.error('沒有活動的標籤');
            return;
        }
        
        const tab = window.currentTabs.find(t => t.id === window.activeTabId);
        if (!tab || !tab.content) {
            console.error('找不到活動標籤的內容');
            return;
        }
        
        const iframe = tab.content.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) {
            console.error('找不到活動標籤的 iframe');
            return;
        }
        
        console.log(`發送跳轉訊息到主視窗: 行號 ${lineNumber}`);
        
        // 發送跳轉訊息
        iframe.contentWindow.postMessage({
            type: 'jump-to-line',
            lineNumber: lineNumber,
            highlight: true
        }, '*');
        
        // 顯示提示
        window.showToast && window.showToast(
            `已跳轉到第 ${lineNumber} 行`, 
            'success'
        );
    }
    
    // 監聽來自 iframe 的訊息，確保行號正確傳遞
    window.addEventListener('message', function(event) {
        if (event.data.type === 'search-results') {
            console.log('收到搜尋結果（修復版處理）:', event.data);
            
            // 確保每個結果都有正確的行號
            if (event.data.results) {
                event.data.results.forEach(result => {
                    if (!result.lineNumber && result.line) {
                        result.lineNumber = result.line;
                    }
                });
            }
        }
    });
    
    // 為 iframe 添加跳轉訊息處理
    function setupIframeJumpHandler() {
        // 確保所有 iframe 都能處理跳轉訊息
        const checkAndSetupIframes = () => {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                if (iframe.contentWindow && !iframe.dataset.jumpHandlerSetup) {
                    try {
                        // 注入跳轉處理腳本
                        iframe.contentWindow.eval(`
                            if (!window.jumpToLineHandler) {
                                window.jumpToLineHandler = true;
                                window.addEventListener('message', function(event) {
                                    if (event.data.type === 'jump-to-line') {
                                        const lineNumber = event.data.lineNumber;
                                        console.log('收到跳轉請求: 行號', lineNumber);
                                        
                                        // 嘗試跳轉到指定行
                                        const lineElement = document.getElementById('line-' + lineNumber);
                                        if (lineElement) {
                                            lineElement.scrollIntoView({ 
                                                behavior: 'smooth', 
                                                block: 'center' 
                                            });
                                            
                                            // 高亮效果
                                            if (event.data.highlight) {
                                                lineElement.classList.add('highlight-flash');
                                                setTimeout(() => {
                                                    lineElement.classList.remove('highlight-flash');
                                                }, 2000);
                                            }
                                        } else {
                                            // 如果找不到元素，嘗試使用其他方式
                                            console.log('找不到行元素，嘗試其他方式');
                                            
                                            // 檢查是否有 jumpToLine 函數
                                            if (typeof jumpToLine === 'function') {
                                                jumpToLine(lineNumber);
                                            } else {
                                                // 嘗試透過 URL 參數跳轉
                                                const url = new URL(window.location);
                                                url.searchParams.set('line', lineNumber);
                                                window.location.href = url.toString();
                                            }
                                        }
                                    }
                                });
                            }
                        `);
                        iframe.dataset.jumpHandlerSetup = 'true';
                    } catch (e) {
                        console.warn('無法設置 iframe 跳轉處理器:', e);
                    }
                }
            });
        };
        
        // 定期檢查新的 iframe
        setInterval(checkAndSetupIframes, 1000);
        
        // 立即執行一次
        checkAndSetupIframes();
    }
    
    // 初始化
    setTimeout(() => {
        setupIframeJumpHandler();
    }, 1000);
    
})();