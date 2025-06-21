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
            
            return result;
        } catch (error) {
            console.error('差異比較失敗:', error);
            window.showToast('差異比較失敗: ' + error.message, 'error');
            return null;
        }
    }

    // 顯示差異
    displayDiff(diffData) {
        const diffViewer = document.getElementById('diff-viewer');
        const diffContent = document.getElementById('diff-content');
        
        if (!diffData || !diffData.diff) {
            diffContent.innerHTML = '<p style="text-align: center; color: #999;">沒有差異</p>';
            return;
        }

        // 使用 diff2html 顯示差異
        const diffHtml = Diff2Html.html(diffData.diff, {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
        });

        diffContent.innerHTML = diffHtml;
        diffViewer.style.display = 'block';

        // 收集所有差異位置
        this.collectDiffPositions();
    }

    // 收集差異位置
    collectDiffPositions() {
        this.diffPositions = [];
        const diffs = document.querySelectorAll('.d2h-diff-line-add, .d2h-diff-line-del');
        diffs.forEach(diff => {
            this.diffPositions.push({
                element: diff,
                top: diff.offsetTop
            });
        });
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
    }

    // 設置同步滾動
    setupSyncScroll() {
        const leftPane = document.getElementById('split-left-content');
        const rightPane = document.getElementById('split-right-content');
        
        if (!leftPane || !rightPane) return;

        const leftIframe = leftPane.querySelector('iframe');
        const rightIframe = rightPane.querySelector('iframe');
        
        if (!leftIframe || !rightIframe) return;

        // 發送訊息到 iframe 設置同步滾動
        leftIframe.contentWindow.postMessage({ type: 'enableSyncScroll', target: 'right' }, '*');
        rightIframe.contentWindow.postMessage({ type: 'enableSyncScroll', target: 'left' }, '*');

        // 監聽滾動事件
        window.addEventListener('message', this.handleSyncScrollMessage.bind(this));
        this.syncScrollEnabled = true;
    }

    // 移除同步滾動
    removeSyncScroll() {
        const leftPane = document.getElementById('split-left-content');
        const rightPane = document.getElementById('split-right-content');
        
        if (!leftPane || !rightPane) return;

        const leftIframe = leftPane.querySelector('iframe');
        const rightIframe = rightPane.querySelector('iframe');
        
        if (!leftIframe || !rightIframe) return;

        // 發送訊息到 iframe 停用同步滾動
        leftIframe.contentWindow.postMessage({ type: 'disableSyncScroll' }, '*');
        rightIframe.contentWindow.postMessage({ type: 'disableSyncScroll' }, '*');
        
        this.syncScrollEnabled = false;
    }

    // 處理同步滾動訊息
    handleSyncScrollMessage(event) {
        if (!this.syncScrollEnabled) return;
        
        if (event.data.type === 'scroll') {
            const targetPane = event.data.source === 'left' ? 'right' : 'left';
            const targetIframe = document.querySelector(`#split-${targetPane}-content iframe`);
            
            if (targetIframe && targetIframe.contentWindow) {
                targetIframe.contentWindow.postMessage({
                    type: 'scrollTo',
                    scrollTop: event.data.scrollTop,
                    scrollLeft: event.data.scrollLeft
                }, '*');
            }
        }
    }

    // 複製差異到左側
    async copyDiffToLeft() {
        // TODO: 實作複製差異到左側的功能
        // 需要後端支援來修改檔案內容
        window.showToast('功能開發中 - 複製差異到左側', 'info');
    }

    // 複製差異到右側
    async copyDiffToRight() {
        // TODO: 實作複製差異到右側的功能
        // 需要後端支援來修改檔案內容
        window.showToast('功能開發中 - 複製差異到右側', 'info');
    }

    // 匯出差異比較結果
    async exportComparison(leftFile, rightFile) {
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