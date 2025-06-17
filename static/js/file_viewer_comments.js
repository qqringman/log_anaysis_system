// Enhanced File Viewer Comments System JS - Complete

// 全域變數
let currentEditingCommentId = null;
let comments = [];
let commentAttachments = [];

// 初始化評論系統
function initCommentSystem() {
    console.log('初始化評論系統...');
    
    // 創建評論區塊
    createCommentsSection();
    
    // 綁定事件
    bindCommentEvents();
    
    // 載入現有評論
    loadComments();
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
    
    // 綁定編輯器右鍵選單
    bindEditorContextMenu();
}

// 開啟評論對話框 - 全域函數
window.openCommentDialog = function(editId = null) {
    const dialog = document.getElementById('comment-dialog');
    if (!dialog) return;
    
    dialog.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    if (editId) {
        // 編輯模式
        currentEditingCommentId = editId;
        const comment = comments.find(c => c.id === editId);
        if (comment) {
            document.getElementById('comment-editor').innerHTML = comment.content;
            document.getElementById('comment-topic').value = comment.topic || '一般討論';
            document.querySelector('.comment-dialog-header h5').innerHTML = 
                '<i class="fas fa-edit"></i> 編輯評論';
            document.getElementById('submit-comment').textContent = '更新';
        }
    } else {
        // 新增模式
        currentEditingCommentId = null;
        document.getElementById('comment-editor').innerHTML = '';
        document.getElementById('comment-topic').value = '';
        document.querySelector('.comment-dialog-header h5').innerHTML = 
            '<i class="fas fa-comment-plus"></i> 新增評論';
        document.getElementById('submit-comment').textContent = '送出';
    }
    
    // 清空附件
    commentAttachments = [];
    updateAttachmentsDisplay();
}

// 關閉評論對話框
function closeCommentDialog() {
    const dialog = document.getElementById('comment-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        document.body.style.overflow = '';
        
        // 清理
        currentEditingCommentId = null;
        commentAttachments = [];
        document.getElementById('comment-editor').innerHTML = '';
        updateAttachmentsDisplay();
    }
}

// 處理工具列點擊
function handleToolbarClick(e) {
    const btn = e.currentTarget;
    const command = btn.dataset.command;
    const value = btn.dataset.value || null;
    
    if (command === 'createLink') {
        const url = prompt('請輸入連結網址：', 'https://');
        if (url) {
            document.execCommand(command, false, url);
        }
    } else if (command === 'insertImage') {
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
    } else if (command === 'insertCode') {
        // 修正：直接呼叫 openCodeDialog
        e.preventDefault();
        e.stopPropagation();
        openCodeDialog();
    } else if (command === 'insertTable') {
        // 插入表格
        const rows = prompt('請輸入表格行數：', '3');
        const cols = prompt('請輸入表格列數：', '3');
        if (rows && cols) {
            const table = createTable(parseInt(rows), parseInt(cols));
            document.execCommand('insertHTML', false, table);
        }
    } else if (command === 'formatBlock' && value === 'blockquote') {
        // 修正引用功能
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const blockquote = document.createElement('blockquote');
        blockquote.appendChild(range.extractContents());
        range.insertNode(blockquote);
        range.selectNodeContents(blockquote);
        selection.removeAllRanges();
        selection.addRange(range);
    } else if (command === 'foreColor' || command === 'backColor') {
        // 顏色選擇
        showColorPicker(command);
    } else {
        document.execCommand(command, false, value);
    }
    
    // 更新按鈕狀態
    updateToolbarState();
}

// 顯示顏色選擇器
function showColorPicker(command) {
    const existingPicker = document.querySelector('.color-palette.show');
    if (existingPicker) {
        existingPicker.classList.remove('show');
    }
    
    const btn = document.querySelector(`[data-command="${command}"]`);
    const picker = btn.parentElement.querySelector('.color-palette');
    if (picker) {
        picker.classList.add('show');
    }
}

// 應用顏色
window.applyColor = function(color, command) {
    document.execCommand(command, false, color);
    document.querySelector('.color-palette.show')?.classList.remove('show');
    
    // 更新按鈕指示器
    const btn = document.querySelector(`[data-command="${command}"]`);
    if (btn) {
        const indicator = btn.querySelector('.color-indicator');
        if (indicator) {
            indicator.style.background = color;
        }
    }
}

// 程式碼對話框功能
function openCodeDialog() {
    const dialog = document.getElementById('code-dialog');
    if (dialog) {
        dialog.classList.add('show');
        dialog.style.zIndex = '10100'; // 確保在最上層
        document.getElementById('code-textarea').focus();
    }
}

window.closeCodeDialog = function() {
    const dialog = document.getElementById('code-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        document.getElementById('code-textarea').value = '';
        document.getElementById('code-language').value = 'javascript';
    }
}

window.insertCodeBlock = function() {
    const language = document.getElementById('code-language').value;
    const code = document.getElementById('code-textarea').value;
    
    if (!code.trim()) {
        showToast('請輸入程式碼', 'warning');
        return;
    }
    
    const pre = document.createElement('pre');
    pre.className = `language-${language}`;
    pre.dataset.elementId = 'element_' + Date.now();
    
    const codeEl = document.createElement('code');
    codeEl.textContent = code;
    codeEl.className = `language-${language}`;
    
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
    
    editor.addEventListener('contextmenu', function(e) {
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
    });
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
        <div class="table-menu-item" onclick="copyTable(event)">
            <i class="fas fa-copy"></i> 複製表格
        </div>
        <div class="table-menu-item" onclick="deleteTable(event)">
            <i class="fas fa-trash"></i> 刪除表格
        </div>
    `;
    
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.dataset.table = getTableId(table);
    menu.dataset.cell = getCellPosition(event.target);
    
    document.body.appendChild(menu);
    
    // 點擊其他地方關閉選單
    setTimeout(() => {
        document.addEventListener('click', removeExistingMenus, { once: true });
    }, 0);
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
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.dataset.element = getElementId(element);
    
    document.body.appendChild(menu);
    
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
        cell.textContent = i === 0 ? '新標題' : '新內容';
    }
    
    removeExistingMenus();
}

window.addTableColumnLeft = function(event) {
    const table = getTableFromMenu(event);
    const cellInfo = getCellInfoFromMenu(event);
    if (!table || !cellInfo) return;
    
    for (let i = 0; i < table.rows.length; i++) {
        const cell = table.rows[i].insertCell(cellInfo.col);
        cell.textContent = i === 0 ? '新標題' : '新內容';
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
    document.querySelectorAll('.table-context-menu, .element-context-menu').forEach(menu => {
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
    const menu = event.target.closest('.table-context-menu');
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

// 送出評論 - 支援主題
window.submitComment = async function() {
    const editor = document.getElementById('comment-editor');
    const content = editor.innerHTML.trim();
    const topic = document.getElementById('comment-topic').value.trim();
    
    if (!content) {
        showToast('請輸入評論內容', 'warning');
        return;
    }
    
    const filePath = document.getElementById('initial-file-path').value;
    const commentData = {
        content: content,
        topic: topic || '一般討論',
        attachments: commentAttachments,
        file_path: filePath,
        edit_id: currentEditingCommentId
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
            loadComments();
            updateQuickLink();
        } else {
            showToast(result.message || '操作失敗', 'danger');
        }
    } catch (error) {
        console.error('提交評論錯誤:', error);
        showToast('提交評論時發生錯誤', 'danger');
    }
}

// 顯示評論 - 支援主題分組
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
        count.textContent = comments.length;
        
        // 按主題分組
        const groupedComments = {};
        comments.forEach(comment => {
            const topic = comment.topic || '一般討論';
            if (!groupedComments[topic]) {
                groupedComments[topic] = [];
            }
            groupedComments[topic].push(comment);
        });
        
        list.innerHTML = Object.entries(groupedComments).map(([topic, topicComments]) => `
            <div class="comment-topic-group">
                <h5 class="comment-topic">
                    <i class="fas fa-folder"></i>
                    ${topic}
                    <span class="badge">${topicComments.length}</span>
                </h5>
                ${topicComments.map(comment => `
                    <div class="comment-item" data-id="${comment.id}">
                        <div class="comment-header">
                            <div class="comment-author">
                                <div class="comment-avatar">${getInitials(comment.author)}</div>
                                <div class="comment-meta">
                                    <div class="comment-author-name">${comment.author}</div>
                                    <div class="comment-time">${formatTime(comment.created_at)}</div>
                                </div>
                            </div>
                            <div class="comment-actions">
                                <button class="comment-reply-btn" onclick="replyToComment('${comment.id}', '${topic}')">
                                    <i class="fas fa-reply"></i> 回覆
                                </button>
                                <button class="comment-action-btn" onclick="editComment('${comment.id}')">
                                    <i class="fas fa-edit"></i> 編輯
                                </button>
                                <button class="comment-action-btn delete" onclick="deleteComment('${comment.id}')">
                                    <i class="fas fa-trash"></i> 刪除
                                </button>
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
                    </div>
                `).join('')}
            </div>
        `).join('');
    }
    
    updateQuickLink();
}

// 回覆評論
window.replyToComment = function(commentId, topic) {
    openCommentDialog();
    document.getElementById('comment-topic').value = topic;
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
        const editor = document.getElementById('comment-editor');
        editor.innerHTML = `<blockquote>@${comment.author}: ${comment.content.substring(0, 100)}...</blockquote><p><br></p>`;
        // 將游標移到最後
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        editor.focus();
    }
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
    let html = '<table><tbody>';
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += i === 0 ? '<th>標題</th>' : '<td>內容</td>';
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
        if (command && document.queryCommandState(command)) {
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
            loadComments();
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