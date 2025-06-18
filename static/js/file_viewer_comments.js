// Enhanced File Viewer Comments System JS - Complete

// 全域變數
let currentEditingCommentId = null;
let comments = [];
let commentAttachments = [];
let savedSelection = null;
let isSubmitting = false; // 防止重複提交

// 初始化評論系統
function initCommentSystem() {
    console.log('初始化評論系統...');
    
    // 創建評論區塊
    createCommentsSection();
    
    // 創建返回評論區按鈕
    createBackToCommentsButton();
    
    // 綁定事件
    bindCommentEvents();
    
    // 載入現有評論
    loadComments();
    
    // 初始化程式碼分隔線
    initCodeResizer();
}

// 創建返回評論區按鈕
function createBackToCommentsButton() {
    if (!document.getElementById('back-to-comments-btn')) {
        const btn = document.createElement('a');
        btn.id = 'back-to-comments-btn';
        btn.className = 'back-to-comments-btn';
        btn.href = '#comments-section';
        btn.innerHTML = '<i class="fas fa-arrow-up"></i> 返回評論區';
        btn.onclick = function(e) {
            e.preventDefault();
            document.getElementById('comments-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        };
        document.body.appendChild(btn);
    }
}

// 創建評論區塊
function createCommentsSection() {
    // 確保評論區塊存在
    if (!document.getElementById('comments-section')) {
        const commentsSectionHTML = `
            <div id="comments-section" class="comments-section" style="display: none;">
                <div class="comments-header">
                    <h4>
                        <i class="fas fa-comments"></i>
                        使用者評論
                        <span class="comments-count">0</span>
                    </h4>
                </div>
                <div id="comments-list" class="comments-list">
                    <div class="comments-empty">
                        <i class="fas fa-comment-slash"></i>
                        <p>目前沒有評論</p>
                    </div>
                </div>
            </div>
        `;
        
        // 在檔案檢視器後面插入評論區塊
        const fileViewer = document.querySelector('.file-viewer');
        if (fileViewer) {
            fileViewer.insertAdjacentHTML('afterend', commentsSectionHTML);
        }
    }
}

// 新增：初始化程式碼分隔線
function initCodeResizer() {
    const resizer = document.getElementById('code-resizer');
    if (!resizer) return;
    
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    let startRightWidth = 0;
    
    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        
        const inputSection = document.querySelector('.code-input-section');
        const previewSection = document.querySelector('.code-preview-section');
        
        startLeftWidth = inputSection.offsetWidth;
        startRightWidth = previewSection.offsetWidth;
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const container = document.querySelector('.code-dialog-body');
        const containerWidth = container.offsetWidth - 20 - 6; // 減去 padding 和 resizer 寬度
        
        const newLeftWidth = startLeftWidth + deltaX;
        const newRightWidth = startRightWidth - deltaX;
        
        // 限制最小寬度
        const minWidth = 200;
        if (newLeftWidth >= minWidth && newRightWidth >= minWidth) {
            const leftPercent = (newLeftWidth / containerWidth) * 100;
            const rightPercent = (newRightWidth / containerWidth) * 100;
            
            document.querySelector('.code-input-section').style.flex = `0 0 ${leftPercent}%`;
            document.querySelector('.code-preview-section').style.flex = `0 0 ${rightPercent}%`;
        }
    }
    
    function handleMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

// 新增：評論管理按鈕功能
window.toggleCommentsView = function() {
    const section = document.getElementById('comments-section');
    const fab = document.querySelector('.comment-manager-fab');
    
    if (section.style.display === 'none' || !section.style.display) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        fab.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    } else {
        section.style.display = 'none';
        fab.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
}

// 處理編輯器右鍵選單 - 移到全域範圍
function handleEditorContextMenu(e) {
    const target = e.target;
    
    // 表格右鍵選單
    if (target.tagName === 'TD' || target.tagName === 'TH' || 
        target.closest('table')) {
        e.preventDefault();
        showTableContextMenu(e, target.closest('table'));
    }
    // 圖片右鍵選單
    else if (target.tagName === 'IMG') {
        e.preventDefault();
        showElementContextMenu(e, target, 'image');
    }
    // 程式碼區塊右鍵選單
    else if (target.tagName === 'PRE' || target.closest('pre')) {
        e.preventDefault();
        showElementContextMenu(e, target.closest('pre'), 'code');
    }
    // 引用區塊右鍵選單
    else if (target.tagName === 'BLOCKQUOTE' || target.closest('blockquote')) {
        e.preventDefault();
        showElementContextMenu(e, target.closest('blockquote'), 'quote');
    }
}

// 綁定評論相關事件
function bindCommentEvents() {
    // 對話框關閉
    const closeBtn = document.querySelector('.comment-dialog-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCommentDialog);
    }
    
    // 點擊遮罩關閉
    const overlay = document.querySelector('.comment-dialog-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeCommentDialog);
    }
    
    // 富文本編輯器工具列
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        btn.addEventListener('click', handleToolbarClick);
    });
    
    // 編輯器事件
    const editor = document.getElementById('comment-editor');
    if (editor) {
        // 貼上事件
        editor.addEventListener('paste', handlePaste);
        
        // 拖放事件
        editor.addEventListener('dragover', handleDragOver);
        editor.addEventListener('drop', handleDrop);
        editor.addEventListener('dragleave', handleDragLeave);
        
        // 輸入事件監聽即時預覽
        editor.addEventListener('input', updateEditorPreview);
        
        // 選擇變化事件
        document.addEventListener('selectionchange', updateToolbarState);
        
        // 新增：滑鼠選擇事件
        editor.addEventListener('mouseup', saveSelection);
        editor.addEventListener('keyup', saveSelection);
        
        // 處理引用前後插入空白行
        editor.addEventListener('keydown', handleBlockquoteNavigation);
    }
    
    // 送出按鈕
    const submitBtn = document.getElementById('submit-comment');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitComment);
    }
    
    // 取消按鈕
    const cancelBtn = document.getElementById('cancel-comment');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCommentDialog);
    }
    
    // 程式碼輸入框事件
    const codeTextarea = document.getElementById('code-textarea');
    if (codeTextarea) {
        codeTextarea.addEventListener('input', updateCodePreview);
    }
    
    // 程式碼語言選擇
    const codeLang = document.getElementById('code-language');
    if (codeLang) {
        codeLang.addEventListener('change', updateCodePreview);
    }
    
    // 綁定編輯器右鍵選單
    bindEditorContextMenu();
    
    // 點擊其他地方關閉顏色選擇器
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.color-picker-wrapper')) {
            document.querySelectorAll('.color-palette.show').forEach(palette => {
                palette.classList.remove('show');
            });
        }
    });
}

// 處理引用前後插入空白行
function handleBlockquoteNavigation(e) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const blockquote = node.nodeType === 3 ? node.parentElement.closest('blockquote') : node.closest('blockquote');
    
    if (blockquote) {
        // 在引用塊的開頭按向上鍵
        if (e.key === 'ArrowUp' && range.startOffset === 0) {
            const firstChild = blockquote.firstChild;
            if (node === firstChild || node.parentElement === firstChild) {
                e.preventDefault();
                // 在引用前插入新段落
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                blockquote.parentNode.insertBefore(p, blockquote);
                // 將游標移到新段落
                const newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.setEnd(p, 0);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
        // 在引用塊的結尾按向下鍵
        else if (e.key === 'ArrowDown') {
            const lastChild = blockquote.lastChild;
            const isAtEnd = node === lastChild || node.parentElement === lastChild;
            if (isAtEnd && range.endOffset === (node.nodeType === 3 ? node.textContent.length : node.childNodes.length)) {
                e.preventDefault();
                // 在引用後插入新段落
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                if (blockquote.nextSibling) {
                    blockquote.parentNode.insertBefore(p, blockquote.nextSibling);
                } else {
                    blockquote.parentNode.appendChild(p);
                }
                // 將游標移到新段落
                const newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.setEnd(p, 0);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
        // 在引用塊內按 Enter + Shift
        else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            // 退出引用，在下方創建新段落
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            if (blockquote.nextSibling) {
                blockquote.parentNode.insertBefore(p, blockquote.nextSibling);
            } else {
                blockquote.parentNode.appendChild(p);
            }
            // 將游標移到新段落
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.setEnd(p, 0);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }
}

// 新增：儲存文字選擇範圍
function saveSelection() {
    const editor = document.getElementById('comment-editor');
    if (document.activeElement === editor) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedSelection = selection.getRangeAt(0).cloneRange();
        }
    }
}

// 新增：恢復文字選擇範圍
function restoreSelection() {
    if (savedSelection) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelection);
    }
}

// 完整初始化編輯器
function initializeEditorComplete() {
    const editor = document.getElementById('comment-editor');
    if (!editor) return;
    
    // 綁定編輯器事件
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('dragover', handleDragOver);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('dragleave', handleDragLeave);
    editor.addEventListener('input', updateEditorPreview);
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('keydown', handleBlockquoteNavigation);
    editor.addEventListener('contextmenu', handleEditorContextMenu);
    
    // 綁定工具列按鈕事件
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleToolbarClick(e);
        });
    });
    
    // 重新初始化右鍵選單
    bindEditorContextMenu();
    
    // 點擊其他地方關閉顏色選擇器
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.color-picker-wrapper')) {
            document.querySelectorAll('.color-palette.show').forEach(palette => {
                palette.classList.remove('show');
            });
        }
    });
}

// 開啟評論對話框 - 全域函數
window.openCommentDialog = function(editId = null) {
    const dialog = document.getElementById('comment-dialog');
    if (!dialog) return;
    
    dialog.classList.add('show');
    document.body.style.overflow = 'hidden';
    isSubmitting = false;
    
    // 重置編輯器
    const editor = document.getElementById('comment-editor');
    if (editor) {
        // 移除所有事件監聽器
        const newEditor = editor.cloneNode(false);
        newEditor.id = 'comment-editor';
        newEditor.className = 'comment-editor';
        newEditor.contentEditable = 'true';
        newEditor.setAttribute('placeholder', '在此輸入評論內容...支援拖放或貼上圖片');
        editor.parentNode.replaceChild(newEditor, editor);
    }
    
    // 重新綁定工具列按鈕
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // 延遲初始化
    setTimeout(() => {
        const editor = document.getElementById('comment-editor');
        const topicInput = document.getElementById('comment-topic');
        
        if (editId) {
            // 編輯模式
            currentEditingCommentId = editId;
            const comment = comments.find(c => c.id === editId);
            if (comment && editor) {
                editor.innerHTML = comment.content;
                if (topicInput) topicInput.value = comment.topic || '一般討論';
                updateDialogForEdit();
            }
        } else {
            // 新增模式
            currentEditingCommentId = null;
            if (editor) editor.innerHTML = '';
            if (topicInput) topicInput.value = '';
            updateDialogForCreate();
        }
        
        // 初始化編輯器
        initializeEditorComplete();
        
        // 確保焦點
        if (editor) editor.focus();
    }, 100);
    
    // 清空附件
    commentAttachments = [];
    updateAttachmentsDisplay();
    
    // 重置分隔線位置
    resetCodeResizer();
    
    // 確保按鈕可見
    ensureButtonsVisible();
}

// 新增：清理編輯器事件
function cleanupEditorEvents() {
    const editor = document.getElementById('comment-editor');
    if (editor) {
        // 克隆節點以移除所有事件監聽器
        const newEditor = editor.cloneNode(true);
        editor.parentNode.replaceChild(newEditor, editor);
    }
    
    // 清理工具列按鈕
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
}

// 新增：初始化編輯器
function initializeEditor() {
    const editor = document.getElementById('comment-editor');
    if (!editor) return;
    
    // 綁定編輯器事件
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('dragover', handleDragOver);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('dragleave', handleDragLeave);
    editor.addEventListener('input', updateEditorPreview);
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('keydown', handleBlockquoteNavigation);
    editor.addEventListener('contextmenu', handleEditorContextMenu);
    
    // 綁定工具列按鈕
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        btn.addEventListener('click', handleToolbarClick);
    });
    
    // 設置焦點
    editor.focus();
    
    // 綁定右鍵選單
    bindEditorContextMenu();
}

// 新增：更新對話框為編輯模式
function updateDialogForEdit() {
    const header = document.querySelector('.comment-dialog-header h5');
    const submitBtn = document.getElementById('submit-comment');
    
    if (header) {
        header.innerHTML = '<i class="fas fa-edit"></i>編輯評論';
    }
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> 更新';
    }
}

// 新增：更新對話框為新增模式
function updateDialogForCreate() {
    const header = document.querySelector('.comment-dialog-header h5');
    const submitBtn = document.getElementById('submit-comment');
    
    if (header) {
        header.innerHTML = '<i class="fas fa-comment-plus"></i>新增評論';
    }
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出';
    }
}

// 確保按鈕可見
function ensureButtonsVisible() {
    const footer = document.querySelector('.comment-dialog-footer');
    const submitBtn = document.getElementById('submit-comment');
    const cancelBtn = document.getElementById('cancel-comment');
    
    if (footer) {
        footer.style.display = 'flex';
        footer.style.visibility = 'visible';
        footer.style.opacity = '1';
        footer.style.zIndex = '10001';
    }
    
    if (submitBtn) {
        submitBtn.style.display = 'inline-flex';
        submitBtn.style.visibility = 'visible';
        submitBtn.style.opacity = '1';
        submitBtn.style.zIndex = '10003';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.style.visibility = 'visible';
        cancelBtn.style.opacity = '1';
        cancelBtn.style.zIndex = '10003';
    }
}

// 綁定編輯器事件
function bindEditorEvents(editor) {
    // 移除舊的事件監聽器
    editor.removeEventListener('mouseup', saveSelection);
    editor.removeEventListener('keyup', saveSelection);
    editor.removeEventListener('keydown', handleBlockquoteNavigation);
    
    // 重新綁定
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('keydown', handleBlockquoteNavigation);
}

// 新增：重置程式碼分隔線位置
function resetCodeResizer() {
    const inputSection = document.querySelector('.code-input-section');
    const previewSection = document.querySelector('.code-preview-section');
    
    if (inputSection && previewSection) {
        inputSection.style.flex = '1';
        previewSection.style.flex = '1';
    }
}

// 關閉評論對話框
function closeCommentDialog() {
    const dialog = document.getElementById('comment-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        document.body.style.overflow = '';
        
        // 清理
        currentEditingCommentId = null;
        window.currentReplyingToId = null; // 清除回覆狀態
        commentAttachments = [];
        savedSelection = null;
        isSubmitting = false;
        document.getElementById('comment-editor').innerHTML = '';
        updateAttachmentsDisplay();
    }
}

// 處理工具列點擊
function handleToolbarClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const command = btn.dataset.command;
    const value = btn.dataset.value || null;
    
    // 確保編輯器獲得焦點
    const editor = document.getElementById('comment-editor');
    if (!editor) return;
    
    editor.focus();
    
    // 恢復之前的選擇範圍
    if (savedSelection && (command === 'foreColor' || command === 'backColor')) {
        restoreSelection();
    }
    
    switch(command) {
        case 'createLink':
            const url = prompt('請輸入連結網址：', 'https://');
            if (url) {
                document.execCommand(command, false, url);
            }
            break;
            
        case 'insertImage':
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleImageFile(file);
                }
            };
            input.click();
            break;
            
        case 'insertCode':
            openCodeDialog();
            break;
            
        case 'insertTable':
            const rows = prompt('請輸入表格行數：', '3');
            const cols = prompt('請輸入表格列數：', '3');
            if (rows && cols) {
                const table = createTable(parseInt(rows), parseInt(cols));
                document.execCommand('insertHTML', false, table);
            }
            break;
            
        case 'formatBlock':
            if (value === 'blockquote') {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const blockquote = document.createElement('blockquote');
                    
                    try {
                        blockquote.appendChild(range.extractContents());
                        range.insertNode(blockquote);
                        range.selectNodeContents(blockquote);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (e) {
                        console.error('引用插入失敗:', e);
                    }
                }
            } else {
                document.execCommand(command, false, value);
            }
            break;
            
        case 'foreColor':
        case 'backColor':
            showColorPicker(command);
            break;
            
        default:
            try {
                document.execCommand(command, false, value);
            } catch (e) {
                console.error('命令執行失敗:', e);
            }
    }
    
    // 更新按鈕狀態
    setTimeout(updateToolbarState, 10);
}

// 顯示顏色選擇器
function showColorPicker(command) {
    const existingPicker = document.querySelector('.color-palette.show');
    if (existingPicker) {
        existingPicker.classList.remove('show');
    }
    
    const btn = document.querySelector(`[data-command="${command}"]`);
    const wrapper = btn.closest('.color-picker-wrapper');
    const picker = wrapper.querySelector('.color-palette');
    if (picker) {
        picker.classList.add('show');
    }
}

// 修正：應用顏色函數
window.applyColor = function(color, command) {
    const editor = document.getElementById('comment-editor');
    
    // 確保編輯器獲得焦點
    editor.focus();
    
    // 嘗試恢復之前儲存的選擇範圍
    if (savedSelection) {
        try {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedSelection);
        } catch (e) {
            console.error('恢復選擇範圍失敗:', e);
        }
    }
    
    // 檢查是否有選擇範圍
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || selection.isCollapsed) {
        // 如果沒有選擇範圍，創建一個簡單的提示
        const span = document.createElement('span');
        span.textContent = '選擇的文字';
        span.style.backgroundColor = command === 'backColor' ? color : '';
        span.style.color = command === 'foreColor' ? color : '';
        
        // 在游標位置插入
        try {
            document.execCommand('insertHTML', false, span.outerHTML);
        } catch (e) {
            console.error('插入顏色文字失敗:', e);
        }
    } else {
        // 有選擇範圍，應用顏色
        try {
            const success = document.execCommand(command, false, color);
            if (!success) {
                // 如果 execCommand 失敗，手動處理
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                
                if (command === 'foreColor') {
                    span.style.color = color;
                } else if (command === 'backColor') {
                    span.style.backgroundColor = color;
                }
                
                span.appendChild(range.extractContents());
                range.insertNode(span);
                
                // 重新選擇
                range.selectNodeContents(span);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (e) {
            console.error('應用顏色失敗:', e);
        }
    }
    
    // 關閉顏色選擇器
    document.querySelector('.color-palette.show')?.classList.remove('show');
    
    // 更新按鈕指示器
    const btn = document.querySelector(`[data-command="${command}"]`);
    if (btn) {
        const indicator = btn.querySelector('.color-indicator');
        if (indicator) {
            if (command === 'foreColor') {
                indicator.style.background = color;
            } else {
                indicator.style.background = color;
            }
        }
    }
    
    // 清除儲存的選擇範圍並重新儲存當前範圍
    savedSelection = null;
    setTimeout(saveSelection, 10);
    
    // 保持焦點
    editor.focus();
}

// 程式碼對話框功能
function openCodeDialog() {
    const dialog = document.getElementById('code-dialog');
    if (dialog) {
        dialog.classList.add('show');
        dialog.style.zIndex = '10100'; // 確保在最上層
        
        const textarea = document.getElementById('code-textarea');
        const wrapper = document.querySelector('.code-textarea-wrapper');
        
        if (textarea) {
            textarea.focus();
            
            // 綁定拖放事件
            textarea.addEventListener('dragover', handleCodeDragOver);
            textarea.addEventListener('drop', handleCodeDrop);
            textarea.addEventListener('dragleave', handleCodeDragLeave);
            textarea.addEventListener('dragenter', handleCodeDragEnter);
        }
        
        // 創建拖放提示覆蓋層（如果不存在）
        if (!document.getElementById('code-drop-overlay')) {
            const dropOverlay = document.createElement('div');
            dropOverlay.id = 'code-drop-overlay';
            dropOverlay.className = 'code-drop-overlay';
            dropOverlay.innerHTML = '拖曳檔案到這裡';
            
            if (wrapper) {
                wrapper.appendChild(dropOverlay);
            } else if (textarea) {
                textarea.parentElement.appendChild(dropOverlay);
            }
        }
        
        // 初始化預覽
        updateCodePreview();
        
        // 重置分隔線位置
        resetCodeResizer();
    }
}

// 更新程式碼預覽
function updateCodePreview() {
    const language = document.getElementById('code-language').value;
    const code = document.getElementById('code-textarea').value;
    const preview = document.querySelector('.code-preview');
    
    if (preview) {
        if (code.trim()) {
            const highlightedCode = highlightCode(code, language);
            preview.innerHTML = `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
        } else {
            preview.innerHTML = '<pre><code>// 程式碼預覽將顯示在這裡</code></pre>';
        }
    }
}

// 處理程式碼區域拖放進入
function handleCodeDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 處理程式碼區域拖放
function handleCodeDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const overlay = document.getElementById('code-drop-overlay');
    const textarea = document.getElementById('code-textarea');
    
    if (overlay) {
        overlay.classList.add('active');
    }
    if (textarea) {
        textarea.classList.add('drop-active');
    }
}

function handleCodeDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 檢查是否真的離開了拖放區域
    const wrapper = e.currentTarget.parentElement;
    const relatedTarget = e.relatedTarget;
    
    if (wrapper && relatedTarget && wrapper.contains(relatedTarget)) {
        return;
    }
    
    const overlay = document.getElementById('code-drop-overlay');
    const textarea = document.getElementById('code-textarea');
    
    if (overlay) {
        overlay.classList.remove('active');
    }
    if (textarea) {
        textarea.classList.remove('drop-active');
    }
}

async function handleCodeDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const overlay = document.getElementById('code-drop-overlay');
    const textarea = document.getElementById('code-textarea');
    
    if (overlay) {
        overlay.classList.remove('active');
    }
    if (textarea) {
        textarea.classList.remove('drop-active');
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        const file = files[0];
        // 讀取檔案內容
        const reader = new FileReader();
        reader.onload = (event) => {
            textarea.value = event.target.result;
            // 嘗試自動偵測語言
            const ext = file.name.split('.').pop().toLowerCase();
            const langMap = {
                'js': 'javascript',
                'py': 'python',
                'java': 'java',
                'c': 'c',
                'cpp': 'cpp',
                'xml': 'xml',
                'json': 'json',
                'html': 'html',
                'css': 'css',
                'sql': 'sql',
                'sh': 'bash',
                'kt': 'kotlin'
            };
            if (langMap[ext]) {
                document.getElementById('code-language').value = langMap[ext];
            }
            // 更新預覽
            updateCodePreview();
        };
        reader.readAsText(file);
    }
}

window.closeCodeDialog = function() {
    const dialog = document.getElementById('code-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        document.getElementById('code-textarea').value = '';
        document.getElementById('code-language').value = 'javascript';
        
        // 移除事件監聽器
        const textarea = document.getElementById('code-textarea');
        if (textarea) {
            textarea.removeEventListener('dragover', handleCodeDragOver);
            textarea.removeEventListener('drop', handleCodeDrop);
            textarea.removeEventListener('dragleave', handleCodeDragLeave);
            textarea.removeEventListener('dragenter', handleCodeDragEnter);
        }
        
        // 移除拖放提示覆蓋層
        const overlay = document.getElementById('code-drop-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

window.insertCodeBlock = function() {
    const language = document.getElementById('code-language').value;
    const code = document.getElementById('code-textarea').value;
    
    if (!code.trim()) {
        showToast('請輸入程式碼', 'warning');
        return;
    }
    
    // 建立具有高亮支援的程式碼區塊
    const pre = document.createElement('pre');
    pre.className = `language-${language}`;
    pre.dataset.elementId = 'element_' + Date.now();
    pre.style.cssText = `
        background: #2d3748;
        color: #e2e8f0;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 12px 0;
        position: relative;
    `;
    
    const codeEl = document.createElement('code');
    codeEl.className = `language-${language}`;
    
    // 進行簡單的語法高亮
    codeEl.innerHTML = highlightCode(code, language);
    
    // 添加語言標籤
    const langLabel = document.createElement('span');
    langLabel.className = 'code-language-label';
    langLabel.textContent = language.toUpperCase();
    langLabel.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(255, 255, 255, 0.1);
        color: #a0aec0;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
    `;
    
    pre.appendChild(langLabel);
    pre.appendChild(codeEl);
    
    // 插入到編輯器
    const editor = document.getElementById('comment-editor');
    editor.focus();
    document.execCommand('insertHTML', false, pre.outerHTML + '<p><br></p>');
    
    closeCodeDialog();
    showToast('程式碼已插入', 'success');
}

// 簡單的語法高亮功能
function highlightCode(code, language) {
    // 先進行 HTML 轉義
    code = code.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    
    // 根據語言進行簡單高亮
    const highlights = {
        javascript: {
            keywords: /\b(var|let|const|function|return|if|else|for|while|new|this|try|catch|class|extends|import|export|default|async|await)\b/g,
            strings: /(["'`])([^"'`]*)(\1)/g,
            comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
            numbers: /\b(\d+)\b/g,
            functions: /\b(\w+)(?=\()/g
        },
        python: {
            keywords: /\b(def|class|import|from|return|if|else|elif|for|while|try|except|with|as|pass|break|continue|lambda|async|await)\b/g,
            strings: /(["'])([^"']*)(\1)/g,
            comments: /(#.*$)/gm,
            numbers: /\b(\d+)\b/g,
            functions: /\b(\w+)(?=\()/g
        },
        java: {
            keywords: /\b(public|private|protected|class|interface|extends|implements|static|final|void|int|long|double|float|boolean|char|String|if|else|for|while|try|catch|throw|throws|new|return|import|package)\b/g,
            strings: /(["'])([^"']*)(\1)/g,
            comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
            numbers: /\b(\d+)\b/g,
            functions: /\b(\w+)(?=\()/g
        }
    };
    
    const lang = highlights[language] || highlights.javascript;
    
    // 應用高亮
    code = code.replace(lang.keywords, '<span style="color: #c792ea;">$&</span>');
    code = code.replace(lang.strings, '<span style="color: #c3e88d;">$&</span>');
    code = code.replace(lang.comments, '<span style="color: #5f7e97;">$&</span>');
    code = code.replace(lang.numbers, '<span style="color: #f78c6c;">$&</span>');
    
    return code;
}

// 更新編輯器預覽
function updateEditorPreview() {
    // 此函數可用於即時預覽編輯器內容
    const editor = document.getElementById('comment-editor');
    // 可以在這裡添加即時預覽邏輯
}

// 處理拖放 - 加入視覺提示
function handleDragOver(e) {
    e.preventDefault();
    const editor = e.currentTarget;
    editor.classList.add('drop-active');
}

function handleDragLeave(e) {
    const editor = e.currentTarget;
    editor.classList.remove('drop-active');
}

async function handleDrop(e) {
    e.preventDefault();
    const editor = e.currentTarget;
    editor.classList.remove('drop-active');
    
    const files = Array.from(e.dataTransfer.files);
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            await handleImageFile(file);
        } else {
            await handleAttachmentFile(file);
        }
    }
}

// 綁定編輯器右鍵選單
function bindEditorContextMenu() {
    const editor = document.getElementById('comment-editor');
    if (!editor) return;
    
    // 移除舊的監聽器
    editor.removeEventListener('contextmenu', handleEditorContextMenu);
    
    // 添加新的監聽器
    editor.addEventListener('contextmenu', handleEditorContextMenu);
}

// 顯示表格右鍵選單
function showTableContextMenu(event, table) {
    removeExistingMenus();
    
    const menu = document.createElement('div');
    menu.className = 'table-context-menu';
    menu.innerHTML = `
        <div class="table-menu-item" onclick="addTableRow(event)">
            <i class="fas fa-plus"></i> 新增行（下方）
        </div>
        <div class="table-menu-item" onclick="addTableRowAbove(event)">
            <i class="fas fa-level-up-alt"></i> 新增行（上方）
        </div>
        <div class="table-menu-item" onclick="deleteTableRow(event)">
            <i class="fas fa-minus"></i> 刪除行
        </div>
        <div class="table-menu-separator"></div>
        <div class="table-menu-item" onclick="addTableColumn(event)">
            <i class="fas fa-plus"></i> 新增列（右側）
        </div>
        <div class="table-menu-item" onclick="addTableColumnLeft(event)">
            <i class="fas fa-arrow-left"></i> 新增列（左側）
        </div>
        <div class="table-menu-item" onclick="deleteTableColumn(event)">
            <i class="fas fa-minus"></i> 刪除列
        </div>
        <div class="table-menu-separator"></div>
        <div class="table-menu-item" onclick="showTableColorMenu(event, 'cell')">
            <i class="fas fa-paint-brush"></i> 設定儲存格顏色
        </div>
        <div class="table-menu-item" onclick="showTableColorMenu(event, 'table')">
            <i class="fas fa-palette"></i> 設定表格顏色
        </div>
        <div class="table-menu-separator"></div>
        <div class="table-menu-item" onclick="copyTable(event)">
            <i class="fas fa-copy"></i> 複製表格
        </div>
        <div class="table-menu-item" onclick="deleteTable(event)">
            <i class="fas fa-trash"></i> 刪除表格
        </div>
    `;
    
    menu.style.left = event.clientX + 'px';  // 改用 clientX
    menu.style.top = event.clientY + 'px';   // 改用 clientY
    menu.dataset.table = getTableId(table);
    menu.dataset.cell = getCellPosition(event.target);
    
    document.body.appendChild(menu);
    
    // 點擊其他地方關閉選單
    setTimeout(() => {
        document.addEventListener('click', removeExistingMenus, { once: true });
    }, 0);
}

// 顯示表格顏色選單
window.showTableColorMenu = function(event, type) {
    const parentMenu = event.target.closest('.table-context-menu');
    
    const colorMenu = document.createElement('div');
    colorMenu.className = 'table-color-menu';
    colorMenu.innerHTML = `
        <div class="table-color-title">選擇${type === 'cell' ? '儲存格' : '表格'}顏色</div>
        <div class="table-color-title" style="margin-top: 10px;">背景顏色</div>
        <div class="table-color-grid">
            <div class="table-color-option" style="background: transparent" onclick="applyTableColor(event, 'background', 'transparent', '${type}')"><i class="fas fa-ban"></i></div>
            <div class="table-color-option" style="background: #f8f9fa" onclick="applyTableColor(event, 'background', '#f8f9fa', '${type}')"></div>
            <div class="table-color-option" style="background: #e9ecef" onclick="applyTableColor(event, 'background', '#e9ecef', '${type}')"></div>
            <div class="table-color-option" style="background: #fce4ec" onclick="applyTableColor(event, 'background', '#fce4ec', '${type}')"></div>
            <div class="table-color-option" style="background: #fff3e0" onclick="applyTableColor(event, 'background', '#fff3e0', '${type}')"></div>
            <div class="table-color-option" style="background: #fff9c4" onclick="applyTableColor(event, 'background', '#fff9c4', '${type}')"></div>
            <div class="table-color-option" style="background: #f1f8e9" onclick="applyTableColor(event, 'background', '#f1f8e9', '${type}')"></div>
            <div class="table-color-option" style="background: #e0f2f1" onclick="applyTableColor(event, 'background', '#e0f2f1', '${type}')"></div>
            <div class="table-color-option" style="background: #e3f2fd" onclick="applyTableColor(event, 'background', '#e3f2fd', '${type}')"></div>
            <div class="table-color-option" style="background: #f3e5f5" onclick="applyTableColor(event, 'background', '#f3e5f5', '${type}')"></div>
        </div>
        <div class="table-color-title" style="margin-top: 10px;">文字顏色</div>
        <div class="table-color-grid">
            <div class="table-color-option" style="background: #000000" onclick="applyTableColor(event, 'color', '#000000', '${type}')"></div>
            <div class="table-color-option" style="background: #495057" onclick="applyTableColor(event, 'color', '#495057', '${type}')"></div>
            <div class="table-color-option" style="background: #dc3545" onclick="applyTableColor(event, 'color', '#dc3545', '${type}')"></div>
            <div class="table-color-option" style="background: #fd7e14" onclick="applyTableColor(event, 'color', '#fd7e14', '${type}')"></div>
            <div class="table-color-option" style="background: #ffc107" onclick="applyTableColor(event, 'color', '#ffc107', '${type}')"></div>
            <div class="table-color-option" style="background: #28a745" onclick="applyTableColor(event, 'color', '#28a745', '${type}')"></div>
            <div class="table-color-option" style="background: #17a2b8" onclick="applyTableColor(event, 'color', '#17a2b8', '${type}')"></div>
            <div class="table-color-option" style="background: #007bff" onclick="applyTableColor(event, 'color', '#007bff', '${type}')"></div>
            <div class="table-color-option" style="background: #6610f2" onclick="applyTableColor(event, 'color', '#6610f2', '${type}')"></div>
            <div class="table-color-option" style="background: #e83e8c" onclick="applyTableColor(event, 'color', '#e83e8c', '${type}')"></div>
        </div>
    `;
    
    const parentRect = parentMenu.getBoundingClientRect();
    colorMenu.style.left = (parentRect.right + 10) + 'px';
    colorMenu.style.top = parentRect.top + 'px';
    colorMenu.dataset.table = parentMenu.dataset.table;
    colorMenu.dataset.cell = parentMenu.dataset.cell;
    
    document.body.appendChild(colorMenu);
}

// 應用表格顏色
window.applyTableColor = function(event, property, color, type) {
    const colorMenu = event.target.closest('.table-color-menu');
    const tableId = colorMenu.dataset.table;
    const table = document.querySelector(`[data-table-id="${tableId}"]`);
    
    if (!table) return;
    
    if (type === 'table') {
        // 應用到整個表格
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
            cell.style[property] = color;
        });
    } else if (type === 'cell') {
        // 應用到特定儲存格
        const cellInfo = getCellInfoFromMenu({ target: colorMenu });
        if (cellInfo) {
            const cell = table.rows[cellInfo.row].cells[cellInfo.col];
            if (cell) {
                cell.style[property] = color;
            }
        }
    }
    
    removeExistingMenus();
}

// 調整選單位置，確保不會超出視窗範圍
function adjustMenuPosition(menu) {
    const rect = menu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 調整水平位置
    if (rect.right > windowWidth) {
        menu.style.left = Math.max(0, windowWidth - rect.width - 10) + 'px';
    }
    
    // 調整垂直位置
    if (rect.bottom > windowHeight) {
        menu.style.top = Math.max(0, windowHeight - rect.height - 10) + 'px';
    }
    
    // 確保選單不會太靠近邊緣
    const minMargin = 5;
    const currentLeft = parseInt(menu.style.left);
    const currentTop = parseInt(menu.style.top);
    
    if (currentLeft < minMargin) {
        menu.style.left = minMargin + 'px';
    }
    if (currentTop < minMargin) {
        menu.style.top = minMargin + 'px';
    }
}

// 顯示元素右鍵選單
function showElementContextMenu(event, element, type) {
    removeExistingMenus();
    
    const menu = document.createElement('div');
    menu.className = 'element-context-menu';
    
    let menuItems = `
        <div class="element-menu-item" onclick="copyElement(event)">
            <i class="fas fa-copy"></i> 複製
        </div>
    `;
    
    if (type === 'image') {
        menuItems += `
            <div class="element-menu-item" onclick="resizeImage(event)">
                <i class="fas fa-expand-arrows-alt"></i> 調整大小
            </div>
        `;
    }
    
    menuItems += `
        <div class="element-menu-item delete" onclick="deleteElement(event)">
            <i class="fas fa-trash"></i> 刪除
        </div>
    `;
    
    menu.innerHTML = menuItems;
    menu.style.left = event.clientX + 'px';  // 改用 clientX
    menu.style.top = event.clientY + 'px';   // 改用 clientY
    menu.dataset.element = getElementId(element);
    
    document.body.appendChild(menu);

    // 調整選單位置，確保不會超出視窗範圍
    adjustMenuPosition(menu);

    setTimeout(() => {
        document.addEventListener('click', removeExistingMenus, { once: true });
    }, 0);
}

// 表格操作函數
window.addTableRow = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    const row = table.insertRow(cellInfo.row + 1);
    const colCount = table.rows[0].cells.length;
    
    for (let i = 0; i < colCount; i++) {
        const cell = row.insertCell();
        cell.textContent = '新內容';
        cell.style.border = '1px solid #dee2e6';
        cell.style.padding = '8px';
    }
    
    removeExistingMenus();
}

window.addTableRowAbove = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    const row = table.insertRow(cellInfo.row);
    const colCount = table.rows[0].cells.length;
    
    for (let i = 0; i < colCount; i++) {
        const cell = row.insertCell();
        cell.textContent = '新內容';
        cell.style.border = '1px solid #dee2e6';
        cell.style.padding = '8px';
    }
    
    removeExistingMenus();
}

window.deleteTableRow = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    if (table.rows.length > 1) {
        table.deleteRow(cellInfo.row);
    }
    
    removeExistingMenus();
}

window.addTableColumn = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    for (let i = 0; i < table.rows.length; i++) {
        const cell = table.rows[i].insertCell(cellInfo.col + 1);
        if (i === 0) {
            // 第一行是標題，使用 th 樣式
            cell.textContent = '新標題';
            cell.style.background = '#f8f9fa';
            cell.style.border = '1px solid #dee2e6';
            cell.style.padding = '8px';
            cell.style.fontWeight = '600';
        } else {
            cell.textContent = '新內容';
            cell.style.border = '1px solid #dee2e6';
            cell.style.padding = '8px';
        }
    }
    
    removeExistingMenus();
}

window.addTableColumnLeft = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    for (let i = 0; i < table.rows.length; i++) {
        const cell = table.rows[i].insertCell(cellInfo.col);
        if (i === 0) {
            // 第一行是標題，使用 th 樣式
            cell.textContent = '新標題';
            cell.style.background = '#f8f9fa';
            cell.style.border = '1px solid #dee2e6';
            cell.style.padding = '8px';
            cell.style.fontWeight = '600';
        } else {
            cell.textContent = '新內容';
            cell.style.border = '1px solid #dee2e6';
            cell.style.padding = '8px';
        }
    }
    
    removeExistingMenus();
}

window.deleteTableColumn = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    if (table.rows[0].cells.length > 1) {
        for (let i = 0; i < table.rows.length; i++) {
            table.rows[i].deleteCell(cellInfo.col);
        }
    }
    
    removeExistingMenus();
}

window.copyTable = function(event) {
    const table = getTableFromMenu(event);
    if (!table) return;
    
    const range = document.createRange();
    range.selectNode(table);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    
    showToast('表格已複製到剪貼簿', 'success');
    removeExistingMenus();
}

window.deleteTable = function(event) {
    const table = getTableFromMenu(event);
    if (!table) return;
    
    table.remove();
    removeExistingMenus();
}

// 元素操作函數
window.copyElement = function(event) {
    const element = getElementFromMenu(event);
    if (!element) return;
    
    const range = document.createRange();
    range.selectNode(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    
    showToast('已複製到剪貼簿', 'success');
    removeExistingMenus();
}

window.deleteElement = function(event) {
    const element = getElementFromMenu(event);
    if (!element) return;
    
    element.remove();
    removeExistingMenus();
}

window.resizeImage = function(event) {
    const element = getElementFromMenu(event);
    if (!element || element.tagName !== 'IMG') return;
    
    toggleImageResize(element);
    removeExistingMenus();
}

// 輔助函數
function removeExistingMenus() {
    document.querySelectorAll('.table-context-menu, .element-context-menu, .table-color-menu').forEach(menu => {
        menu.remove();
    });
}

function getTableFromMenu(event) {
    const menu = event.target.closest('.table-context-menu');
    if (!menu) return null;
    
    const tableId = menu.dataset.table;
    return document.querySelector(`[data-table-id="${tableId}"]`);
}

function getElementFromMenu(event) {
    const menu = event.target.closest('.element-context-menu');
    if (!menu) return null;
    
    const elementId = menu.dataset.element;
    return document.querySelector(`[data-element-id="${elementId}"]`);
}

function getCellInfoFromMenu(event) {
    const menu = event.target.closest('.table-context-menu, .table-color-menu');
    if (!menu || !menu.dataset.cell) return null;
    
    const [row, col] = menu.dataset.cell.split(',').map(Number);
    return { row, col };
}

function getTableId(table) {
    if (!table.dataset.tableId) {
        table.dataset.tableId = 'table_' + Date.now();
    }
    return table.dataset.tableId;
}

function getElementId(element) {
    if (!element.dataset.elementId) {
        element.dataset.elementId = 'element_' + Date.now();
    }
    return element.dataset.elementId;
}

function getCellPosition(cell) {
    if (!cell || (cell.tagName !== 'TD' && cell.tagName !== 'TH')) {
        cell = cell.closest('td, th');
    }
    if (!cell) return '0,0';
    
    const row = cell.parentNode;
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    const colIndex = Array.from(row.children).indexOf(cell);
    
    return `${rowIndex},${colIndex}`;
}

// 送出評論 - 防止重複提交
window.submitComment = async function() {
    if (isSubmitting) {
        showToast('正在處理中，請稍候...', 'info');
        return;
    }
    
    const editor = document.getElementById('comment-editor');
    let content = editor.innerHTML.trim();
    const topic = document.getElementById('comment-topic').value.trim();
    
    // 移除回覆預覽區塊
    const replyPreview = editor.querySelector('.reply-to-preview');
    if (replyPreview) {
        replyPreview.remove();
        content = editor.innerHTML.trim();
    }
    
    if (!content) {
        showToast('請輸入評論內容', 'warning');
        return;
    }
    
    isSubmitting = true;
    
    const filePath = document.getElementById('initial-file-path').value;
    const commentData = {
        content: content,
        topic: topic || '一般討論',
        attachments: commentAttachments,
        file_path: filePath,
        edit_id: currentEditingCommentId,
        parent_comment_id: window.currentReplyingToId || null // 添加父評論ID
    };
    
    try {
        const response = await fetch('/api/comment', {
            method: currentEditingCommentId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(currentEditingCommentId ? '評論已更新' : '評論已新增', 'success');
            closeCommentDialog();
            window.currentReplyingToId = null; // 清除回覆狀態
            await loadComments();
            updateQuickLink();
            updateCommentCount();
            
            // 如果是回覆，滾動到該評論
            if (commentData.parent_comment_id) {
                setTimeout(() => {
                    const parentElement = document.querySelector(`[data-id="${commentData.parent_comment_id}"]`);
                    if (parentElement) {
                        parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // 展開回覆區域
                        const repliesContainer = parentElement.querySelector('.comment-replies');
                        if (repliesContainer && repliesContainer.style.display === 'none') {
                            toggleReplies(commentData.parent_comment_id);
                        }
                    }
                }, 500);
            }
        } else {
            showToast(result.message || '操作失敗', 'danger');
        }
    } catch (error) {
        console.error('提交評論錯誤:', error);
        showToast('提交評論時發生錯誤', 'danger');
    } finally {
        isSubmitting = false;
    }
}

// 新增：更新評論數量
function updateCommentCount() {
    const countBadge = document.querySelector('.comment-count-badge');
    if (countBadge) {
        countBadge.textContent = comments.length;
        countBadge.style.display = comments.length > 0 ? 'block' : 'none';
    }
}

// 顯示評論 - 支援主題分組、快速連結和巢狀回覆
function displayComments() {
    const section = document.getElementById('comments-section');
    const list = document.getElementById('comments-list');
    const count = document.querySelector('.comments-count');
    
    if (!section || !list) return;
    
    if (comments.length === 0) {
        section.style.display = 'none';
        list.innerHTML = `
            <div class="comments-empty">
                <i class="fas fa-comment-slash"></i>
                <p>目前沒有評論</p>
            </div>
        `;
    } else {
        section.style.display = 'block';
        
        // 計算總評論數（包括回覆）
        const totalCount = countAllComments(comments);
        count.textContent = totalCount;
        
        // 按主題分組
        const groupedComments = {};
        comments.forEach(comment => {
            const topic = comment.topic || '一般討論';
            if (!groupedComments[topic]) {
                groupedComments[topic] = [];
            }
            groupedComments[topic].push(comment);
        });
        
        // 創建主題快速連結
        const topicLinks = Object.entries(groupedComments).map(([topic, topicComments]) => {
            const topicTotal = countTopicComments(topicComments);
            return `
                <a href="#topic-${topic.replace(/\s+/g, '-')}" class="topic-link-btn" onclick="smoothScrollToTopic('${topic.replace(/\s+/g, '-')}'); return false;">
                    <i class="fas fa-folder"></i>
                    ${topic}
                    <span class="count">${topicTotal}</span>
                </a>
            `;
        }).join('');
        
        // 創建評論列表
        const commentsHTML = Object.entries(groupedComments).map(([topic, topicComments]) => {
            const topicTotal = countTopicComments(topicComments);
            return `
                <div class="comment-topic-group" id="topic-${topic.replace(/\s+/g, '-')}">
                    <h5 class="comment-topic">
                        <i class="fas fa-folder"></i>
                        ${topic}
                        <span class="badge">${topicTotal}</span>
                        <button class="topic-back-btn" onclick="scrollToCommentsTop()">
                            <i class="fas fa-arrow-up"></i>
                            返回頂部
                        </button>
                    </h5>
                    ${topicComments.map(comment => renderComment(comment, false)).join('')}
                </div>
            `;
        }).join('');
        
        // 組合HTML
        list.innerHTML = `
            ${Object.keys(groupedComments).length > 1 ? `
                <div class="topic-quick-links">
                    <div class="topic-quick-links-label">
                        <i class="fas fa-th-list"></i> 
                        <span>快速跳轉：</span>
                    </div>
                    ${topicLinks}
                </div>
            ` : ''}
            ${commentsHTML}
        `;
    }
    
    updateQuickLink();
    updateCommentCount();
    updateBackToCommentsButton();
}

// 渲染單個評論（包括回覆）
function renderComment(comment, isReply = false, parentId = null) {
    const replyClass = isReply ? 'reply' : '';
    const replyIndicator = isReply ? '<span class="reply-indicator"><i class="fas fa-reply"></i>回覆</span>' : '';
    const hasReplies = comment.replies && comment.replies.length > 0;
    const repliesCountBadge = hasReplies ? `<span class="replies-count">${comment.replies.length} 則回覆</span>` : '';
    
    const commentHTML = `
        <div class="comment-item ${replyClass}" data-id="${comment.id}">
            <div class="comment-header">
                <div class="comment-author">
                    <div class="comment-avatar">${getInitials(comment.author)}</div>
                    <div class="comment-meta">
                        <div class="comment-author-name">
                            ${comment.author}
                            ${replyIndicator}
                            ${repliesCountBadge}
                        </div>
                        <div class="comment-time">${formatTime(comment.created_at)}</div>
                    </div>
                </div>
                <div>
                    ${!isReply ? `
                        <button class="comment-back-btn" onclick="scrollToCommentsTop()">
                            <i class="fas fa-arrow-up"></i>
                            回到頂部
                        </button>
                    ` : ''}
                    <button class="comment-reply-btn" onclick="replyToComment('${comment.id}', '${comment.topic}', '${parentId || ''}')">
                        <i class="fas fa-reply"></i> 回覆
                    </button>
                    <button class="comment-action-btn" onclick="editComment('${comment.id}')">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button class="comment-action-btn delete" onclick="deleteComment('${comment.id}')">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                    ${hasReplies ? `
                        <button class="replies-toggle" onclick="toggleReplies('${comment.id}')" id="toggle-${comment.id}">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="comment-content">${comment.content}</div>
            ${comment.attachments && comment.attachments.length > 0 ? `
                <div class="comment-images">
                    ${comment.attachments.filter(a => a.type.startsWith('image/')).map(img => `
                        <div class="comment-image" onclick="previewImage('${img.url || img.data}')">
                            <img src="${img.url || img.data}" alt="${img.name}">
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${hasReplies ? `
                <div class="comment-replies" id="replies-${comment.id}">
                    ${comment.replies.map(reply => renderComment(reply, true, comment.id)).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    return commentHTML;
}

// 計算所有評論數（包括回覆）
function countAllComments(commentList) {
    let count = 0;
    commentList.forEach(comment => {
        count++; // 計算主評論
        if (comment.replies && comment.replies.length > 0) {
            count += countAllComments(comment.replies); // 遞迴計算回覆
        }
    });
    return count;
}

// 計算主題內的評論數
function countTopicComments(topicComments) {
    let count = 0;
    topicComments.forEach(comment => {
        count++;
        if (comment.replies && comment.replies.length > 0) {
            count += countAllComments(comment.replies);
        }
    });
    return count;
}

// 切換回覆顯示/隱藏
window.toggleReplies = function(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    const toggleBtn = document.getElementById(`toggle-${commentId}`);
    
    if (repliesContainer && toggleBtn) {
        if (repliesContainer.style.display === 'none') {
            repliesContainer.style.display = 'block';
            toggleBtn.classList.remove('collapsed');
        } else {
            repliesContainer.style.display = 'none';
            toggleBtn.classList.add('collapsed');
        }
    }
}

// 更新返回評論區按鈕顯示狀態
function updateBackToCommentsButton() {
    const btn = document.getElementById('back-to-comments-btn');
    const section = document.getElementById('comments-section');
    
    if (btn && section && comments.length > 0) {
        // 監聽滾動事件
        window.addEventListener('scroll', function() {
            const rect = section.getBoundingClientRect();
            if (rect.bottom < 0) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        });
    }
}

// 滾動到評論區頂部
window.scrollToCommentsTop = function() {
    const section = document.getElementById('comments-section');
    if (section) {
        section.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 新增：平滑滾動到主題
window.smoothScrollToTopic = function(topicId) {
    const element = document.getElementById(`topic-${topicId}`);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
        });
        
        // 添加高亮效果
        element.classList.add('topic-highlight');
        setTimeout(() => {
            element.classList.remove('topic-highlight');
        }, 2000);
    }
}

// 回覆評論函數
window.replyToComment = function(commentId, topic, parentCommentId) {
    openCommentDialog();
    
    // 設置當前正在回覆的評論ID
    window.currentReplyingToId = commentId;
    
    // 確保編輯器已經初始化
    setTimeout(() => {
        const editor = document.getElementById('comment-editor');
        const topicInput = document.getElementById('comment-topic');
        
        if (topicInput) {
            topicInput.value = topic;
        }
        
        const comment = findCommentById(comments, commentId);
        if (comment && editor) {
            const authorName = comment.author;
            const commentPreview = comment.content.replace(/<[^>]*>/g, '').substring(0, 100);
            
            // 創建回覆預覽
            editor.innerHTML = `
                <div class="reply-to-preview">
                    <span class="reply-to-author">@${authorName}:</span>
                    ${commentPreview}${comment.content.length > 100 ? '...' : ''}
                </div>
                <p><br></p>
            `;
            
            // 重新初始化編輯器（確保所有功能正常）
            initializeEditor();
            
            // 將游標移到最後
            setTimeout(() => {
                editor.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                const p = editor.querySelector('p:last-child') || editor;
                range.selectNodeContents(p);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }, 50);
        }
    }, 200);
}

// 遞迴查找評論
function findCommentById(commentList, id) {
    for (let comment of commentList) {
        if (comment.id === id) {
            return comment;
        }
        if (comment.replies && comment.replies.length > 0) {
            const found = findCommentById(comment.replies, id);
            if (found) return found;
        }
    }
    return null;
}

// 更新快速連結
function updateQuickLink() {
    const link = document.getElementById('quick-comment-link');
    const countBadge = document.querySelector('.comments-count-quick');
    if (link && comments.length > 0) {
        link.classList.add('show');
        if (countBadge) countBadge.textContent = comments.length;
    } else if (link) {
        link.classList.remove('show');
    }
    
    // 顯示回到頂部按鈕
    const backToTop = document.getElementById('back-to-top');
    if (backToTop && window.scrollY > 300) {
        backToTop.classList.add('show');
    }
}

// 回到頂部
window.scrollToTop = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 監聽滾動
window.addEventListener('scroll', function() {
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        if (window.scrollY > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    }
});

// 創建表格
function createTable(rows, cols) {
    let html = '<table style="border-collapse: collapse; width: 100%;"><tbody>';
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            if (i === 0) {
                html += '<th style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 8px; font-weight: 600;">標題</th>';
            } else {
                html += '<td style="border: 1px solid #dee2e6; padding: 8px;">內容</td>';
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// 處理圖片檔案 - 增加可縮放功能
async function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imgId = 'img-' + Date.now();
        const img = `<img id="${imgId}" src="${e.target.result}" style="max-width: 100%; margin: 10px 0; cursor: move;" onload="makeImageResizable('${imgId}')">`;
        document.execCommand('insertHTML', false, img);
    };
    reader.readAsDataURL(file);
}

// 使圖片可縮放
window.makeImageResizable = function(imgId) {
    const img = document.getElementById(imgId);
    if (!img) return;
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    // 點擊圖片時顯示縮放控制點
    img.addEventListener('click', function(e) {
        e.preventDefault();
        toggleImageResize(img);
    });
    
    // 拖動功能
    img.addEventListener('mousedown', function(e) {
        if (!isResizing) {
            const startPosX = e.clientX - img.offsetLeft;
            const startPosY = e.clientY - img.offsetTop;
            
            function handleMouseMove(e) {
                img.style.position = 'relative';
                img.style.left = (e.clientX - startPosX) + 'px';
                img.style.top = (e.clientY - startPosY) + 'px';
            }
            
            function handleMouseUp() {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    });
}

// 切換圖片縮放控制
function toggleImageResize(img) {
    const existingHandle = img.parentElement.querySelector('.image-resize-handle');
    if (existingHandle) {
        existingHandle.remove();
        return;
    }
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    
    const handle = document.createElement('div');
    handle.className = 'image-resize-handle';
    handle.style.position = 'absolute';
    handle.style.right = '-5px';
    handle.style.bottom = '-5px';
    wrapper.appendChild(handle);
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.offsetWidth;
        startHeight = img.offsetHeight;
        e.preventDefault();
        
        function handleMouseMove(e) {
            if (!isResizing) return;
            
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            img.style.width = width + 'px';
            img.style.height = height + 'px';
        }
        
        function handleMouseUp() {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}

// 更新工具列狀態
function updateToolbarState() {
    document.querySelectorAll('.comment-toolbar-btn').forEach(btn => {
        const command = btn.dataset.command;
        if (command && document.queryCommandState && document.queryCommandState(command)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 處理貼上事件
async function handlePaste(e) {
    const items = e.clipboardData.items;
    
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await handleImageFile(file);
            }
        }
    }
}

// 處理附件檔案
async function handleAttachmentFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        commentAttachments.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result
        });
        updateAttachmentsDisplay();
    };
    reader.readAsDataURL(file);
}

// 更新附件顯示
function updateAttachmentsDisplay() {
    const container = document.getElementById('comment-attachments');
    if (!container) return;
    
    container.innerHTML = commentAttachments.map((file, index) => `
        <div class="attachment-item">
            ${file.type.startsWith('image/') ? 
                `<img src="${file.data}" alt="${file.name}">` : 
                `<i class="fas fa-file"></i>`
            }
            <span>${file.name}</span>
            <button class="attachment-remove" onclick="removeAttachment(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// 移除附件
window.removeAttachment = function(index) {
    commentAttachments.splice(index, 1);
    updateAttachmentsDisplay();
}

// 載入評論
async function loadComments() {
    const filePath = document.getElementById('initial-file-path').value;
    
    try {
        const response = await fetch(`/api/comments?file_path=${encodeURIComponent(filePath)}`);
        const result = await response.json();
        
        if (result.success) {
            comments = result.comments;
            displayComments();
            updateCommentCount();
        }
    } catch (error) {
        console.error('載入評論錯誤:', error);
    }
}

// 編輯評論
window.editComment = function(id) {
    openCommentDialog(id);
}

// 刪除評論
window.deleteComment = async function(id) {
    if (!confirm('確定要刪除這則評論嗎？')) return;
    
    try {
        const response = await fetch(`/api/comment/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('評論已刪除', 'success');
            await loadComments();
        } else {
            showToast(result.message || '刪除失敗', 'danger');
        }
    } catch (error) {
        console.error('刪除評論錯誤:', error);
        showToast('刪除評論時發生錯誤', 'danger');
    }
}

// 預覽圖片
window.previewImage = function(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = `
        <div class="image-preview-content">
            <img src="${src}" alt="Preview">
        </div>
    `;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

// 工具函數
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-TW');
}

// 顯示 Toast 提示
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : type === 'danger' ? 'times' : 'info'}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initCommentSystem();
    
    // 修復送出和取消按鈕的可見性
    const dialogFooter = document.querySelector('.comment-dialog-footer');
    if (dialogFooter) {
        dialogFooter.style.visibility = 'visible';
        dialogFooter.style.opacity = '1';
        dialogFooter.style.display = 'flex';
    }
});