// Enhanced Log 分析平台 v6 - 聊天室管理器
// static/js/managers/room-manager.js

window.roomManager = {
    init: function() {
        console.log('🏠 初始化聊天室管理器');
    },
    
    // 開啟聊天室管理中心
    openRoomManager: function() {
        const modal = new bootstrap.Modal(document.getElementById('roomManagerModal'));
        modal.show();
        this.loadRoomManagerContent();
    },
    
    // 載入聊天室管理內容
    loadRoomManagerContent: function() {
        utils.showLoading('#room-manager-content', '載入聊天室資訊...');
        
        $.get(appConfig.api.rooms, (rooms) => {
            const content = $('#room-manager-content');
            
            if (rooms.length === 0) {
                utils.showEmpty('#room-manager-content', '暫無聊天室', 'fa-door-open');
                return;
            }
            
            let html = `
                <div class="room-manager-header mb-4">
                    <div class="row">
                        <div class="col-md-3">
                            <div class="card bg-primary text-white">
                                <div class="card-body text-center">
                                    <h5>聊天室總數</h5>
                                    <h2>${rooms.length}</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-success text-white">
                                <div class="card-body text-center">
                                    <h5>線上用戶</h5>
                                    <h2>${appConfig.state.onlineUsers.length}</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-info text-white">
                                <div class="card-body text-center">
                                    <h5>公開聊天室</h5>
                                    <h2>${rooms.filter(r => r.is_public).length}</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-warning text-white">
                                <div class="card-body text-center">
                                    <h5>私密聊天室</h5>
                                    <h2>${rooms.filter(r => !r.is_public).length}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="room-manager-actions mb-4">
                    <button class="btn btn-primary" onclick="roomManager.createRoom()">
                        <i class="fas fa-plus me-2"></i>創建新聊天室
                    </button>
                    <button class="btn btn-outline-secondary ms-2" onclick="roomManager.loadRoomManagerContent()">
                        <i class="fas fa-sync-alt me-2"></i>重新整理
                    </button>
                </div>
                
                <div class="room-list">
                    <h5 class="mb-3">所有聊天室</h5>
                    <div class="row">
                        ${rooms.map(room => this.renderRoomCard(room)).join('')}
                    </div>
                </div>
            `;
            
            content.html(html);
        }).fail(() => {
            utils.showError('#room-manager-content', '載入失敗', 'roomManager.loadRoomManagerContent()');
        });
    },
    
    // 渲染聊天室卡片
    renderRoomCard: function(room) {
        return `
            <div class="col-md-6 mb-3">
                <div class="room-card">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5 class="mb-1">
                                <i class="fas fa-door-open me-2 text-primary"></i>${room.name}
                                ${room.is_public ? '' : '<i class="fas fa-lock ms-2 text-warning" title="私密聊天室"></i>'}
                            </h5>
                            <p class="text-muted mb-2">${room.description || '無描述'}</p>
                            <small class="text-muted">
                                創建者: ${room.created_by} | 
                                創建時間: ${this.formatDate(room.created_at)}
                            </small>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li>
                                    <a class="dropdown-item" href="#" onclick="roomManager.joinRoomFromManager('${room.id}'); return false;">
                                        <i class="fas fa-sign-in-alt me-2"></i>加入聊天室
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="roomManager.viewRoomResources('${room.id}'); return false;">
                                        <i class="fas fa-folder-open me-2"></i>查看資源
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="roomManager.viewRoomStats('${room.id}'); return false;">
                                        <i class="fas fa-chart-bar me-2"></i>查看統計
                                    </a>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="roomManager.editRoom('${room.id}'); return false;">
                                        <i class="fas fa-edit me-2"></i>編輯設定
                                    </a>
                                </li>
                                ${room.created_by === appConfig.state.userName ? `
                                    <li>
                                        <a class="dropdown-item text-danger" href="#" onclick="roomManager.deleteRoom('${room.id}'); return false;">
                                            <i class="fas fa-trash me-2"></i>刪除聊天室
                                        </a>
                                    </li>
                                ` : ''}
                            </ul>
                        </div>
                    </div>
                    
                    <div id="room-resources-${room.id}" class="room-resources" style="display: none;">
                        <!-- 資源將動態載入 -->
                    </div>
                    
                    <div id="room-stats-${room.id}" class="room-stats" style="display: none;">
                        <!-- 統計將動態載入 -->
                    </div>
                </div>
            </div>
        `;
    },
    
    // 查看聊天室資源
    viewRoomResources: function(roomId) {
        const resourcesDiv = $(`#room-resources-${roomId}`);
        
        if (resourcesDiv.is(':visible')) {
            resourcesDiv.slideUp();
            return;
        }
        
        // 隱藏其他展開的區域
        $('.room-resources, .room-stats').slideUp();
        
        utils.showLoading(resourcesDiv, '載入資源...');
        resourcesDiv.slideDown();
        
        $.get(`${appConfig.api.roomResources}${roomId}/resources`, (resources) => {
            let html = '<h6 class="mt-3 mb-3">聊天室資源:</h6>';
            
            if (resources.length === 0) {
                html += '<p class="text-muted">暫無資源</p>';
            } else {
                // 按類型分組資源
                const groupedResources = this.groupResourcesByType(resources);
                
                html += '<div class="resources-grouped">';
                
                Object.entries(groupedResources).forEach(([type, items]) => {
                    html += `
                        <div class="resource-group mb-3">
                            <h6 class="text-muted">
                                <i class="fas ${this.getResourceIcon(type)} me-2"></i>
                                ${this.getResourceTypeName(type)} (${items.length})
                            </h6>
                            <div class="resource-list">
                    `;
                    
                    items.forEach(resource => {
                        html += `
                            <div class="resource-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <i class="fas ${this.getResourceIcon(resource.type)} resource-icon"></i>
                                        <span>${resource.name}</span>
                                        <small class="text-muted d-block ms-4">
                                            上傳者: ${resource.uploaded_by} | ${this.formatDate(resource.uploaded_at)}
                                        </small>
                                    </div>
                                    <div>
                                        ${resource.type === 'file' || resource.type === 'image' || resource.type === 'document' ? 
                                            `<a href="${resource.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                                <i class="fas fa-download"></i>
                                            </a>` : 
                                            `<a href="${resource.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                                <i class="fas fa-external-link-alt"></i>
                                            </a>`
                                        }
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    html += '</div></div>';
                });
                
                html += '</div>';
            }
            
            resourcesDiv.html(html);
        }).fail(() => {
            resourcesDiv.html('<p class="text-danger">載入資源失敗</p>');
        });
    },
    
    // 查看聊天室統計
    viewRoomStats: function(roomId) {
        const statsDiv = $(`#room-stats-${roomId}`);
        
        if (statsDiv.is(':visible')) {
            statsDiv.slideUp();
            return;
        }
        
        // 隱藏其他展開的區域
        $('.room-resources, .room-stats').slideUp();
        
        utils.showLoading(statsDiv, '載入統計...');
        statsDiv.slideDown();
        
        // 模擬統計資料（實際應從後端獲取）
        setTimeout(() => {
            const html = `
                <h6 class="mt-3 mb-3">聊天室統計:</h6>
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-item">
                            <i class="fas fa-comments fa-2x text-primary mb-2"></i>
                            <h5>${Math.floor(Math.random() * 1000)}</h5>
                            <small class="text-muted">總訊息數</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <i class="fas fa-users fa-2x text-success mb-2"></i>
                            <h5>${Math.floor(Math.random() * 50)}</h5>
                            <small class="text-muted">參與用戶</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <i class="fas fa-file fa-2x text-info mb-2"></i>
                            <h5>${Math.floor(Math.random() * 100)}</h5>
                            <small class="text-muted">分享檔案</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <i class="fas fa-poll fa-2x text-warning mb-2"></i>
                            <h5>${Math.floor(Math.random() * 20)}</h5>
                            <small class="text-muted">投票活動</small>
                        </div>
                    </div>
                </div>
                <canvas id="room-activity-chart-${roomId}" class="mt-3" height="100"></canvas>
            `;
            
            statsDiv.html(html);
            
            // 繪製活動圖表
            this.drawRoomActivityChart(roomId);
        }, 500);
    },
    
    // 繪製聊天室活動圖表
    drawRoomActivityChart: function(roomId) {
        const ctx = document.getElementById(`room-activity-chart-${roomId}`);
        if (!ctx) return;
        
        // 模擬資料
        const labels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
        const data = labels.map(() => Math.floor(Math.random() * 100));
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '訊息數量',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },
    
    // 創建聊天室
    createRoom: function() {
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-plus me-2"></i>創建新聊天室
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="create-room-form">
                                <div class="mb-3">
                                    <label for="room-name" class="form-label">聊天室名稱</label>
                                    <input type="text" class="form-control" id="room-name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="room-description" class="form-label">描述</label>
                                    <textarea class="form-control" id="room-description" rows="3"></textarea>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="room-public" checked>
                                        <label class="form-check-label" for="room-public">
                                            公開聊天室
                                        </label>
                                        <small class="text-muted d-block">公開聊天室所有人都可以加入</small>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="roomManager.confirmCreateRoom()">
                                <i class="fas fa-check me-2"></i>創建
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
    
    // 確認創建聊天室
    confirmCreateRoom: function() {
        const name = $('#room-name').val().trim();
        const description = $('#room-description').val().trim();
        const isPublic = $('#room-public').is(':checked');
        
        if (!name) {
            utils.showAlert('❌ 請輸入聊天室名稱', 'danger');
            return;
        }
        
        if (!appConfig.state.socket) {
            utils.showAlert('❌ 聊天連接尚未建立', 'danger');
            return;
        }
        
        appConfig.state.socket.emit('create_room', {
            name: name,
            description: description,
            is_public: isPublic
        });
        
        // 關閉所有模態框
        $('.modal').modal('hide');
    },
    
    // 編輯聊天室
    editRoom: function(roomId) {
        utils.showAlert('⚠️ 編輯功能尚未實現', 'warning');
    },
    
    // 刪除聊天室
    deleteRoom: function(roomId) {
        if (!confirm('確定要刪除此聊天室嗎？此操作無法復原。')) return;
        
        utils.showAlert('⚠️ 刪除功能尚未實現', 'warning');
    },
    
    // 從管理中心加入聊天室
    joinRoomFromManager: function(roomId) {
        // 關閉管理中心
        $('#roomManagerModal').modal('hide');
        
        // 開啟聊天室
        setTimeout(() => {
            chatManager.openChat();
            setTimeout(() => {
                chatManager.joinRoom(roomId);
            }, 300);
        }, 300);
    },
    
    // 資源分組
    groupResourcesByType: function(resources) {
        const grouped = {};
        
        resources.forEach(resource => {
            if (!grouped[resource.type]) {
                grouped[resource.type] = [];
            }
            grouped[resource.type].push(resource);
        });
        
        return grouped;
    },
    
    // 獲取資源圖示
    getResourceIcon: function(type) {
        const icons = {
            'image': 'fa-image',
            'document': 'fa-file-alt',
            'file': 'fa-file',
            'link': 'fa-link',
            'video': 'fa-video',
            'audio': 'fa-music'
        };
        return icons[type] || 'fa-file';
    },
    
    // 獲取資源類型名稱
    getResourceTypeName: function(type) {
        const names = {
            'image': '圖片',
            'document': '文件',
            'file': '檔案',
            'link': '連結',
            'video': '影片',
            'audio': '音訊'
        };
        return names[type] || '其他';
    },
    
    // 格式化日期
    formatDate: function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },
    
    // 匯出聊天室資料
    exportRoomData: function(roomId) {
        utils.showAlert('⚠️ 匯出功能尚未實現', 'warning');
    },
    
    // 備份所有聊天室
    backupAllRooms: function() {
        if (!confirm('確定要備份所有聊天室資料嗎？')) return;
        
        utils.showAlert('⚠️ 備份功能尚未實現', 'warning');
    }
};