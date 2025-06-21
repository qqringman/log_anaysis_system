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
        const content = document.getElementById(`split-${pane}-content`);
        const iframe = content?.querySelector('iframe');
        
        if (!iframe || !iframe.contentDocument) {
            window.showToast('無法存取檔案內容', 'error');
            return;
        }
        
        try {
            // 清除之前的高亮
            this.clearHighlights(iframe.contentDocument);
            
            // 執行搜尋
            const results = this.searchInDocument(iframe.contentDocument, keyword, options);
            this.searchResults[pane] = results;
            this.currentSearchIndex[pane] = 0;
            
            // 高亮搜尋結果
            if (results.length > 0) {
                this.highlightResults(iframe.contentDocument, results);
                this.scrollToResult(iframe.contentDocument, results[0]);
                window.showToast(`找到 ${results.length} 個結果`, 'success');
            } else {
                window.showToast('沒有找到匹配的內容', 'info');
            }
            
            // 更新搜尋結果計數
            this.updateSearchCount(pane, results.length);
            
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
        const results = this.searchResults[pane];
        if (!results || results.length === 0) return;
        
        this.currentSearchIndex[pane] = (this.currentSearchIndex[pane] + 1) % results.length;
        this.scrollToResult(
            document.getElementById(`split-${pane}-content`).querySelector('iframe').contentDocument,
            results[this.currentSearchIndex[pane]]
        );
        
        this.updateSearchCount(pane, results.length);
    }
    
    prevResult(pane) {
        const results = this.searchResults[pane];
        if (!results || results.length === 0) return;
        
        this.currentSearchIndex[pane] = (this.currentSearchIndex[pane] - 1 + results.length) % results.length;
        this.scrollToResult(
            document.getElementById(`split-${pane}-content`).querySelector('iframe').contentDocument,
            results[this.currentSearchIndex[pane]]
        );
        
        this.updateSearchCount(pane, results.length);
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