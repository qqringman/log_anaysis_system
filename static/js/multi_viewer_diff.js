// static/js/multi_viewer_diff.js

// 差異比較相關功能
class DiffViewer {
    constructor() {
        this.leftContent = null;
        this.rightContent = null;
        this.diffResult = null;
        this.currentDiffIndex = 0;
        this.diffPositions = [];
        this.syncScrollEnabled = false;
        this.syncScrollTimer = null;
        this.ignoreScroll = false;        
    }

    // 執行差異比較
    async performDiff(leftPath, rightPath) {
        try {
            // 獲取檔案內容
            const response = await fetch('/api/compare_files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    leftPath: leftPath,
                    rightPath: rightPath
                })
            });

            if (!response.ok) {
                throw new Error('無法比較檔案');
            }

            const result = await response.json();
            this.diffResult = result;
            this.displayDiff(result);
            this.showDiffViewer();

            return result;
        } catch (error) {
            console.error('差異比較失敗:', error);
            window.showToast('差異比較失敗: ' + error.message, 'error');
            return null;
        }
    }

    // 顯示差異
    displayDiff(diffData) {
        if (!diffData || !diffData.diff) {
            return;
        }
    }

    // 顯示差異查看器
    showDiffViewer() {
        const diffViewer = document.createElement('div');
        diffViewer.id = 'diff-viewer-overlay';
        diffViewer.className = 'diff-viewer-overlay';
        diffViewer.innerHTML = `
            <div class="diff-viewer-container">
                <div class="diff-viewer-header">
                    <h3>檔案差異比較</h3>
                    <div class="diff-stats">
                        <span class="diff-stat additions">
                            <i class="fas fa-plus"></i> ${this.diffResult.stats?.additions || 0} 新增
                        </span>
                        <span class="diff-stat deletions">
                            <i class="fas fa-minus"></i> ${this.diffResult.stats?.deletions || 0} 刪除
                        </span>
                    </div>
                    <button class="diff-close-btn" onclick="window.diffViewer.closeDiffViewer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="diff-viewer-body">
                    ${this.diffResult.htmlContent || '<p>沒有差異</p>'}
                </div>
                <div class="diff-navigation">
                    <button class="diff-nav-btn" onclick="window.diffViewer.prevDiff()">
                        <i class="fas fa-chevron-up"></i> 上一個
                    </button>
                    <span class="diff-position">${this.currentDiffIndex + 1} / ${this.diffPositions.length}</span>
                    <button class="diff-nav-btn" onclick="window.diffViewer.nextDiff()">
                        <i class="fas fa-chevron-down"></i> 下一個
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(diffViewer);
        this.collectDiffPositions();
    }

    // 關閉差異查看器
    closeDiffViewer() {
        const diffViewer = document.getElementById('diff-viewer-overlay');
        if (diffViewer) {
            diffViewer.remove();
        }
    }

    // 收集差異位置
    collectDiffPositions() {
        this.diffPositions = [];
        const diffViewer = document.getElementById('diff-viewer-overlay');
        if (!diffViewer) return;
        
        const diffs = diffViewer.querySelectorAll('.diff-add, .diff-del, .diff-change');
        diffs.forEach(diff => {
            this.diffPositions.push({
                element: diff,
                top: diff.offsetTop
            });
        });
        
        // 更新差異計數
        const positionElement = diffViewer.querySelector('.diff-position');
        if (positionElement) {
            positionElement.textContent = `${this.currentDiffIndex + 1} / ${this.diffPositions.length}`;
        }
    }

    // 下一個差異
    nextDiff() {
        if (this.diffPositions.length === 0) return;
        
        this.currentDiffIndex = (this.currentDiffIndex + 1) % this.diffPositions.length;
        this.scrollToDiff(this.currentDiffIndex);
    }

    // 上一個差異
    prevDiff() {
        if (this.diffPositions.length === 0) return;
        
        this.currentDiffIndex = (this.currentDiffIndex - 1 + this.diffPositions.length) % this.diffPositions.length;
        this.scrollToDiff(this.currentDiffIndex);
    }

    // 滾動到指定差異
    scrollToDiff(index) {
        if (index < 0 || index >= this.diffPositions.length) return;
        
        const diff = this.diffPositions[index];
        diff.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 高亮當前差異
        this.diffPositions.forEach(d => d.element.classList.remove('current-diff'));
        diff.element.classList.add('current-diff');

        // 更新位置顯示
        this.updateDiffPosition();
    }

    // 然後加入新函數：
    updateDiffPosition() {
        const positionElement = document.querySelector('.diff-position');
        if (positionElement) {
            positionElement.textContent = `${this.currentDiffIndex + 1} / ${this.diffPositions.length}`;
        }
    }

    // 設置同步滾動
    setupSyncScroll() {
        const leftPane = document.getElementById('split-left-content');
        const rightPane = document.getElementById('split-right-content');
        
        if (!leftPane || !rightPane) return;

        const leftIframe = leftPane.querySelector('iframe');
        const rightIframe = rightPane.querySelector('iframe');
        
        if (!leftIframe || !rightIframe) return;

        // 為 iframe 設置滾動監聽
        this.setupIframeScrollSync(leftIframe, rightIframe, 'left');
        this.setupIframeScrollSync(rightIframe, leftIframe, 'right');
        
        this.syncScrollEnabled = true;
        window.showToast('已啟用同步滾動', 'success');
    }

    setupIframeScrollSync(sourceIframe, targetIframe, sourceSide) {
        try {
            const sourceDoc = sourceIframe.contentDocument || sourceIframe.contentWindow.document;
            const targetDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
            
            if (!sourceDoc || !targetDoc) return;
            
            const sourceScrollElement = sourceDoc.documentElement || sourceDoc.body;
            const targetScrollElement = targetDoc.documentElement || targetDoc.body;
            
            // 滾動事件處理
            const scrollHandler = () => {
                if (!this.syncScrollEnabled || this.ignoreScroll) return;
                
                clearTimeout(this.syncScrollTimer);
                this.syncScrollTimer = setTimeout(() => {
                    this.ignoreScroll = true;
                    
                    const scrollPercentX = sourceScrollElement.scrollLeft / 
                        (sourceScrollElement.scrollWidth - sourceScrollElement.clientWidth);
                    const scrollPercentY = sourceScrollElement.scrollTop / 
                        (sourceScrollElement.scrollHeight - sourceScrollElement.clientHeight);
                    
                    targetScrollElement.scrollLeft = scrollPercentX * 
                        (targetScrollElement.scrollWidth - targetScrollElement.clientWidth);
                    targetScrollElement.scrollTop = scrollPercentY * 
                        (targetScrollElement.scrollHeight - targetScrollElement.clientHeight);
                    
                    setTimeout(() => { this.ignoreScroll = false; }, 50);
                }, 10);
            };
            
            sourceDoc.addEventListener('scroll', scrollHandler, true);
            
            // 儲存處理器以便移除
            sourceIframe.syncScrollHandler = scrollHandler;
        } catch (error) {
            console.error('設置同步滾動失敗:', error);
        }
    }

    // 移除同步滾動
    removeSyncScroll() {
        const leftPane = document.getElementById('split-left-content');
        const rightPane = document.getElementById('split-right-content');
        
        if (!leftPane || !rightPane) return;

        const leftIframe = leftPane.querySelector('iframe');
        const rightIframe = rightPane.querySelector('iframe');
        
        if (!leftIframe || !rightIframe) return;

        try {
            // 移除滾動事件監聽
            const leftDoc = leftIframe.contentDocument || leftIframe.contentWindow.document;
            const rightDoc = rightIframe.contentDocument || rightIframe.contentWindow.document;
            
            if (leftDoc && leftIframe.syncScrollHandler) {
                leftDoc.removeEventListener('scroll', leftIframe.syncScrollHandler, true);
            }
            
            if (rightDoc && rightIframe.syncScrollHandler) {
                rightDoc.removeEventListener('scroll', rightIframe.syncScrollHandler, true);
            }
        } catch (error) {
            console.error('移除同步滾動失敗:', error);
        }
        
        this.syncScrollEnabled = false;
        window.showToast('已關閉同步滾動', 'info');
    }

    // 複製差異到左側
    async copyDiffToLeft() {
        if (!this.diffResult || !this.diffResult.diff) {
            window.showToast('沒有可複製的差異', 'error');
            return;
        }
        
        // 實際實作需要後端支援
        if (confirm('確定要將右側的內容複製到左側嗎？這將覆蓋左側的檔案內容。')) {
            window.showToast('複製功能需要後端支援', 'info');
            // TODO: 實作檔案內容複製
        }
    }

    // 複製差異到右側
    async copyDiffToRight() {
        if (!this.diffResult || !this.diffResult.diff) {
            window.showToast('沒有可複製的差異', 'error');
            return;
        }
        
        // 實際實作需要後端支援
        if (confirm('確定要將左側的內容複製到右側嗎？這將覆蓋右側的檔案內容。')) {
            window.showToast('複製功能需要後端支援', 'info');
            // TODO: 實作檔案內容複製
        }
    }

    // 匯出差異比較結果
    async exportComparison(leftFile, rightFile) {
        window.showToast('正在匯出比較結果...', 'info');
        try {
            const response = await fetch('/api/export_comparison', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    leftFile: leftFile,
                    rightFile: rightFile,
                    diffContent: this.diffResult ? this.diffResult.htmlContent : ''
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `comparison_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                window.showToast('比較結果已匯出', 'success');
            } else {
                throw new Error('匯出失敗');
            }
        } catch (error) {
            console.error('匯出失敗:', error);
            window.showToast('匯出失敗: ' + error.message, 'error');
        }
    }
}

// 創建全域實例
window.diffViewer = new DiffViewer();