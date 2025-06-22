// iframe 內搜尋功能
class IframeSearch {
    constructor() {
        this.searchResults = { left: [], right: [] };
        this.currentSearchIndex = { left: 0, right: 0 };
        this.searchKeyword = '';
        this.init();
    }
    
    init() {
        // 監聽搜尋訊息
        window.addEventListener('message', this.handleSearchMessage.bind(this));
        
        // 監聽鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (window.splitView) {
                    this.openSearchForActivePane();
                } else {
                    window.openSearchModal();
                }
            }
        });
    }
    
    handleSearchMessage(event) {
        if (event.data.type === 'search') {
            const { pane, keyword, options } = event.data;
            this.performSearch(pane, keyword, options);
        }
    }
    
    async performSearch(pane, keyword, options = {}) {
        if (!keyword) return;
        
        this.searchKeyword = keyword;
        const content = pane ? document.getElementById(`split-${pane}-content`) : document.getElementById('file-viewer');
        const iframe = content?.querySelector('iframe');
        
        if (!iframe) {
            window.showToast('無法找到檔案內容', 'error');
            return;
        }
        
        try {
            // 發送搜尋請求到 iframe
            iframe.contentWindow.postMessage({
                type: 'search',
                options: {
                    keyword: keyword,
                    caseSensitive: options.caseSensitive || false,
                    wholeWord: options.wholeWord || false,
                    regex: options.regex || false
                }
            }, '*');
            
            // 監聽搜尋結果
            const handleSearchResults = (event) => {
                if (event.source !== iframe.contentWindow) return;
                
                if (event.data.type === 'search-results') {
                    const { count, keyword: resultKeyword, results } = event.data;
                    
                    if (resultKeyword === keyword) {
                        // 同步關鍵字到 enhanced_file_viewer.html
                        this.syncSearchKeyword(keyword);
                        
                        // 顯示搜尋結果
                        this.displaySearchResults(results, keyword);
                        
                        if (count > 0) {
                            window.showToast(`找到 ${count} 個結果`, 'success');
                            this.updateSearchStats(count, results.length);
                        } else {
                            window.showToast('沒有找到匹配的內容', 'info');
                            this.showNoResults();
                        }
                        
                        window.removeEventListener('message', handleSearchResults);
                    }
                }
            };
            
            window.addEventListener('message', handleSearchResults);
            
        } catch (error) {
            console.error('搜尋失敗:', error);
            window.showToast('搜尋失敗', 'error');
        }
    }
    
    searchInDocument(doc, keyword, options) {
        const results = [];
        const walker = doc.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        let nodeIndex = 0;
        
        while (node = walker.nextNode()) {
            const text = node.textContent;
            const regex = this.createSearchRegex(keyword, options);
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                results.push({
                    node: node,
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    nodeIndex: nodeIndex
                });
            }
            
            nodeIndex++;
        }
        
        return results;
    }
    
    createSearchRegex(keyword, options) {
        let flags = 'g';
        if (!options.caseSensitive) flags += 'i';
        
        let pattern = keyword;
        if (options.regex) {
            try {
                return new RegExp(pattern, flags);
            } catch (e) {
                // 如果正則表達式無效，退回到普通搜尋
                pattern = this.escapeRegex(pattern);
            }
        } else {
            pattern = this.escapeRegex(pattern);
            if (options.wholeWord) {
                pattern = `\\b${pattern}\\b`;
            }
        }
        
        return new RegExp(pattern, flags);
    }
    
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    highlightResults(doc, results) {
        results.forEach((result, index) => {
            const span = doc.createElement('span');
            span.className = 'search-highlight';
            span.dataset.searchIndex = index;
            
            const text = result.node.textContent;
            const before = text.substring(0, result.index);
            const match = text.substring(result.index, result.index + result.length);
            const after = text.substring(result.index + result.length);
            
            const parent = result.node.parentNode;
            
            if (before) {
                parent.insertBefore(doc.createTextNode(before), result.node);
            }
            
            span.textContent = match;
            parent.insertBefore(span, result.node);
            
            if (after) {
                parent.insertBefore(doc.createTextNode(after), result.node);
            }
            
            parent.removeChild(result.node);
        });
    }
    
    clearHighlights(doc) {
        const highlights = doc.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(doc.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    }
    
    scrollToResult(doc, result) {
        const element = doc.querySelector(`[data-search-index="${this.currentSearchIndex[result.pane || 'left']}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('current-highlight');
        }
    }
    
    nextResult(pane) {
        const content = pane ? document.getElementById(`split-${pane}-content`) : document.getElementById('file-viewer');
        const iframe = content?.querySelector('iframe');
        
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'next-result' }, '*');
        }
    }

    prevResult(pane) {
        const content = pane ? document.getElementById(`split-${pane}-content`) : document.getElementById('file-viewer');
        const iframe = content?.querySelector('iframe');
        
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'prev-result' }, '*');
        }
    }

    updateSearchPosition(pane, current, total) {
        const selector = pane === 'main' ? '.search-result-count' : '.search-result-count';
        const countElement = document.querySelector(selector);
        if (countElement) {
            countElement.textContent = `${current} / ${total}`;
        }
    }

    updateSearchCount(pane, total) {
        const countElement = document.querySelector('.search-result-count');
        if (countElement) {
            countElement.textContent = `${this.currentSearchIndex[pane] + 1} / ${total}`;
        }
    }
    
    openSearchForActivePane() {
        // 檢測當前活動的面板
        const activeElement = document.activeElement;
        const leftPane = document.getElementById('split-left');
        const rightPane = document.getElementById('split-right');
        
        if (leftPane && leftPane.contains(activeElement)) {
            window.openPaneSearchModal('left');
        } else if (rightPane && rightPane.contains(activeElement)) {
            window.openPaneSearchModal('right');
        } else {
            // 預設搜尋左側
            window.openPaneSearchModal('left');
        }
    }

    // 新增函數：同步搜尋關鍵字
    syncSearchKeyword(keyword) {
        // 發送訊息到 iframe 以同步關鍵字
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'sync-keyword',
                    keyword: keyword
                }, '*');
            }
        });
    }

    // 新增函數：顯示搜尋結果
    displaySearchResults(results, keyword) {
        const resultsContainer = document.getElementById('search-results');
        const noResults = document.getElementById('no-results');
        const searchStats = document.getElementById('search-stats');
        
        if (results.length === 0) {
            noResults.style.display = 'block';
            searchStats.style.display = 'none';
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>沒有找到匹配的內容</p>
                </div>
            `;
            return;
        }
        
        noResults.style.display = 'none';
        searchStats.style.display = 'flex';
        
        let html = '';
        results.forEach((result, index) => {
            const highlightedContent = this.highlightKeyword(result.content, keyword);
            html += `
                <div class="search-result-item" onclick="jumpToSearchResult(${index}, ${result.lineNumber})">
                    <div class="search-result-header">
                        <div class="search-result-line">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>行號</span>
                            <span class="line-number">${result.lineNumber}</span>
                        </div>
                    </div>
                    <div class="search-result-content">
                        ${highlightedContent}
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
    }

    // 新增函數：高亮關鍵字
    highlightKeyword(text, keyword) {
        const regex = new RegExp(`(${this.escapeRegex(keyword)})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    // 新增函數：更新搜尋統計
    updateSearchStats(totalCount, lineCount) {
        document.getElementById('search-count').textContent = totalCount;
        document.getElementById('search-lines').textContent = lineCount;
    }

    // 新增函數：顯示無結果
    showNoResults() {
        const searchStats = document.getElementById('search-stats');
        searchStats.style.display = 'none';
    }    
}

// 初始化搜尋功能
document.addEventListener('DOMContentLoaded', () => {
    window.iframeSearch = new IframeSearch();
});

// 綁定搜尋導航按鈕
window.nextPaneSearchResult = function() {
    if (window.currentSearchPane) {
        window.iframeSearch.nextResult(window.currentSearchPane);
    }
};

window.prevPaneSearchResult = function() {
    if (window.currentSearchPane) {
        window.iframeSearch.prevResult(window.currentSearchPane);
    }
};

// 新增全域函數：跳轉到搜尋結果
window.jumpToSearchResult = function(index, lineNumber) {
    const iframe = document.querySelector('.file-viewer-container iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'jump-to-line',
            lineNumber: lineNumber,
            matchIndex: index
        }, '*');
    }
    
    // 高亮當前選中的結果
    document.querySelectorAll('.search-result-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
};