// 美觀的確認對話框組件
class ConfirmDialog {
    constructor() {
        this.container = document.getElementById('confirm-dialog-container');
    }
    
    show(options) {
        return new Promise((resolve) => {
            const dialogId = 'confirm-' + Date.now();
            
            const dialogHtml = `
                <div class="confirm-dialog-overlay" id="${dialogId}">
                    <div class="confirm-dialog">
                        <div class="confirm-dialog-icon ${options.type || 'warning'}">
                            <i class="fas ${this.getIcon(options.type)}"></i>
                        </div>
                        <div class="confirm-dialog-content">
                            <h3>${options.title || '確認操作'}</h3>
                            <p>${options.message || '確定要執行此操作嗎？'}</p>
                        </div>
                        <div class="confirm-dialog-actions">
                            <button class="btn btn-cancel" onclick="confirmDialog.handleCancel('${dialogId}')">
                                ${options.cancelText || '取消'}
                            </button>
                            <button class="btn btn-confirm ${options.type || 'warning'}" onclick="confirmDialog.handleConfirm('${dialogId}')">
                                ${options.confirmText || '確定'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            this.container.insertAdjacentHTML('beforeend', dialogHtml);
            
            // 添加動畫
            setTimeout(() => {
                const dialog = document.getElementById(dialogId);
                dialog.classList.add('show');
            }, 10);
            
            // 儲存 resolve 函數
            this.currentResolve = resolve;
            this.currentDialogId = dialogId;
        });
    }
    
    getIcon(type) {
        const icons = {
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-trash-alt',
            'info': 'fa-info-circle',
            'success': 'fa-check-circle'
        };
        return icons[type] || icons['warning'];
    }
    
    handleConfirm(dialogId) {
        this.close(dialogId);
        if (this.currentResolve) {
            this.currentResolve(true);
        }
    }
    
    handleCancel(dialogId) {
        this.close(dialogId);
        if (this.currentResolve) {
            this.currentResolve(false);
        }
    }
    
    close(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.classList.remove('show');
            setTimeout(() => {
                dialog.remove();
            }, 300);
        }
    }
}

// 初始化全域實例
window.confirmDialog = new ConfirmDialog();