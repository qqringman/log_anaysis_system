// Enhanced File Viewer - 增強 Ctrl+G 跳轉行號功能 (修復版)
// static/js/file_viewer_goto_line.js

(function() {
    'use strict';
    
    console.log('🎯 載入 Ctrl+G 跳轉功能...');
    
    // 跳轉對話框管理器
    const GotoLineManager = {
        dialogId: 'goto-line-dialog',
        isDialogOpen: false,
        
        // 初始化
        init: function() {
            console.log('🔧 初始化 GotoLineManager...');
            this.createDialog();
            this.setupKeyboardShortcuts();
            this.setupDialogEvents();
            console.log('✅ GotoLineManager 初始化完成');
        },
        
        // 創建跳轉對話框
        createDialog: function() {
            // 先移除可能存在的舊對話框
            const existingDialog = document.getElementById(this.dialogId);
            if (existingDialog) {
                existingDialog.remove();
                console.log('🗑️ 移除現有對話框');
            }
            
            const dialog = document.createElement('div');
            dialog.id = this.dialogId;
            dialog.className = 'goto-line-dialog';
            dialog.style.display = 'none';
            
            dialog.innerHTML = `
                <div class="goto-line-overlay"></div>
                <div class="goto-line-content">
                    <div class="goto-line-header">
                        <h5>
                            <i class="fas fa-crosshairs me-2"></i>
                            跳轉到行號
                        </h5>
                        <button class="goto-line-close" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="goto-line-body">
                        <div class="goto-line-info">
                            <div class="current-info">
                                <span class="info-label">當前行:</span>
                                <span class="info-value" id="goto-current-line">--</span>
                            </div>
                            <div class="total-info">
                                <span class="info-label">總行數:</span>
                                <span class="info-value" id="goto-total-lines">--</span>
                            </div>
                        </div>
                        <div class="goto-line-input-group">
                            <label class="goto-line-label">
                                <i class="fas fa-arrow-right me-1"></i>
                                跳轉到第幾行：
                            </label>
                            <div class="goto-line-input-wrapper">
                                <input type="number" 
                                       id="goto-line-input" 
                                       class="goto-line-input" 
                                       placeholder="輸入行號"
                                       min="1">
                                <div class="goto-line-suggestions">
                                    <button class="goto-suggestion" type="button" data-line="1">
                                        第 1 行 (開頭)
                                    </button>
                                    <button class="goto-suggestion" type="button" data-line="last">
                                        最後一行
                                    </button>
                                    <button class="goto-suggestion" type="button" data-line="middle">
                                        中間行
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="goto-line-preview" id="goto-line-preview" style="display: none;">
                            <div class="preview-label">預覽:</div>
                            <div class="preview-content" id="goto-preview-content">--</div>
                        </div>
                    </div>
                    <div class="goto-line-footer">
                        <div class="goto-line-shortcuts">
                            <span class="shortcut-hint">
                                <kbd>Enter</kbd> 跳轉　<kbd>Esc</kbd> 取消
                            </span>
                        </div>
                        <div class="goto-line-buttons">
                            <button class="btn btn-outline-secondary goto-cancel-btn" type="button">
                                <i class="fas fa-times me-1"></i>取消
                            </button>
                            <button class="btn btn-gradient-primary goto-jump-btn" type="button">
                                <i class="fas fa-arrow-right me-1"></i>跳轉
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            console.log('✅ 跳轉對話框已創建');
        },
        
        // 設置鍵盤快捷鍵
        setupKeyboardShortcuts: function() {
            console.log('⌨️ 設置鍵盤快捷鍵...');
            
            // 移除可能存在的舊事件監聽器
            document.removeEventListener('keydown', this.handleGlobalKeydown);
            
            // 綁定全域 Ctrl+G 快捷鍵
            this.handleGlobalKeydown = (e) => {
                if (e.ctrlKey && e.key === 'g') {
                    e.preventDefault();
                    console.log('🎯 Ctrl+G 被按下');
                    this.showDialog();
                }
            };
            
            document.addEventListener('keydown', this.handleGlobalKeydown);
            console.log('✅ Ctrl+G 快捷鍵已設置');
        },
        
        // 設置對話框事件
        setupDialogEvents: function() {
            console.log('🔗 設置對話框事件...');
            
            const dialog = document.getElementById(this.dialogId);
            if (!dialog) {
                console.error('❌ 找不到對話框元素');
                return;
            }
            
            // 輸入框元素
            const input = dialog.querySelector('#goto-line-input');
            const jumpBtn = dialog.querySelector('.goto-jump-btn');
            const cancelBtn = dialog.querySelector('.goto-cancel-btn');
            const closeBtn = dialog.querySelector('.goto-line-close');
            const overlay = dialog.querySelector('.goto-line-overlay');
            const suggestions = dialog.querySelectorAll('.goto-suggestion');
            
            if (!input || !jumpBtn) {
                console.error('❌ 找不到必要的對話框元素');
                return;
            }
            
            // 輸入框事件
            input.addEventListener('input', () => {
                console.log('📝 輸入框內容變更:', input.value);
                this.updatePreview();
                this.validateInput();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    console.log('⏎ Enter 鍵被按下');
                    this.executeGoto();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    console.log('⎋ Escape 鍵被按下');
                    this.closeDialog();
                }
            });
            
            // 跳轉按鈕事件
            jumpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔘 跳轉按鈕被點擊');
                this.executeGoto();
            });
            
            // 取消按鈕事件
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔘 取消按鈕被點擊');
                    this.closeDialog();
                });
            }
            
            // 關閉按鈕事件
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔘 關閉按鈕被點擊');
                    this.closeDialog();
                });
            }
            
            // 遮罩點擊關閉
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔘 遮罩被點擊');
                    this.closeDialog();
                });
            }
            
            // 建議按鈕事件
            suggestions.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const lineType = btn.getAttribute('data-line');
                    console.log('🔘 建議按鈕被點擊:', lineType);
                    this.fillLineNumber(lineType);
                });
            });
            
            // 對話框級別的鍵盤事件
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeDialog();
                }
            });
            
            console.log('✅ 對話框事件設置完成');
        },
        
        // 顯示對話框
        showDialog: function() {
            if (this.isDialogOpen) {
                console.log('⚠️ 對話框已經開啟');
                return;
            }
            
            console.log('📖 顯示跳轉對話框');
            this.isDialogOpen = true;
            
            const dialog = document.getElementById(this.dialogId);
            const input = document.getElementById('goto-line-input');
            
            if (!dialog || !input) {
                console.error('❌ 對話框或輸入框不存在');
                return;
            }
            
            // 更新信息
            this.updateCurrentInfo();
            
            // 清空輸入框
            input.value = '';
            
            // 設置最大值
            const totalLines = this.getTotalLines();
            if (totalLines > 0) {
                input.setAttribute('max', totalLines);
            }
            
            // 顯示對話框
            dialog.style.display = 'flex';
            
            // 添加動畫效果
            setTimeout(() => {
                dialog.classList.add('show');
                input.focus();
            }, 10);
            
            console.log('✅ 對話框已顯示');
        },
        
        // 關閉對話框
        closeDialog: function() {
            if (!this.isDialogOpen) {
                console.log('⚠️ 對話框已經關閉');
                return;
            }
            
            console.log('🔒 關閉跳轉對話框');
            this.isDialogOpen = false;
            
            const dialog = document.getElementById(this.dialogId);
            const preview = document.getElementById('goto-line-preview');
            
            if (dialog) {
                dialog.classList.remove('show');
                setTimeout(() => {
                    dialog.style.display = 'none';
                }, 200);
            }
            
            // 隱藏預覽
            if (preview) {
                preview.style.display = 'none';
            }
            
            console.log('✅ 對話框已關閉');
        },
        
        // 更新當前信息
        updateCurrentInfo: function() {
            const currentLine = this.getCurrentLine();
            const totalLines = this.getTotalLines();
            
            console.log('📊 更新當前信息:', { currentLine, totalLines });
            
            const currentLineEl = document.getElementById('goto-current-line');
            const totalLinesEl = document.getElementById('goto-total-lines');
            
            if (currentLineEl) currentLineEl.textContent = currentLine;
            if (totalLinesEl) totalLinesEl.textContent = totalLines;
        },
        
        // 獲取當前行號
        getCurrentLine: function() {
            // 嘗試多種方式獲取當前行號
            
            // 方式1: 使用現有的 getCurrentLine 函數
            if (typeof window.getCurrentLine === 'function') {
                const line = window.getCurrentLine();
                console.log('📍 getCurrentLine() 返回:', line);
                return line;
            }
            
            // 方式2: 使用全域變數
            if (window.currentTargetLine) {
                console.log('📍 currentTargetLine:', window.currentTargetLine);
                return window.currentTargetLine;
            }
            
            // 方式3: 計算中心位置的行號
            const container = document.getElementById('line-container');
            if (container) {
                const scrollTop = container.scrollTop;
                const containerHeight = container.clientHeight;
                const centerY = scrollTop + (containerHeight / 2);
                
                let closestLine = 1;
                let minDistance = Infinity;
                
                const codeLines = container.querySelectorAll('.code-line');
                codeLines.forEach(lineEl => {
                    const lineNumber = parseInt(lineEl.getAttribute('data-line'));
                    if (lineNumber) {
                        const elementTop = lineEl.offsetTop;
                        const distance = Math.abs(elementTop - centerY);
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestLine = lineNumber;
                        }
                    }
                });
                
                console.log('📍 計算得出當前行:', closestLine);
                return closestLine;
            }
            
            console.log('📍 使用預設值: 1');
            return 1;
        },
        
        // 獲取總行數
        getTotalLines: function() {
            // 方式1: 使用全域變數
            if (window.totalLines && window.totalLines > 0) {
                console.log('📊 totalLines:', window.totalLines);
                return window.totalLines;
            }
            
            // 方式2: 從隱藏輸入框獲取
            const totalLinesInput = document.getElementById('initial-total-lines');
            if (totalLinesInput && totalLinesInput.value) {
                const lines = parseInt(totalLinesInput.value);
                if (lines > 0) {
                    console.log('📊 從隱藏輸入框獲取總行數:', lines);
                    window.totalLines = lines; // 快取到全域變數
                    return lines;
                }
            }
            
            // 方式3: 從檔案資訊區域獲取
            const fileInfoElements = document.querySelectorAll('.file-info-badge .info-item');
            for (const element of fileInfoElements) {
                const text = element.textContent || '';
                const match = text.match(/(\d+)\s*行/);
                if (match) {
                    const lines = parseInt(match[1]);
                    console.log('📊 從檔案資訊獲取總行數:', lines);
                    window.totalLines = lines; // 快取到全域變數
                    return lines;
                }
            }
            
            // 方式4: 計算 DOM 中的最大行號（但這可能只是當前範圍的最大值）
            const codeLines = document.querySelectorAll('.code-line[data-line]');
            if (codeLines.length > 0) {
                let maxLine = 0;
                codeLines.forEach(lineEl => {
                    const lineNumber = parseInt(lineEl.getAttribute('data-line'));
                    if (lineNumber > maxLine) {
                        maxLine = lineNumber;
                    }
                });
                
                // 如果最大行號看起來像是檔案的一部分而非全部，嘗試請求真實總行數
                if (maxLine > 0) {
                    const currentEnd = window.currentEndLine || maxLine;
                    if (maxLine === currentEnd) {
                        // 這可能只是當前範圍的最後一行，需要獲取真實總行數
                        this.fetchRealTotalLines();
                        console.log('📊 DOM中最大行號（可能不是真實總數）:', maxLine);
                        return maxLine; // 暫時返回這個值
                    } else {
                        console.log('📊 計算得出總行數:', maxLine);
                        window.totalLines = maxLine; // 快取到全域變數
                        return maxLine;
                    }
                }
            }
            
            // 方式5: 嘗試從URL或其他地方獲取
            console.log('📊 無法確定總行數，嘗試從伺服器獲取');
            this.fetchRealTotalLines();
            
            // 返回一個較大的預設值，避免限制用戶輸入
            return 999999;
        },
        
        // 從伺服器獲取真實總行數
        fetchRealTotalLines: function() {
            const filePath = this.getCurrentFilePath();
            if (!filePath) {
                console.warn('⚠️ 無法獲取檔案路徑來查詢總行數');
                return;
            }
            
            const requestUrl = `/api/get_file_info?path=${encodeURIComponent(filePath)}`;
            
            fetch(requestUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.total_lines) {
                        console.log('📊 從伺服器獲取真實總行數:', data.total_lines);
                        window.totalLines = data.total_lines;
                        
                        // 更新UI中的總行數顯示
                        const totalLinesEl = document.getElementById('goto-total-lines');
                        if (totalLinesEl) {
                            totalLinesEl.textContent = data.total_lines;
                        }
                        
                        // 更新輸入框的最大值
                        const input = document.getElementById('goto-line-input');
                        if (input) {
                            input.setAttribute('max', data.total_lines);
                        }
                    }
                })
                .catch(error => {
                    console.error('❌ 獲取檔案資訊失敗:', error);
                });
        },
        
        // 填入行號
        fillLineNumber: function(type) {
            console.log('🔢 填入行號類型:', type);
            
            const input = document.getElementById('goto-line-input');
            const totalLines = this.getTotalLines();
            
            if (!input) {
                console.error('❌ 找不到輸入框');
                return;
            }
            
            let lineNumber;
            if (type === 'last') {
                lineNumber = totalLines;
            } else if (type === 'middle') {
                lineNumber = Math.floor(totalLines / 2);
            } else {
                lineNumber = parseInt(type) || 1;
            }
            
            console.log('🔢 設置行號為:', lineNumber);
            input.value = lineNumber;
            
            // 觸發input事件來更新預覽
            input.dispatchEvent(new Event('input'));
            input.focus();
        },
        
        // 更新預覽
        updatePreview: function() {
            const input = document.getElementById('goto-line-input');
            const preview = document.getElementById('goto-line-preview');
            const content = document.getElementById('goto-preview-content');
            
            if (!input || !preview || !content) {
                console.log('⚠️ 預覽元素不完整');
                return;
            }
            
            const lineNumber = parseInt(input.value);
            console.log('👁️ 更新預覽，行號:', lineNumber);
            
            if (!lineNumber || lineNumber < 1) {
                preview.style.display = 'none';
                return;
            }
            
            // 檢查行是否在當前範圍內
            const startLine = window.currentStartLine || 1;
            const endLine = window.currentEndLine || this.getTotalLines();
            const totalLines = this.getTotalLines();
            
            console.log('📊 當前範圍:', { startLine, endLine, lineNumber, totalLines });
            
            // 檢查是否超出文件範圍
            if (lineNumber > totalLines) {
                content.innerHTML = `<span class="preview-error">超出文件範圍（總共 ${totalLines} 行）</span>`;
                preview.style.display = 'block';
                return;
            }
            
            // 如果在當前範圍內，直接顯示
            if (lineNumber >= startLine && lineNumber <= endLine) {
                const lineElement = document.getElementById(`line-${lineNumber}`);
                if (lineElement) {
                    const lineContent = lineElement.querySelector('.line-content');
                    if (lineContent) {
                        const text = lineContent.textContent || lineContent.innerText || '';
                        const truncated = text.length > 80 ? text.substring(0, 80) + '...' : text;
                        content.innerHTML = `<span class="preview-line-number">第 ${lineNumber} 行:</span> ${truncated || '(空白行)'}`;
                        preview.style.display = 'block';
                        console.log('👁️ 預覽內容已更新（範圍內）');
                        return;
                    }
                }
            }
            
            // 如果不在範圍內，嘗試載入預覽
            this.loadOutOfRangePreview(lineNumber, content, preview);
        },
        
        // 載入範圍外預覽
        loadOutOfRangePreview: function(lineNumber, contentElement, previewElement) {
            console.log('🔍 載入範圍外預覽:', lineNumber);
            
            // 添加載入狀態到輸入框和預覽區
            const input = document.getElementById('goto-line-input');
            if (input) {
                input.classList.add('loading');
            }
            previewElement.classList.add('loading');
            
            // 顯示載入狀態
            contentElement.innerHTML = `
                <span class="preview-loading">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    正在載入第 ${lineNumber} 行的預覽...
                </span>
            `;
            previewElement.style.display = 'block';
            
            // 獲取文件路徑
            const currentFilePath = this.getCurrentFilePath();
            if (!currentFilePath) {
                this.showPreviewError(contentElement, previewElement, input, '無法獲取文件路徑');
                return;
            }
            
            // 發送AJAX請求獲取行內容
            const requestUrl = `/api/get_line_content?path=${encodeURIComponent(currentFilePath)}&line=${lineNumber}`;
            
            // 設置請求超時
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超時
            
            fetch(requestUrl, { 
                signal: controller.signal,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
                .then(response => {
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.content !== undefined) {
                        const text = data.content || '';
                        const truncated = text.length > 80 ? text.substring(0, 80) + '...' : text;
                        contentElement.innerHTML = `
                            <span class="preview-line-number">第 ${lineNumber} 行:</span> 
                            ${truncated || '(空白行)'}
                            <span class="preview-out-of-range">
                                <i class="fas fa-external-link-alt me-1"></i>範圍外
                            </span>
                        `;
                        previewElement.classList.remove('loading');
                        previewElement.classList.remove('error');
                        console.log('👁️ 範圍外預覽載入成功');
                    } else {
                        throw new Error(data.message || '無法獲取行內容');
                    }
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    console.error('❌ 載入預覽失敗:', error);
                    
                    let errorMessage;
                    if (error.name === 'AbortError') {
                        errorMessage = '載入超時，請稍後再試';
                    } else if (error.message.includes('HTTP 404')) {
                        errorMessage = '預覽功能暫不可用';
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMessage = '網路連接問題';
                    } else {
                        errorMessage = '載入失敗';
                    }
                    
                    contentElement.innerHTML = `
                        <span class="preview-line-number">第 ${lineNumber} 行:</span> 
                        <span class="preview-out-of-range">
                            <i class="fas fa-external-link-alt me-1"></i>
                            ${errorMessage}，跳轉時將載入
                        </span>
                    `;
                    previewElement.classList.remove('loading');
                })
                .finally(() => {
                    // 移除載入狀態
                    if (input) {
                        input.classList.remove('loading');
                    }
                    previewElement.classList.remove('loading');
                });
        },
        
        // 顯示預覽錯誤
        showPreviewError: function(contentElement, previewElement, inputElement, message) {
            contentElement.innerHTML = `<span class="preview-error">${message}</span>`;
            previewElement.classList.remove('loading');
            previewElement.classList.add('error');
            if (inputElement) {
                inputElement.classList.remove('loading');
            }
        },
        
        // 獲取當前文件路徑
        getCurrentFilePath: function() {
            // 方式1: 從全域變數獲取
            if (window.currentFilePath) {
                return window.currentFilePath;
            }
            
            // 方式2: 從URL參數獲取
            const urlParams = new URLSearchParams(window.location.search);
            const pathFromUrl = urlParams.get('path');
            if (pathFromUrl) {
                return pathFromUrl;
            }
            
            // 方式3: 從隱藏輸入框獲取
            const pathInput = document.getElementById('initial-file-path');
            if (pathInput && pathInput.value) {
                return pathInput.value;
            }
            
            // 方式4: 從頁面標題或其他地方推斷
            const fileInfo = document.querySelector('.file-info-badge .info-item span');
            if (fileInfo && fileInfo.textContent) {
                return fileInfo.textContent.trim();
            }
            
            console.warn('⚠️ 無法獲取文件路徑');
            return null;
        },
        
        // 驗證輸入
        validateInput: function() {
            const input = document.getElementById('goto-line-input');
            const button = document.querySelector('.goto-jump-btn');
            
            if (!input || !button) {
                console.log('⚠️ 驗證元素不完整');
                return;
            }
            
            const lineNumber = parseInt(input.value);
            const totalLines = this.getTotalLines();
            
            console.log('✅ 驗證輸入:', { lineNumber, totalLines });
            
            if (lineNumber && lineNumber >= 1 && lineNumber <= totalLines) {
                input.classList.remove('invalid');
                button.disabled = false;
                console.log('✅ 輸入有效');
            } else {
                input.classList.add('invalid');
                button.disabled = true;
                console.log('❌ 輸入無效');
            }
        },
        
        // 執行跳轉
        executeGoto: function() {
            console.log('🚀 執行跳轉');
            
            const input = document.getElementById('goto-line-input');
            
            if (!input) {
                console.error('❌ 找不到輸入框');
                this.showError('系統錯誤：找不到輸入框');
                return;
            }
            
            const lineNumber = parseInt(input.value);
            const totalLines = this.getTotalLines();
            
            console.log('🚀 跳轉參數:', { lineNumber, totalLines });
            
            if (!lineNumber || lineNumber < 1 || lineNumber > totalLines) {
                input.classList.add('invalid');
                input.focus();
                this.showError(`請輸入有效的行號 (1-${totalLines})`);
                console.log('❌ 行號驗證失敗');
                return;
            }
            
            // 關閉對話框
            this.closeDialog();
            
            // 顯示跳轉動畫
            this.showJumpingAnimation(lineNumber);
            
            // 執行跳轉
            setTimeout(() => {
                this.performJump(lineNumber);
            }, 100);
        },
        
        // 執行實際跳轉
        performJump: function(lineNumber) {
            console.log('🎯 執行實際跳轉到行:', lineNumber);
            
            try {
                // 檢查行號是否在當前範圍內
                const startLine = window.currentStartLine || 1;
                const endLine = window.currentEndLine || this.getTotalLines();
                const isInRange = lineNumber >= startLine && lineNumber <= endLine;
                
                console.log('📊 範圍檢查:', { lineNumber, startLine, endLine, isInRange });
                
                // 方式1: 如果在範圍內，直接滾動
                if (isInRange) {
                    const lineElement = document.getElementById(`line-${lineNumber}`);
                    if (lineElement) {
                        console.log('🎯 滾動到行元素');
                        lineElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                        
                        // 高亮該行
                        this.highlightLine(lineElement);
                        return;
                    }
                }
                
                // 方式2: 使用現有的 jumpToLine 函數
                if (typeof window.jumpToLine === 'function') {
                    console.log('📞 調用 window.jumpToLine');
                    window.jumpToLine(lineNumber);
                    return;
                }
                
                // 方式3: 超出範圍時提示用戶並跳轉
                console.log('🌐 需要重新載入頁面跳轉');
                this.showPageReloadConfirmation(lineNumber);
                
            } catch (error) {
                console.error('❌ 跳轉執行錯誤:', error);
                this.showError('跳轉失敗，請稍後再試');
            }
        },
        
        // 顯示頁面重新載入確認
        showPageReloadConfirmation: function(lineNumber) {
            console.log('📋 顯示重新載入確認');
            
            const startLine = window.currentStartLine || 1;
            const endLine = window.currentEndLine || this.getTotalLines();
            
            // 創建確認對話框
            const confirmDialog = document.createElement('div');
            confirmDialog.className = 'goto-confirm-dialog';
            confirmDialog.innerHTML = `
                <div class="confirm-overlay"></div>
                <div class="confirm-content">
                    <div class="confirm-header">
                        <h5><i class="fas fa-info-circle me-2"></i>需要重新載入頁面</h5>
                    </div>
                    <div class="confirm-body">
                        <p>第 <strong>${lineNumber}</strong> 行不在目前顯示範圍內。</p>
                        <div class="range-info">
                            <div class="current-range">
                                <i class="fas fa-eye me-1"></i>
                                目前範圍: 第 ${startLine} - ${endLine} 行
                            </div>
                            <div class="target-range">
                                <i class="fas fa-crosshairs me-1"></i>
                                跳轉目標: 第 ${lineNumber} 行
                            </div>
                        </div>
                        <p class="confirm-message">
                            <i class="fas fa-refresh me-1"></i>
                            系統將重新載入頁面以顯示目標行及其上下文。
                        </p>
                    </div>
                    <div class="confirm-footer">
                        <button class="btn btn-outline-secondary confirm-cancel">
                            <i class="fas fa-times me-1"></i>取消
                        </button>
                        <button class="btn btn-gradient-primary confirm-proceed">
                            <i class="fas fa-arrow-right me-1"></i>繼續跳轉
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmDialog);
            
            // 顯示動畫
            setTimeout(() => {
                confirmDialog.classList.add('show');
            }, 10);
            
            // 綁定事件
            const cancelBtn = confirmDialog.querySelector('.confirm-cancel');
            const proceedBtn = confirmDialog.querySelector('.confirm-proceed');
            const overlay = confirmDialog.querySelector('.confirm-overlay');
            
            const closeDialog = () => {
                confirmDialog.classList.remove('show');
                setTimeout(() => {
                    if (confirmDialog.parentNode) {
                        confirmDialog.remove();
                    }
                }, 300);
            };
            
            // 取消按鈕
            cancelBtn.addEventListener('click', closeDialog);
            overlay.addEventListener('click', closeDialog);
            
            // 繼續按鈕
            proceedBtn.addEventListener('click', () => {
                closeDialog();
                
                // 顯示載入提示
                this.showNavigatingAnimation(lineNumber);
                
                // 執行頁面跳轉
                setTimeout(() => {
                    const url = new URL(window.location);
                    url.searchParams.set('line', lineNumber);
                    url.searchParams.set('start', Math.max(1, lineNumber - 200));
                    url.searchParams.set('end', Math.min(this.getTotalLines(), lineNumber + 200));
                    url.searchParams.set('from', this.getCurrentLine());
                    window.location.href = url.toString();
                }, 500);
            });
            
            // ESC 鍵關閉
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    closeDialog();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        },
        
        // 顯示導航動畫
        showNavigatingAnimation: function(lineNumber) {
            console.log('🚀 顯示導航動畫');
            
            const animation = document.createElement('div');
            animation.className = 'goto-navigating-animation show';
            animation.innerHTML = `
                <div class="navigating-content">
                    <div class="navigating-spinner"></div>
                    <div class="navigating-text">正在導航到第 ${lineNumber} 行</div>
                    <div class="navigating-subtext">頁面載入中，請稍候...</div>
                </div>
            `;
            
            document.body.appendChild(animation);
        },
        
        // 高亮行
        highlightLine: function(element) {
            console.log('🎨 高亮行');
            
            // 移除之前的高亮
            document.querySelectorAll('.highlighted-line').forEach(el => {
                el.classList.remove('highlighted-line');
            });
            
            // 添加新的高亮
            element.classList.add('highlighted-line');
            
            // 3秒後移除高亮
            setTimeout(() => {
                element.classList.remove('highlighted-line');
            }, 3000);
        },
        
        // 顯示跳轉動畫
        showJumpingAnimation: function(lineNumber) {
            console.log('🎬 顯示跳轉動畫');
            
            // 移除可能存在的舊動畫
            const existingAnimation = document.querySelector('.goto-jumping-animation');
            if (existingAnimation) {
                existingAnimation.remove();
            }
            
            const animation = document.createElement('div');
            animation.className = 'goto-jumping-animation';
            animation.innerHTML = `
                <div class="jumping-content">
                    <div class="jumping-icon">
                        <i class="fas fa-rocket"></i>
                    </div>
                    <div class="jumping-text">正在跳轉到第 ${lineNumber} 行...</div>
                    <div class="jumping-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(animation);
            
            // 動畫效果
            setTimeout(() => {
                animation.classList.add('show');
            }, 10);
            
            // 3秒後自動移除
            setTimeout(() => {
                animation.classList.remove('show');
                setTimeout(() => {
                    if (animation.parentNode) {
                        animation.remove();
                    }
                }, 300);
            }, 2000);
        },
        
        // 顯示錯誤訊息
        showError: function(message) {
            console.log('❌ 顯示錯誤:', message);
            
            // 使用 Toast 系統（如果存在）
            if (typeof window.showToast === 'function') {
                window.showToast('warning', message);
                return;
            }
            
            // 備用：使用 alert
            alert(message);
        }
    };
    
    // 初始化等待DOM載入完成
    function initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    GotoLineManager.init();
                }, 500); // 延遲500ms確保其他腳本載入完成
            });
        } else {
            // DOM已經載入完成
            setTimeout(() => {
                GotoLineManager.init();
            }, 500);
        }
    }
    
    // 執行初始化
    initializeWhenReady();
    
    // 導出到全域
    window.GotoLineManager = GotoLineManager;
    
    // 為了相容性，也導出一些全域函數
    window.showGotoDialog = function() {
        GotoLineManager.showDialog();
    };
    
    console.log('🎯 Ctrl+G 跳轉功能載入完成');
    
})();