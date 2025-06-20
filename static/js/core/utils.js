// Enhanced Log 分析平台 v6 - 核心工具模組
// static/js/core/utils.js

window.utils = {
    // 顯示提示訊息
    showAlert: function(message, type = 'info', duration = 3000) {
        const alertId = `alert-${Date.now()}`;
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show animate__animated animate__fadeInDown" role="alert">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        $('#alert-container').prepend(alertHtml);
        
        if (duration > 0) {
            setTimeout(() => {
                $(`#${alertId}`).fadeOut(() => {
                    $(`#${alertId}`).remove();
                });
            }, duration);
        }
        
        return alertId;
    },
    
    // 播放通知音效
    playNotificationSound: function(type = 'notification') {
        if (!appConfig.state.audioContext) {
            try {
                appConfig.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('⚠️ 音頻上下文初始化失敗');
                return;
            }
        }
        
        const soundConfig = appConfig.sounds[type] || appConfig.sounds.notification;
        const audioContext = appConfig.state.audioContext;
        
        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = soundConfig.type;
            oscillator.frequency.value = soundConfig.frequency;
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + soundConfig.duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + soundConfig.duration / 1000);
        } catch (e) {
            console.log('播放音效失敗:', e);
        }
    },
    
    // 格式化檔案大小
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // 格式化時間
    formatTime: function(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        // 少於1分鐘
        if (diff < 60000) {
            return '剛剛';
        }
        
        // 少於1小時
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} 分鐘前`;
        }
        
        // 少於1天
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} 小時前`;
        }
        
        // 超過1天，顯示日期
        return d.toLocaleDateString('zh-TW') + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    },
    
    // 防抖函數
    debounce: function(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // 節流函數
    throttle: function(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // 捲動到頂部
    scrollToTop: function() {
        $('html, body').animate({ scrollTop: 0 }, 300);
    },
    
    // 捲動到元素
    scrollToElement: function(selector, offset = 100) {
        const element = $(selector);
        if (element.length) {
            $('html, body').animate({
                scrollTop: element.offset().top - offset
            }, 300);
        }
    },
    
    // 複製到剪貼板
    copyToClipboard: function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text)
                .then(() => {
                    this.showAlert('✅ 已複製到剪貼板', 'success');
                })
                .catch(err => {
                    console.error('複製失敗:', err);
                    this.showAlert('❌ 複製失敗', 'danger');
                });
        } else {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showAlert('✅ 已複製到剪貼板', 'success');
            } catch (err) {
                console.error('複製失敗:', err);
                this.showAlert('❌ 複製失敗', 'danger');
            }
            
            document.body.removeChild(textArea);
        }
    },
    
    // 顯示通知
    showNotification: function(message, options = {}) {
        if (!('Notification' in window)) {
            console.log('瀏覽器不支援通知');
            return;
        }
        
        if (Notification.permission === 'granted') {
            new Notification('Enhanced Log 分析平台', {
                body: message,
                icon: '/favicon.ico',
                ...options
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Enhanced Log 分析平台', {
                        body: message,
                        icon: '/favicon.ico',
                        ...options
                    });
                }
            });
        }
    },
    
    // 產生唯一ID
    generateId: function(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // 檢查檔案類型
    isValidFileType: function(filename, allowedExtensions) {
        const ext = filename.toLowerCase().match(/\.[^.]+$/);
        return ext && allowedExtensions.includes(ext[0]);
    },
    
    // 取得檔案圖示
    getFileIcon: function(filename) {
        const ext = filename.toLowerCase().match(/\.[^.]+$/);
        if (!ext) return 'fa-file';
        
        const iconMap = {
            '.log': 'fa-file-alt',
            '.txt': 'fa-file-alt',
            '.out': 'fa-file-export',
            '.err': 'fa-file-exclamation',
            '.zip': 'fa-file-archive',
            '.7z': 'fa-file-archive',
            '.tar': 'fa-file-archive',
            '.gz': 'fa-file-archive',
            '.jpg': 'fa-file-image',
            '.jpeg': 'fa-file-image',
            '.png': 'fa-file-image',
            '.gif': 'fa-file-image',
            '.pdf': 'fa-file-pdf',
            '.doc': 'fa-file-word',
            '.docx': 'fa-file-word',
            '.xls': 'fa-file-excel',
            '.xlsx': 'fa-file-excel'
        };
        
        return iconMap[ext[0]] || 'fa-file';
    },
    
    // 載入狀態
    showLoading: function(container, message = '載入中...') {
        $(container).html(`
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
                <p class="mt-3 text-muted">${message}</p>
            </div>
        `);
    },
    
    // 錯誤狀態
    showError: function(container, message = '載入失敗', retryCallback = null) {
        let html = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <p class="text-muted">${message}</p>
        `;
        
        if (retryCallback) {
            html += `<button class="btn btn-primary" onclick="${retryCallback}">重試</button>`;
        }
        
        html += '</div>';
        $(container).html(html);
    },
    
    // 空狀態
    showEmpty: function(container, message = '暫無資料', icon = 'fa-inbox') {
        $(container).html(`
            <div class="text-center py-5">
                <i class="fas ${icon} fa-3x text-muted mb-3"></i>
                <p class="text-muted">${message}</p>
            </div>
        `);
    },
    
    // 儲存本地資料
    saveLocal: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('儲存本地資料失敗:', e);
            return false;
        }
    },
    
    // 讀取本地資料
    loadLocal: function(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('讀取本地資料失敗:', e);
            return defaultValue;
        }
    },
    
    // 清除本地資料
    clearLocal: function(key) {
        try {
            if (key) {
                localStorage.removeItem(key);
            } else {
                localStorage.clear();
            }
            return true;
        } catch (e) {
            console.error('清除本地資料失敗:', e);
            return false;
        }
    },

    // 美化的確認對話框
    showConfirm: function(options) {
        const defaults = {
            title: '確認',
            message: '確定要執行此操作嗎？',
            confirmText: '確定',
            cancelText: '取消',
            confirmClass: 'btn-primary',
            icon: 'fa-question-circle',
            iconColor: '#667eea',
            onConfirm: () => {},
            onCancel: () => {}
        };
        
        const settings = Object.assign({}, defaults, options);
        
        // 創建對話框 HTML
        const modalId = this.generateId('confirm-modal');
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: 20px; overflow: hidden;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                            <h5 class="modal-title">
                                <i class="fas ${settings.icon} me-2" style="color: ${settings.iconColor};"></i>
                                ${settings.title}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" style="padding: 30px;">
                            <p class="mb-0" style="font-size: 1.05rem; color: #495057;">
                                ${settings.message}
                            </p>
                        </div>
                        <div class="modal-footer" style="border: none; padding: 20px;">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal" style="border-radius: 10px;">
                                ${settings.cancelText}
                            </button>
                            <button type="button" class="btn ${settings.confirmClass}" id="${modalId}-confirm" style="border-radius: 10px;">
                                ${settings.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到頁面
        $('body').append(modalHtml);
        
        // 創建 modal 實例
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        
        // 綁定事件
        $(`#${modalId}-confirm`).on('click', function() {
            modal.hide();
            settings.onConfirm();
        });
        
        // 清理
        modalElement.addEventListener('hidden.bs.modal', function() {
            $(modalElement).remove();
            settings.onCancel();
        });
        
        // 顯示對話框
        modal.show();
    },

    // 美化的提示對話框
    showPrompt: function(options) {
        const defaults = {
            title: '請輸入',
            message: '請輸入內容：',
            placeholder: '',
            defaultValue: '',
            confirmText: '確定',
            cancelText: '取消',
            inputType: 'text',
            validator: null,
            onConfirm: (value) => {},
            onCancel: () => {}
        };
        
        const settings = Object.assign({}, defaults, options);
        
        const modalId = this.generateId('prompt-modal');
        const inputId = this.generateId('prompt-input');
        
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: 20px; overflow: hidden;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>
                                ${settings.title}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" style="padding: 30px;">
                            <p class="mb-3">${settings.message}</p>
                            <input type="${settings.inputType}" 
                                class="form-control" 
                                id="${inputId}"
                                placeholder="${settings.placeholder}"
                                value="${settings.defaultValue}"
                                style="border-radius: 10px;">
                            <div class="invalid-feedback"></div>
                        </div>
                        <div class="modal-footer" style="border: none; padding: 20px;">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal" style="border-radius: 10px;">
                                ${settings.cancelText}
                            </button>
                            <button type="button" class="btn btn-primary" id="${modalId}-confirm" style="border-radius: 10px;">
                                ${settings.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(modalHtml);
        
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        const input = document.getElementById(inputId);
        
        // 確認按鈕事件
        $(`#${modalId}-confirm`).on('click', function() {
            const value = input.value;
            
            // 驗證
            if (settings.validator) {
                const validationResult = settings.validator(value);
                if (validationResult !== true) {
                    $(input).addClass('is-invalid');
                    $(input).siblings('.invalid-feedback').text(validationResult);
                    return;
                }
            }
            
            modal.hide();
            settings.onConfirm(value);
        });
        
        // Enter 鍵確認
        $(input).on('keypress', function(e) {
            if (e.which === 13) {
                $(`#${modalId}-confirm`).click();
            }
        });
        
        // 清理
        modalElement.addEventListener('hidden.bs.modal', function() {
            $(modalElement).remove();
            settings.onCancel();
        });
        
        // 顯示對話框並聚焦
        modal.show();
        modalElement.addEventListener('shown.bs.modal', function() {
            input.focus();
            input.select();
        });
    }    
};