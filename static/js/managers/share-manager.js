// Enhanced Log 分析平台 v6 - 分享管理器
// static/js/managers/share-manager.js

window.shareManager = {
    init: function() {
        console.log('🔗 初始化分享管理器');
    },
    
    // 分享結果
    shareResults: function() {
        if (!appConfig.state.currentAnalysisId) {
            utils.showAlert('❌ 沒有可分享的分析結果', 'warning');
            return;
        }
        
        // 顯示分享設定對話框
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-share me-2"></i>分享分析結果
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="share-form">
                                <div class="mb-3">
                                    <label class="form-label">分享模式</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="shareMode" id="share-public" value="public" checked>
                                        <label class="form-check-label" for="share-public">
                                            <i class="fas fa-globe me-2"></i>公開分享
                                            <small class="text-muted d-block">任何人都可以通過連結查看</small>
                                        </label>
                                    </div>
                                    <div class="form-check mt-2">
                                        <input class="form-check-input" type="radio" name="shareMode" id="share-private" value="private">
                                        <label class="form-check-label" for="share-private">
                                            <i class="fas fa-lock me-2"></i>私密分享
                                            <small class="text-muted d-block">只有擁有連結的人可以查看</small>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="expire-days" class="form-label">過期時間</label>
                                    <select class="form-select" id="expire-days">
                                        <option value="1">1 天</option>
                                        <option value="3">3 天</option>
                                        <option value="7" selected>7 天</option>
                                        <option value="30">30 天</option>
                                        <option value="90">90 天</option>
                                        <option value="365">1 年</option>
                                    </select>
                                </div>
                                
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    分享連結將在過期後自動失效
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="shareManager.createShare()">
                                <i class="fas fa-share me-2"></i>創建分享連結
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        // 儲存 modal 實例供後續使用
        this.currentShareModal = {
            element: modal,
            instance: modalInstance
        };
        
        modal.on('hidden.bs.modal', () => {
            modal.remove();
            this.currentShareModal = null;
        });
    },
    
    // 創建分享
    createShare: function() {
        const isPublic = $('#share-public').is(':checked');
        const expiresDays = $('#expire-days').val();
        
        $.ajax({
            url: appConfig.api.shareResult,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                analysis_id: appConfig.state.currentAnalysisId,
                is_public: isPublic,
                expires_days: parseInt(expiresDays)
            }),
            success: (response) => {
                if (response.success) {
                    // 關閉設定對話框
                    if (this.currentShareModal) {
                        this.currentShareModal.instance.hide();
                    }
                    
                    // 顯示分享連結
                    this.showShareLink(response.share_url, response.expires_at);
                } else {
                    utils.showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: () => {
                utils.showAlert('❌ 分享失敗', 'danger');
            }
        });
    },
    
    // 顯示分享連結
    showShareLink: function(shareUrl, expiresAt) {
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-check-circle me-2"></i>分享連結已創建
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">分享連結</label>
                                <div class="input-group">
                                    <input type="text" class="form-control" id="share-url-input" value="${shareUrl}" readonly>
                                    <button class="btn btn-primary" onclick="shareManager.copyShareLink('${shareUrl}')">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="alert alert-warning">
                                <i class="fas fa-clock me-2"></i>
                                此連結將於 ${new Date(expiresAt).toLocaleDateString('zh-TW')} 過期
                            </div>
                            
                            <div class="d-grid gap-2">
                                <button class="btn btn-outline-primary" onclick="shareManager.shareViaEmail('${shareUrl}')">
                                    <i class="fas fa-envelope me-2"></i>通過郵件分享
                                </button>
                                <button class="btn btn-outline-primary" onclick="shareManager.generateQRCode('${shareUrl}')">
                                    <i class="fas fa-qrcode me-2"></i>生成 QR Code
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="window.open('${shareUrl}', '_blank')">
                                <i class="fas fa-external-link-alt me-2"></i>開啟連結
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
        
        // 自動選擇連結文字
        setTimeout(() => {
            $('#share-url-input').select();
        }, 500);
    },
    
    // 複製分享連結
    copyShareLink: function(url) {
        navigator.clipboard.writeText(url).then(() => {
            utils.showAlert('✅ 連結已複製到剪貼板', 'success');
        }).catch(() => {
            // Fallback
            const input = $('#share-url-input');
            input.select();
            document.execCommand('copy');
            utils.showAlert('✅ 連結已複製到剪貼板', 'success');
        });
    },
    
    // 通過郵件分享
    shareViaEmail: function(url) {
        const subject = encodeURIComponent('Enhanced Log 分析結果分享');
        const body = encodeURIComponent(`您好，\n\n我想與您分享 Enhanced Log 分析平台的分析結果。\n\n請點擊以下連結查看：\n${url}\n\n此致`);
        
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    },
    
    // 生成 QR Code
    generateQRCode: function(url) {
        // 使用 qr-server.com API 生成 QR Code
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog modal-sm">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-qrcode me-2"></i>QR Code
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img src="${qrUrl}" alt="QR Code" class="img-fluid">
                            <p class="mt-3 text-muted small">掃描 QR Code 開啟分享連結</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <a href="${qrUrl}" download="share_qrcode.png" class="btn btn-primary">
                                <i class="fas fa-download me-2"></i>下載
                            </a>
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
    
    // 開啟分享管理中心
    openShareManager: function() {
        const modal = new bootstrap.Modal(document.getElementById('shareManagerModal'));
        modal.show();
        this.loadShareManagerContent();
    },
    
    // 載入分享管理內容
    loadShareManagerContent: function() {
        utils.showLoading('#share-manager-content', '載入分享記錄...');
        
        $.get(appConfig.api.shareManager, (shares) => {
            const content = $('#share-manager-content');
            
            if (shares.length === 0) {
                utils.showEmpty('#share-manager-content', '暫無分享記錄', 'fa-share-alt');
                return;
            }
            
            let html = `
                <div class="share-stats mb-4">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card bg-primary text-white">
                                <div class="card-body text-center">
                                    <h5>總分享數</h5>
                                    <h2>${shares.length}</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-success text-white">
                                <div class="card-body text-center">
                                    <h5>總查看次數</h5>
                                    <h2>${shares.reduce((sum, s) => sum + s.view_count, 0)}</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-info text-white">
                                <div class="card-body text-center">
                                    <h5>有效分享</h5>
                                    <h2>${shares.filter(s => new Date(s.expires_at) > new Date()).length}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="share-list">
                    <h6 class="mb-3">分享記錄</h6>
            `;
            
            shares.forEach(share => {
                const isExpired = new Date(share.expires_at) < new Date();
                
                html += `
                    <div class="share-item ${isExpired ? 'opacity-50' : ''}">
                        <div>
                            <strong>分析 ID:</strong> ${share.analysis_id}<br>
                            <div class="share-link">${share.share_url}</div>
                            <div class="share-stats mt-2">
                                <span><i class="fas fa-eye"></i> ${share.view_count} 次查看</span>
                                <span><i class="fas fa-clock"></i> ${isExpired ? '已過期' : `過期: ${new Date(share.expires_at).toLocaleDateString()}`}</span>
                                <span><i class="fas fa-${share.is_public ? 'globe' : 'lock'}"></i> ${share.is_public ? '公開' : '私密'}</span>
                            </div>
                        </div>
                        <div>
                            ${!isExpired ? `
                                <button class="btn btn-sm btn-outline-primary" onclick="shareManager.copyShareLink('${share.share_url}')">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <a href="${share.share_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="shareManager.deleteShare('${share.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            content.html(html);
        }).fail(() => {
            utils.showError('#share-manager-content', '載入失敗', 'shareManager.loadShareManagerContent()');
        });
    },
    
    // 刪除分享
    deleteShare: function(shareId) {
        if (!confirm('確定要刪除此分享？')) return;
        
        $.ajax({
            url: `/api/share/${shareId}`,
            type: 'DELETE',
            success: () => {
                utils.showAlert('✅ 分享已刪除', 'success');
                this.loadShareManagerContent();
            },
            error: () => {
                utils.showAlert('❌ 刪除失敗', 'danger');
            }
        });
    },
    
    // 批量操作
    deleteExpiredShares: function() {
        if (!confirm('確定要刪除所有已過期的分享嗎？')) return;
        
        // 這需要後端支援批量刪除 API
        utils.showAlert('⚠️ 此功能尚未實現', 'warning');
    }
};