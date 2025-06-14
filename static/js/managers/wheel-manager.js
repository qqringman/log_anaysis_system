// Enhanced Log 分析平台 v6 - 轉盤管理器
// static/js/managers/wheel-manager.js

window.wheelManager = {
    currentWheel: null,
    
    init: function() {
        console.log('🎰 初始化轉盤管理器');
    },
    
    // 開啟幸運轉盤
    openLottery: function() {
        const modal = new bootstrap.Modal(document.getElementById('lotteryModal'));
        modal.show();
        this.initializeLotteryWheel();
    },
    
    // 初始化轉盤
    initializeLotteryWheel: function() {
        const wheelContainer = $('#lottery-wheel');
        wheelContainer.html(`
            <div class="text-center">
                <div class="mb-4">
                    <h5>選擇轉盤模式</h5>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="card h-100 hover-card" onclick="wheelManager.createDefaultWheel()">
                            <div class="card-body text-center">
                                <i class="fas fa-dice fa-3x mb-3 text-primary"></i>
                                <h6>預設轉盤</h6>
                                <p class="text-muted small">使用預設的6個選項</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="card h-100 hover-card" onclick="wheelManager.createCustomWheel()">
                            <div class="card-body text-center">
                                <i class="fas fa-cog fa-3x mb-3 text-success"></i>
                                <h6>自定義轉盤</h6>
                                <p class="text-muted small">創建您自己的選項</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-outline-primary" onclick="wheelManager.loadSavedWheels()">
                        <i class="fas fa-list me-2"></i>載入已儲存轉盤
                    </button>
                </div>
            </div>
        `);
        
        // 添加 hover 效果樣式
        $('<style>')
            .text('.hover-card:hover { transform: translateY(-5px); cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.15); }')
            .appendTo('head');
    },
    
    // 創建預設轉盤
    createDefaultWheel: function() {
        const defaultOptions = ['選項1', '選項2', '選項3', '選項4', '選項5', '選項6'];
        this.showWheel(defaultOptions, '預設轉盤');
    },
    
    // 創建自定義轉盤
    createCustomWheel: function(forChat = false) {
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-cog me-2"></i>創建自定義轉盤
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="wheel-name" class="form-label">轉盤名稱</label>
                                <input type="text" class="form-control" id="wheel-name" placeholder="輸入轉盤名稱">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">轉盤選項</label>
                                <div id="wheel-options">
                                    <div class="input-group mb-2">
                                        <span class="input-group-text">1</span>
                                        <input type="text" class="form-control wheel-option" placeholder="輸入選項">
                                    </div>
                                    <div class="input-group mb-2">
                                        <span class="input-group-text">2</span>
                                        <input type="text" class="form-control wheel-option" placeholder="輸入選項">
                                    </div>
                                </div>
                                <button class="btn btn-outline-primary btn-sm" onclick="wheelManager.addWheelOption()">
                                    <i class="fas fa-plus me-1"></i>添加選項
                                </button>
                            </div>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                至少需要2個選項才能創建轉盤
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="wheelManager.confirmCreateWheel(${forChat})">
                                <i class="fas fa-check me-2"></i>創建轉盤
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        // 儲存 modal 實例
        this.customWheelModal = {
            element: modal,
            instance: modalInstance
        };
        
        modal.on('hidden.bs.modal', () => {
            modal.remove();
            this.customWheelModal = null;
        });
    },
    
    // 添加轉盤選項
    addWheelOption: function() {
        const container = $('#wheel-options');
        const count = container.find('.input-group').length + 1;
        
        if (count > 10) {
            utils.showAlert('⚠️ 最多只能添加10個選項', 'warning');
            return;
        }
        
        const optionHtml = `
            <div class="input-group mb-2">
                <span class="input-group-text">${count}</span>
                <input type="text" class="form-control wheel-option" placeholder="輸入選項">
                <button class="btn btn-outline-danger" onclick="$(this).parent().remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.append(optionHtml);
    },
    
    // 確認創建轉盤
    confirmCreateWheel: function(forChat) {
        const name = $('#wheel-name').val().trim() || '自定義轉盤';
        const options = [];
        
        $('.wheel-option').each(function() {
            const value = $(this).val().trim();
            if (value) {
                options.push(value);
            }
        });
        
        if (options.length < 2) {
            utils.showAlert('❌ 至少需要2個選項', 'danger');
            return;
        }
        
        // 關閉自定義對話框
        if (this.customWheelModal) {
            this.customWheelModal.instance.hide();
        }
        
        if (forChat && appConfig.state.socket && appConfig.state.currentRoom) {
            // 為聊天室創建轉盤
            appConfig.state.socket.emit('create_wheel', {
                room_id: appConfig.state.currentRoom,
                name: name,
                options: options
            });
            
            // 關閉轉盤模態框
            $('#lotteryModal').modal('hide');
        } else {
            // 本地轉盤
            this.showWheel(options, name);
            
            // 儲存轉盤
            this.saveWheel(name, options);
        }
    },
    
    // 顯示轉盤
    showWheel: function(options, name) {
        this.currentWheel = {
            name: name,
            options: options
        };
        
        const wheelContainer = $('#lottery-wheel');
        wheelContainer.html(`
            <div class="wheel-container">
                <h5 class="mb-3">${name}</h5>
                <div class="wheel-wrapper" style="position: relative; margin: 0 auto; width: 300px; height: 300px;">
                    <div class="wheel" id="wheel" style="width: 300px; height: 300px; position: relative;">
                        <!-- 轉盤將在這裡繪製 -->
                    </div>
                    <div class="wheel-pointer" style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); z-index: 10;">
                        <div style="width: 0; height: 0; border-left: 20px solid transparent; border-right: 20px solid transparent; border-bottom: 40px solid #333;"></div>
                    </div>
                </div>
                <div class="mt-4">
                    <button class="btn btn-primary btn-lg" onclick="wheelManager.spinWheel()">
                        <i class="fas fa-sync-alt me-2"></i>開始轉盤
                    </button>
                    <button class="btn btn-outline-secondary btn-lg ms-2" onclick="wheelManager.initializeLotteryWheel()">
                        <i class="fas fa-arrow-left me-2"></i>返回
                    </button>
                </div>
                <div id="lottery-result" class="mt-3" style="display: none;">
                    <div class="alert alert-success">
                        <h5 class="mb-0">
                            <i class="fas fa-trophy me-2"></i>結果：<span id="lottery-winner"></span>
                        </h5>
                    </div>
                </div>
            </div>
        `);
        
        this.drawWheel(options);
    },
    
    // 繪製轉盤
    drawWheel: function(options) {
        const wheel = $('#wheel');
        wheel.empty();
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#74b9ff', '#a29bfe', '#fd79a8', '#fdcb6e'];
        const anglePerSegment = 360 / options.length;
        
        // 使用 CSS 創建轉盤
        let segments = '';
        options.forEach((option, index) => {
            const startAngle = index * anglePerSegment;
            const color = colors[index % colors.length];
            
            // 創建扇形區段
            const segment = $(`
                <div class="wheel-segment" style="
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    clip-path: polygon(50% 50%, ${this.getPointOnCircle(startAngle, 50)}%, ${this.getPointOnCircle(startAngle + anglePerSegment, 50)}%);
                    background: ${color};
                    transform-origin: center;
                ">
                    <div style="
                        position: absolute;
                        top: 25%;
                        left: 50%;
                        transform: translateX(-50%) rotate(${startAngle + anglePerSegment/2}deg);
                        text-align: center;
                        font-weight: bold;
                        color: white;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    ">${option}</div>
                </div>
            `);
            
            wheel.append(segment);
        });
        
        // 添加中心圓
        wheel.append(`
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 60px;
                height: 60px;
                background: #333;
                border-radius: 50%;
                z-index: 5;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            ">SPIN</div>
        `);
        
        // 使用 CSS 繪製更簡單的轉盤
        const gradient = options.map((option, index) => {
            const color = colors[index % colors.length];
            const start = (index / options.length * 100).toFixed(2);
            const end = ((index + 1) / options.length * 100).toFixed(2);
            return `${color} ${start}% ${end}%`;
        }).join(', ');
        
        wheel.css({
            'background': `conic-gradient(${gradient})`,
            'border-radius': '50%',
            'border': '5px solid #333',
            'box-shadow': '0 5px 20px rgba(0,0,0,0.3)'
        });
    },
    
    // 獲取圓上的點
    getPointOnCircle: function(angle, radius) {
        const radian = angle * Math.PI / 180;
        return {
            x: 50 + radius * Math.cos(radian),
            y: 50 + radius * Math.sin(radian)
        };
    },
    
    // 旋轉轉盤
    spinWheel: function() {
        if (!this.currentWheel) return;
        
        const wheel = $('#wheel');
        const options = this.currentWheel.options;
        const randomIndex = Math.floor(Math.random() * options.length);
        const anglePerSegment = 360 / options.length;
        
        // 計算旋轉角度 (5圈 + 隨機位置)
        const rotation = 360 * 5 + (randomIndex * anglePerSegment) + (anglePerSegment / 2);
        
        // 重置轉盤
        wheel.css({
            'transition': 'none',
            'transform': 'rotate(0deg)'
        });
        
        // 開始旋轉
        setTimeout(() => {
            wheel.css({
                'transition': 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
                'transform': `rotate(${rotation}deg)`
            });
        }, 50);
        
        // 顯示結果
        setTimeout(() => {
            const result = options[options.length - 1 - randomIndex]; // 因為轉盤是順時針轉的
            $('#lottery-winner').text(result);
            $('#lottery-result').fadeIn();
            
            utils.showAlert(`🎉 轉盤結果: ${result}`, 'success');
            utils.playNotificationSound('success');
            
            // 震動效果
            wheel.addClass('animate__animated animate__tada');
            setTimeout(() => {
                wheel.removeClass('animate__animated animate__tada');
            }, 1000);
        }, 4000);
    },
    
    // 儲存轉盤
    saveWheel: function(name, options) {
        const wheelId = utils.generateId('wheel');
        const wheelData = {
            id: wheelId,
            name: name,
            options: options,
            created_at: new Date().toISOString()
        };
        
        // 儲存到本地
        let savedWheels = utils.loadLocal('savedWheels', {});
        savedWheels[wheelId] = wheelData;
        utils.saveLocal('savedWheels', savedWheels);
        
        utils.showAlert('✅ 轉盤已儲存', 'success');
    },
    
    // 載入已儲存的轉盤
    loadSavedWheels: function() {
        const savedWheels = utils.loadLocal('savedWheels', {});
        const wheels = Object.values(savedWheels);
        
        if (wheels.length === 0) {
            utils.showAlert('⚠️ 沒有已儲存的轉盤', 'warning');
            return;
        }
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-list me-2"></i>已儲存的轉盤
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                ${wheels.map(wheel => `
                                    <div class="col-md-6 mb-3">
                                        <div class="card h-100">
                                            <div class="card-body">
                                                <h6 class="card-title">${wheel.name}</h6>
                                                <p class="card-text small text-muted">
                                                    ${wheel.options.length} 個選項<br>
                                                    創建於: ${new Date(wheel.created_at).toLocaleDateString()}
                                                </p>
                                                <div class="d-flex gap-2">
                                                    <button class="btn btn-primary btn-sm" onclick="wheelManager.loadWheel('${wheel.id}')">
                                                        <i class="fas fa-play me-1"></i>使用
                                                    </button>
                                                    <button class="btn btn-outline-danger btn-sm" onclick="wheelManager.deleteWheel('${wheel.id}')">
                                                        <i class="fas fa-trash me-1"></i>刪除
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(modal[0]);
        modalInstance.show();
        
        this.savedWheelsModal = modal;
        modal.on('hidden.bs.modal', () => {
            modal.remove();
            this.savedWheelsModal = null;
        });
    },
    
    // 載入特定轉盤
    loadWheel: function(wheelId) {
        const savedWheels = utils.loadLocal('savedWheels', {});
        const wheel = savedWheels[wheelId];
        
        if (!wheel) {
            utils.showAlert('❌ 轉盤不存在', 'danger');
            return;
        }
        
        // 關閉列表模態框
        if (this.savedWheelsModal) {
            this.savedWheelsModal.modal('hide');
        }
        
        this.showWheel(wheel.options, wheel.name);
    },
    
    // 刪除轉盤
    deleteWheel: function(wheelId) {
        if (!confirm('確定要刪除此轉盤嗎？')) return;
        
        let savedWheels = utils.loadLocal('savedWheels', {});
        delete savedWheels[wheelId];
        utils.saveLocal('savedWheels', savedWheels);
        
        utils.showAlert('✅ 轉盤已刪除', 'success');
        
        // 重新載入列表
        if (this.savedWheelsModal) {
            this.savedWheelsModal.modal('hide');
            setTimeout(() => {
                this.loadSavedWheels();
            }, 300);
        }
    },
    
    // 顯示轉盤選擇器（聊天室用）
    showWheelSelector: function(forChat) {
        const wheels = Object.values(appConfig.state.luckyWheels).filter(w => w.room_id === appConfig.state.currentRoom);
        
        if (wheels.length === 0) {
            this.createCustomWheel(true);
            return;
        }
        
        const modal = $(`
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-dice me-2"></i>選擇轉盤
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="list-group">
                                ${wheels.map(wheel => `
                                    <a href="#" class="list-group-item list-group-item-action" onclick="wheelManager.spinChatWheel('${wheel.wheel_id}'); return false;">
                                        <h6 class="mb-1">${wheel.name}</h6>
                                        <small class="text-muted">創建者: ${wheel.created_by}</small>
                                    </a>
                                `).join('')}
                            </div>
                            <div class="mt-3">
                                <button class="btn btn-primary w-100" onclick="wheelManager.createCustomWheel(true)">
                                    <i class="fas fa-plus me-2"></i>創建新轉盤
                                </button>
                            </div>
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
    
    // 旋轉聊天室轉盤
    spinChatWheel: function(wheelId) {
        if (appConfig.state.socket) {
            appConfig.state.socket.emit('spin_wheel', {
                wheel_id: wheelId
            });
        }
        
        // 關閉所有模態框
        $('.modal').modal('hide');
    }
};