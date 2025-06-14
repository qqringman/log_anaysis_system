// Enhanced Log 分析平台 v6 - 廣播管理器
// static/js/managers/broadcast-manager.js

window.broadcastManager = {
    init: function() {
        console.log('📢 初始化廣播管理器');
        
        // 設置事件監聽器
        this.setupEventListeners();
    },
    
    // 開啟廣播系統
    openBroadcast: function() {
        const modal = new bootstrap.Modal(document.getElementById('broadcastModal'));
        modal.show();
        
        // 清空表單
        $('#broadcast-message').val('');
        $('#broadcast-priority').val('info');
        this.updateBroadcastPreview('', 'info');
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 廣播訊息輸入
        $('#broadcast-message').on('input', () => {
            const message = $('#broadcast-message').val();
            const priority = $('#broadcast-priority').val();
            this.updateBroadcastPreview(message, priority);
        });
        
        // 優先級變更
        $('#broadcast-priority').on('change', () => {
            const message = $('#broadcast-message').val();
            const priority = $('#broadcast-priority').val();
            this.updateBroadcastPreview(message, priority);
        });
    },
    
    // 更新廣播預覽
    updateBroadcastPreview: function(message, priority) {
        const preview = $('#broadcast-preview-content');
        
        if (!message.trim()) {
            preview.html(`
                <div class="text-center text-muted">
                    <i class="fas fa-broadcast-tower fa-2x mb-2"></i>
                    <p>輸入訊息後預覽將顯示在這裡</p>
                </div>
            `);
            return;
        }
        
        const alertClass = {
            'info': 'alert-info',
            'warning': 'alert-warning',
            'danger': 'alert-danger'
        }[priority];
        
        const icon = {
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-exclamation-circle'
        }[priority];
        
        preview.html(`
            <div class="alert ${alertClass} mb-0">
                <h6 class="alert-heading">
                    <i class="fas ${icon} me-2"></i>廣播訊息
                </h6>
                <p class="mb-1">${this.escapeHtml(message)}</p>
                <small>來自: ${appConfig.state.userName} | ${new Date().toLocaleTimeString()}</small>
            </div>
        `);
    },
    
    // 發送廣播
    sendBroadcast: function() {
        const message = $('#broadcast-message').val().trim();
        const priority = $('#broadcast-priority').val();
        
        if (!message) {
            utils.showAlert('❌ 請輸入廣播訊息', 'danger');
            return;
        }
        
        if (!appConfig.state.socket) {
            utils.showAlert('❌ 聊天連接尚未建立', 'danger');
            return;
        }
        
        // 確認發送
        const confirmMessage = priority === 'danger' ? 
            '這是一條緊急廣播，確定要發送給所有線上用戶嗎？' : 
            '確定要發送此廣播訊息嗎？';
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // 發送廣播
        appConfig.state.socket.emit('broadcast_message', {
            message: message,
            priority: priority
        });
        
        // 關閉模態框
        $('#broadcastModal').modal('hide');
        
        // 清空表單
        $('#broadcast-message').val('');
        
        utils.showAlert('📢 廣播已發送', 'success');
        
        // 記錄廣播歷史
        this.saveBroadcastHistory({
            message: message,
            priority: priority,
            timestamp: new Date().toISOString(),
            sender: appConfig.state.userName
        });
    },
    
    // 顯示廣播訊息
    showBroadcastMessage: function(data) {
        const alertClass = {
            'info': 'alert-info',
            'warning': 'alert-warning',
            'danger': 'alert-danger'
        }[data.priority] || 'alert-info';
        
        const icon = {
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-exclamation-circle'
        }[data.priority] || 'fa-info-circle';
        
        const broadcastId = utils.generateId('broadcast');
        
        const broadcastHtml = `
            <div id="${broadcastId}" class="alert ${alertClass} position-fixed animate__animated animate__fadeInDown shadow-lg" 
                 style="top: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 400px; max-width: 600px;">
                <button type="button" class="btn-close float-end" onclick="$('#${broadcastId}').fadeOut(() => $('#${broadcastId}').remove())"></button>
                <h6 class="alert-heading">
                    <i class="fas ${icon} me-2"></i>廣播訊息
                </h6>
                <p class="mb-1">${this.escapeHtml(data.message)}</p>
                <small>來自: ${data.from} | ${this.formatTimestamp(data.timestamp)}</small>
                ${data.priority === 'danger' ? '<div class="mt-2"><strong>這是一條緊急廣播</strong></div>' : ''}
            </div>
        `;
        
        $('body').append(broadcastHtml);
        
        // 播放通知音效
        utils.playNotificationSound('broadcast');
        
        // 顯示瀏覽器通知
        if (data.from !== appConfig.state.userName) {
            utils.showNotification(`廣播訊息: ${data.message}`, {
                body: `來自: ${data.from}`,
                icon: '/favicon.ico',
                requireInteraction: data.priority === 'danger'
            });
        }
        
        // 自動消失時間
        const duration = {
            'info': 10000,
            'warning': 15000,
            'danger': 30000 // 緊急廣播顯示更久
        }[data.priority] || 10000;
        
        setTimeout(() => {
            $(`#${broadcastId}`).fadeOut(() => {
                $(`#${broadcastId}`).remove();
            });
        }, duration);
    },
    
    // 儲存廣播歷史
    saveBroadcastHistory: function(broadcast) {
        let history = utils.loadLocal('broadcastHistory', []);
        
        // 最多保存50條歷史
        history.unshift(broadcast);
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        utils.saveLocal('broadcastHistory', history);
    },
    
    // 顯示廣播歷史
    showBroadcastHistory: function() {
        const history = utils.loadLocal('broadcastHistory', []);
        
        if (history.length === 0) {
            utils.showAlert('⚠️ 沒有廣播歷史記錄', 'warning');
            return;
        }
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-history me-2"></i>廣播歷史
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="broadcast-history">
                                ${history.map(broadcast => {
                                    const alertClass = {
                                        'info': 'alert-info',
                                        'warning': 'alert-warning',
                                        'danger': 'alert-danger'
                                    }[broadcast.priority] || 'alert-info';
                                    
                                    return `
                                        <div class="alert ${alertClass} mb-3">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>${broadcast.sender}</strong>
                                                    <p class="mb-1">${this.escapeHtml(broadcast.message)}</p>
                                                </div>
                                                <small class="text-nowrap">${this.formatTimestamp(broadcast.timestamp)}</small>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-danger" onclick="broadcastManager.clearBroadcastHistory()">
                                <i class="fas fa-trash me-2"></i>清空歷史
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        modal.on('hidden.bs.modal', () => {
            modal.remove();
        });
    },
    
    // 清空廣播歷史
    clearBroadcastHistory: function() {
        if (!confirm('確定要清空所有廣播歷史嗎？')) return;
        
        utils.clearLocal('broadcastHistory');
        utils.showAlert('✅ 廣播歷史已清空', 'success');
        
        // 關閉模態框
        $('.modal').modal('hide');
    },
    
    // 預設廣播模板
    showBroadcastTemplates: function() {
        const templates = [
            { priority: 'info', message: '系統將於10分鐘後進行維護，請儲存您的工作。' },
            { priority: 'warning', message: '伺服器負載過高，部分功能可能受影響。' },
            { priority: 'danger', message: '緊急維護！系統將於5分鐘後重啟。' },
            { priority: 'info', message: '新功能上線！歡迎體驗最新的分析功能。' },
            { priority: 'info', message: '定期提醒：請定期備份您的分析結果。' }
        ];
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-file-alt me-2"></i>廣播模板
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="list-group">
                                ${templates.map((template, index) => {
                                    const badgeClass = {
                                        'info': 'bg-info',
                                        'warning': 'bg-warning',
                                        'danger': 'bg-danger'
                                    }[template.priority];
                                    
                                    return `
                                        <a href="#" class="list-group-item list-group-item-action" 
                                           onclick="broadcastManager.useTemplate(${index}); return false;">
                                            <div class="d-flex w-100 justify-content-between">
                                                <p class="mb-1">${template.message}</p>
                                                <span class="badge ${badgeClass}">${template.priority}</span>
                                            </div>
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        this.templatesModal = modal;
        modal.on('hidden.bs.modal', () => {
            modal.remove();
            this.templatesModal = null;
        });
    },
    
    // 使用模板
    useTemplate: function(index) {
        const templates = [
            { priority: 'info', message: '系統將於10分鐘後進行維護，請儲存您的工作。' },
            { priority: 'warning', message: '伺服器負載過高，部分功能可能受影響。' },
            { priority: 'danger', message: '緊急維護！系統將於5分鐘後重啟。' },
            { priority: 'info', message: '新功能上線！歡迎體驗最新的分析功能。' },
            { priority: 'info', message: '定期提醒：請定期備份您的分析結果。' }
        ];
        
        const template = templates[index];
        if (!template) return;
        
        // 關閉模板選擇器
        if (this.templatesModal) {
            this.templatesModal.modal('hide');
        }
        
        // 填充到廣播表單
        $('#broadcast-message').val(template.message);
        $('#broadcast-priority').val(template.priority);
        this.updateBroadcastPreview(template.message, template.priority);
    },
    
    // HTML 轉義
    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    // 格式化時間戳
    formatTimestamp: function(timestamp) {
        if (!timestamp) return '';
        return utils.formatTime(timestamp);
    }
};