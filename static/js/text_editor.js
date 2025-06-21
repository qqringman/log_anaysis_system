// 文字編輯器功能
class TextEditor {
    constructor() {
        this.tempFileCounter = 0;
        this.editors = new Map(); // 儲存編輯器實例
    }
    
    // 創建新的文字檔案
    createNewTextFile(pane = null) {
        const fileName = `untitled_${++this.tempFileCounter}.txt`;
        const tempPath = `/temp/editor/${fileName}`;
        
        // 創建虛擬檔案物件
        const virtualFile = {
            name: fileName,
            path: tempPath,
            type: 'file',
            isLocal: true,
            isEditable: true,
            content: '' // 初始內容為空
        };
        
        // 如果在分割視窗模式
        if (window.splitView && pane) {
            window.currentUploadPane = pane;
            const tab = window.openFile(virtualFile, false);
            
            if (tab) {
                setTimeout(() => {
                    const createdTab = window.currentTabs.find(t => t.path === virtualFile.path);
                    if (createdTab) {
                        createdTab.splitPane = pane;
                        createdTab.isEditable = true;
                        this.loadEditorToPane(createdTab, pane);
                    }
                }, 100);
            }
        } else {
            // 一般模式
            const tab = window.openFile(virtualFile, true);
            if (tab) {
                tab.isEditable = true;
                setTimeout(() => {
                    this.loadEditorToTab(tab);
                }, 100);
            }
        }
        
        window.showToast(`已創建新檔案: ${fileName}`, 'success');
    }
    
    // 載入編輯器到分割視窗
    loadEditorToPane(tab, pane) {
        const content = document.getElementById(`split-${pane}-content`);
        const title = document.getElementById(`split-${pane}-title`);
        const emptyState = document.getElementById(`split-${pane}-empty`);
        
        if (!content) return;
        
        // 移除空狀態
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // 創建編輯器容器
        const editorContainer = this.createEditorContainer(tab, pane);
        
        content.innerHTML = '';
        content.appendChild(editorContainer);
        content.dataset.tabId = tab.id;
        content.dataset.filePath = tab.path;
        
        // 更新標題
        if (title) {
            title.textContent = tab.name;
            title.title = tab.path;
        }
        
        // 更新狀態
        window.splitViewState[pane] = tab.path;
        tab.loading = false;
        window.renderTabs();
        
        // 聚焦到編輯器
        const textarea = editorContainer.querySelector('textarea');
        if (textarea) {
            textarea.focus();
        }
    }
    
    // 載入編輯器到標籤
    loadEditorToTab(tab) {
        const viewerContainer = document.getElementById('file-viewer');
        if (!viewerContainer) return;
        
        const editorContainer = this.createEditorContainer(tab);
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(editorContainer);
        
        tab.content = editorContainer;
        tab.loading = false;
        window.renderTabs();
        
        // 聚焦到編輯器
        const textarea = editorContainer.querySelector('textarea');
        if (textarea) {
            textarea.focus();
        }
    }
    
    // 創建編輯器容器
    createEditorContainer(tab, pane = null) {
        const container = document.createElement('div');
        container.className = 'text-editor-container';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.background = '#fff';
        
        // 工具列
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
            gap: 10px;
        `;
        
        // 儲存按鈕
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-sm btn-primary';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> 儲存';
        saveBtn.onclick = () => this.saveFile(tab, pane);
        toolbar.appendChild(saveBtn);
        
        // 下載按鈕
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm btn-secondary';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> 下載';
        downloadBtn.onclick = () => this.downloadFile(tab);
        toolbar.appendChild(downloadBtn);
        
        // 字數統計
        const wordCount = document.createElement('span');
        wordCount.className = 'editor-word-count';
        wordCount.style.cssText = 'margin-left: auto; color: #666; font-size: 12px;';
        wordCount.textContent = '0 字元 | 1 行';
        toolbar.appendChild(wordCount);
        
        container.appendChild(toolbar);
        
        // 編輯器容器（包含行號和文字區域）
        const editorWrapper = document.createElement('div');
        editorWrapper.style.cssText = `
            flex: 1;
            display: flex;
            overflow: hidden;
            background: #fafafa;
        `;
        
        // 行號區域
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'line-numbers';
        lineNumbers.style.cssText = `
            background: #f0f0f0;
            color: #999;
            padding: 20px 10px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            line-height: 1.6;
            text-align: right;
            user-select: none;
            min-width: 50px;
            overflow: hidden;
            border-right: 1px solid #e0e0e0;
        `;
        
        // 編輯器
        const textareaWrapper = document.createElement('div');
        textareaWrapper.style.cssText = `
            flex: 1;
            position: relative;
            overflow: hidden;
        `;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        textarea.style.cssText = `
            width: 100%;
            height: 100%;
            padding: 20px;
            border: none;
            outline: none;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            line-height: 1.6;
            resize: none;
            overflow-y: auto;
            background: white;
        `;
        textarea.placeholder = '開始輸入文字...';
        textarea.value = tab.content || '';
        
        // 初始化行號
        this.updateLineNumbers(lineNumbers, textarea.value);
        
        // 監聽輸入事件
        textarea.addEventListener('input', (e) => {
            // 更新行號
            this.updateLineNumbers(lineNumbers, e.target.value);
            
            // 更新字數和行數
            const lines = e.target.value.split('\n').length;
            wordCount.textContent = `${e.target.value.length} 字元 | ${lines} 行`;
            
            // 標記為已修改
            if (!tab.name.endsWith('*')) {
                tab.name += '*';
                window.renderTabs();
            }
        });
        
        // 同步滾動
        textarea.addEventListener('scroll', () => {
            lineNumbers.scrollTop = textarea.scrollTop;
        });
        
        // 支援 Tab 鍵
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                // 更新行號
                this.updateLineNumbers(lineNumbers, textarea.value);
            }
        });
        
        textareaWrapper.appendChild(textarea);
        editorWrapper.appendChild(lineNumbers);
        editorWrapper.appendChild(textareaWrapper);
        container.appendChild(editorWrapper);
        
        // 儲存編輯器實例
        const editorId = pane ? `${tab.id}-${pane}` : tab.id;
        this.editors.set(editorId, { textarea, container, lineNumbers });
        
        return container;
    }

    // 更新行號
    updateLineNumbers(lineNumbersElement, text) {
        const lines = text.split('\n').length;
        let lineNumbersHTML = '';
        for (let i = 1; i <= lines; i++) {
            lineNumbersHTML += i + '\n';
        }
        lineNumbersElement.textContent = lineNumbersHTML;
    }
    
    // 儲存檔案
    saveFile(tab, pane = null) {
        const editorId = pane ? `${tab.id}-${pane}` : tab.id;
        const editor = this.editors.get(editorId);
        
        if (!editor) return;
        
        const content = editor.textarea.value;
        
        // 儲存到記憶體（實際應用中應該發送到後端）
        tab.content = content;
        
        // 移除修改標記
        if (tab.name.endsWith('*')) {
            tab.name = tab.name.slice(0, -1);
            window.renderTabs();
        }
        
        window.showToast('檔案已儲存', 'success');
    }
    
    // 下載檔案
    downloadFile(tab) {
        const content = tab.content || '';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = tab.name.replace('*', '');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        window.showToast('檔案已下載', 'success');
    }
}

// 初始化文字編輯器
window.textEditor = new TextEditor();

// 修改雙擊事件處理
window.handleSplitPaneDoubleClick = function(pane) {
    // 檢查是否有檔案
    const content = document.getElementById(`split-${pane}-content`);
    const emptyState = content.querySelector('.empty-state');
    
    if (emptyState && emptyState.style.display !== 'none') {
        // 直接創建新的文字檔案
        window.textEditor.createNewTextFile(pane);
    }
};