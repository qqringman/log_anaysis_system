// Enhanced Log 分析平台 v6 - 完整功能版 JavaScript
// 全域變數
let currentPath = '/home';
let selectedFiles = [];
let droppedFiles = [];
let keywords = {};
let allSelectMode = false;
let currentAnalysisId = null;
let eventSource = null;
let audioContext = null;
let currentViewMode = 'module';
let minimizedBlocks = new Set();
let socket = null;
let currentRoom = null;
let userName = '';
let moduleChart = null;
let currentLayout = 'default';
let onlineUsers = [];
let chatRooms = [];
let luckyWheels = {};
let polls = {};

// 頁面載入時初始化
$(document).ready(function() {
    console.log('🚀 Enhanced Log 分析平台 v6 載入完成');
    
    initializeApp();
    setupEventListeners();
    setupDropAnalysis();
    setupSocketIO();
    setupDraggable();
    loadDirectory(currentPath);
    setupKeyboardShortcuts();
    
    console.log('✅ 初始化完成');
});

function initializeApp() {
    console.log('🔧 初始化應用...');
    
    // 初始化音頻上下文
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('⚠️ 音頻上下文初始化失敗，音效將不可用');
    }
    
    // 設置用戶名
    userName = prompt('請輸入您的名稱：') || `Guest_${Math.floor(Math.random() * 1000)}`;
    
    // 載入已有的關鍵字
    $.get('/api/keywords')
        .done(function(data) {
            console.log('📋 載入關鍵字:', data);
            if (Object.keys(data).length > 0) {
                keywords = data;
                updateKeywordPreview();
            }
        })
        .fail(function() {
            console.log('❌ 載入關鍵字失敗');
        });
}

function setupDraggable() {
    // 初始化可拖動區塊
    $('.dashboard-block').draggable({
        handle: '.drag-handle',
        revert: 'invalid',
        start: function(event, ui) {
            $(this).addClass('ui-draggable-dragging');
        },
        stop: function(event, ui) {
            $(this).removeClass('ui-draggable-dragging');
        }
    });
    
    // 使容器可排序
    $('.dashboard-container').sortable({
        items: '.dashboard-block',
        handle: '.drag-handle',
        placeholder: 'ui-sortable-placeholder',
        tolerance: 'pointer',
        update: function(event, ui) {
            saveDashboardLayout();
        }
    });
}

function setLayout(layout) {
    currentLayout = layout;
    $('.dashboard-container').removeClass('layout-default layout-grid layout-masonry');
    $('.dashboard-container').addClass(`layout-${layout}`);
    
    // 更新按鈕狀態
    $('.layout-btn').removeClass('active');
    $(`.layout-btn[onclick="setLayout('${layout}')"]`).addClass('active');
    
    // 重新初始化拖動功能
    if (layout === 'default') {
        setupDraggable();
    } else {
        $('.dashboard-block').draggable('destroy');
        $('.dashboard-container').sortable('destroy');
    }
    
    showAlert(`🔄 已切換到${layout === 'default' ? '預設' : layout === 'grid' ? '網格' : '瀑布流'}佈局`, 'info');
}

function toggleMobileView() {
    const isMobile = $('#mobile-view-toggle').is(':checked');
    
    if (isMobile) {
        $('body').addClass('mobile-view');
        // 調整視口
        $('meta[name="viewport"]').attr('content', 'width=375, initial-scale=1.0');
        showAlert('📱 已切換到手機視圖', 'info');
    } else {
        $('body').removeClass('mobile-view');
        // 恢復視口
        $('meta[name="viewport"]').attr('content', 'width=device-width, initial-scale=1.0');
        showAlert('💻 已切換到桌面視圖', 'info');
    }
}

function saveDashboardLayout() {
    const layout = [];
    $('.dashboard-block').each(function(index) {
        layout.push({
            id: $(this).attr('id'),
            order: index
        });
    });
    
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
}

function loadDashboardLayout() {
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
        const layout = JSON.parse(savedLayout);
        const container = $('.dashboard-container');
        
        layout.forEach(item => {
            const block = $(`#${item.id}`);
            if (block.length) {
                container.append(block);
            }
        });
    }
}

function setupEventListeners() {
    console.log('🎛️ 設置事件監聽器...');
    
    // 檔案上傳
    $('#keyword-file').on('change', function() {
        const file = this.files[0];
        if (file) {
            console.log('📁 選擇檔案:', file.name);
            uploadKeywords(file);
        }
    });
    
    // 拖拽上傳關鍵字
    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('dragover');
        });
        
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
        });
        
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadKeywords(files[0]);
            }
        });
    }
    
    // 路徑輸入框 Enter 鍵
    $('#path-input').on('keypress', function(e) {
        if (e.which === 13) {
            navigateToPath();
        }
    });
    
    // 聊天輸入框 Enter 鍵
    $('#chat-input').on('keypress', function(e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 廣播訊息預覽
    $('#broadcast-message').on('input', function() {
        const message = $(this).val();
        const priority = $('#broadcast-priority').val();
        updateBroadcastPreview(message, priority);
    });
    
    // 檢視模式選項變更
    $('#include-browser-files, #include-dropped-files').on('change', updateAnalysisCount);
}

function setupDropAnalysis() {
    console.log('🎯 設置拖曳分析功能');
    
    const dropZone = document.getElementById('drop-analysis-zone');
    const quickAnalysisFile = document.getElementById('quick-analysis-file');
    
    // 拖曳區域事件
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        if (!dropZone.contains(e.relatedTarget)) {
            $(this).removeClass('dragover');
        }
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        handleDroppedFiles(files);
    });
    
    // 檔案選擇器事件
    quickAnalysisFile.addEventListener('change', function() {
        const files = Array.from(this.files);
        handleDroppedFiles(files);
    });
}

function setupSocketIO() {
    console.log('🔌 初始化 Socket.IO 連接');
    
    try {
        socket = io();
        
        socket.on('connect', function() {
            console.log('✅ Socket.IO 連接成功');
            socket.emit('set_username', { username: userName });
        });
        
        socket.on('disconnect', function() {
            console.log('❌ Socket.IO 連接斷開');
        });
        
        socket.on('user_connected', function(data) {
            console.log('👤 用戶連接:', data);
            onlineUsers = data.online_users || [];
            updateOnlineUsersList();
        });
        
        socket.on('user_disconnected', function(data) {
            console.log('👤 用戶斷開:', data);
            onlineUsers = data.online_users || [];
            updateOnlineUsersList();
        });
        
        socket.on('user_list_updated', function(data) {
            onlineUsers = data.online_users || [];
            updateOnlineUsersList();
        });
        
        socket.on('joined_room', function(data) {
            currentRoom = data.room_id;
            loadChatHistory(data.history);
            updateRoomUsers(data.room_users);
            $('#current-room-name').text(`聊天室: ${data.room_id}`);
        });
        
        socket.on('new_message', function(data) {
            displayChatMessage(data);
        });
        
        socket.on('mentioned', function(data) {
            showNotification(`${data.by} 在 ${data.room_id} 提及了您: ${data.message}`);
        });
        
        socket.on('user_joined_room', function(data) {
            displaySystemMessage(`${data.user_name} 加入了聊天室`);
            updateRoomUsers(data.room_users);
        });
        
        socket.on('user_left_room', function(data) {
            displaySystemMessage(`${data.user_name} 離開了聊天室`);
            updateRoomUsers(data.room_users);
        });
        
        socket.on('broadcast', function(data) {
            showBroadcastMessage(data);
        });
        
        socket.on('new_room_available', function(data) {
            showAlert(`🏠 新聊天室: ${data.name} (創建者: ${data.created_by})`, 'info');
            loadRoomList();
        });
        
        socket.on('room_created', function(data) {
            $('#chatModal').modal('hide');
            showAlert(`✅ 聊天室 "${data.name}" 創建成功！`, 'success');
            setTimeout(() => {
                joinRoom(data.room_id);
            }, 500);
        });
        
        socket.on('new_poll', function(data) {
            displayPoll(data);
        });
        
        socket.on('poll_updated', function(data) {
            updatePollResults(data);
        });
        
        socket.on('new_wheel', function(data) {
            luckyWheels[data.wheel_id] = data;
            showAlert(`🎰 ${data.created_by} 創建了新轉盤: ${data.name}`, 'info');
        });
        
        socket.on('wheel_result', function(data) {
            displayWheelResult(data);
        });
        
    } catch (e) {
        console.log('⚠️ Socket.IO 初始化失敗:', e);
    }
}

function setupKeyboardShortcuts() {
    // Ctrl + Enter 開始分析
    $(document).keydown(function(e) {
        if (e.ctrlKey && e.which === 13) {
            e.preventDefault();
            if (!$('#analyze-btn').prop('disabled')) {
                startStreamAnalysis();
            }
        }
        
        // Esc 停止分析
        if (e.which === 27 && currentAnalysisId) {
            e.preventDefault();
            if (confirm('確定要停止分析嗎？')) {
                stopStreamAnalysis();
            }
        }
        
        // Ctrl + / 開啟聊天室
        if (e.ctrlKey && e.which === 191) {
            e.preventDefault();
            openChat();
        }
    });
}

// 聊天室功能
function openChat() {
    const modal = new bootstrap.Modal(document.getElementById('chatModal'));
    modal.show();
    loadRoomList();
    updateOnlineUsersList();
}

function loadRoomList() {
    $.get('/api/rooms', function(rooms) {
        const roomList = $('#room-list');
        roomList.empty();
        
        rooms.forEach(room => {
            const roomItem = $(`
                <div class="user-item" onclick="joinRoom('${room.id}')">
                    <i class="fas fa-door-open me-2"></i>${room.name}
                    <small class="text-muted d-block">${room.description}</small>
                </div>
            `);
            roomList.append(roomItem);
        });
    });
}

function updateOnlineUsersList() {
    const usersList = $('#online-users-list');
    usersList.empty();
    
    onlineUsers.forEach(user => {
        const userItem = $(`
            <div class="user-item online" onclick="mentionUser('${user.name}')">
                ${user.name}
            </div>
        `);
        usersList.append(userItem);
    });
}

function updateRoomUsers(roomUsers) {
    // 更新聊天室內的用戶列表
    console.log('聊天室用戶:', roomUsers);
}

function joinRoom(roomId) {
    if (socket) {
        socket.emit('join_room', {
            room_id: roomId
        });
    }
}

function createNewRoom() {
    const name = prompt('請輸入聊天室名稱:');
    if (!name) return;
    
    const description = prompt('請輸入聊天室描述:');
    
    if (socket) {
        socket.emit('create_room', {
            name: name,
            description: description || '',
            is_public: true
        });
    }
}

function loadChatHistory(history) {
    const messagesContainer = $('#chat-messages');
    messagesContainer.empty();
    
    history.forEach(msg => {
        displayChatMessage(msg, false);
    });
    
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

function sendMessage() {
    const message = $('#chat-input').val().trim();
    if (!message || !currentRoom || !socket) return;
    
    socket.emit('send_message', {
        room_id: currentRoom,
        message: message,
        message_type: 'text'
    });
    
    $('#chat-input').val('');
}

function displayChatMessage(data, scrollToBottom = true) {
    const messagesContainer = $('#chat-messages');
    const isMention = data.mentioned_users && data.mentioned_users.includes(userName);
    
    const messageElement = $(`
        <div class="chat-message ${isMention ? 'mention' : ''}">
            <div class="user-name">${data.user_name}</div>
            <div class="timestamp">${data.timestamp}</div>
            <div class="message-content">${formatMessage(data.message)}</div>
        </div>
    `);
    
    messagesContainer.append(messageElement);
    
    if (scrollToBottom) {
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    }
}

function displaySystemMessage(message) {
    const messagesContainer = $('#chat-messages');
    const messageElement = $(`
        <div class="text-center text-muted small my-2">
            <i class="fas fa-info-circle me-1"></i>${message}
        </div>
    `);
    messagesContainer.append(messageElement);
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

function formatMessage(message) {
    // 格式化 @ 提及
    message = message.replace(/@(\w+)/g, '<span class="badge bg-primary">@$1</span>');
    
    // 格式化連結
    message = message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    
    return message;
}

function mentionUser(username) {
    const input = $('#chat-input');
    const currentText = input.val();
    input.val(currentText + '@' + username + ' ');
    input.focus();
}

function uploadChatFile() {
    const input = $('<input type="file">');
    input.on('change', function() {
        const file = this.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            if (socket && currentRoom) {
                socket.emit('upload_file', {
                    room_id: currentRoom,
                    file_data: e.target.result,
                    file_name: file.name,
                    file_type: getFileType(file.name)
                });
            }
        };
        reader.readAsDataURL(file);
    });
    input.click();
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
    return 'file';
}

function createPoll() {
    const question = prompt('請輸入投票問題:');
    if (!question) return;
    
    const options = [];
    for (let i = 0; i < 4; i++) {
        const option = prompt(`請輸入選項 ${i + 1} (留空結束):`);
        if (!option) break;
        options.push(option);
    }
    
    if (options.length < 2) {
        showAlert('❌ 投票至少需要2個選項', 'danger');
        return;
    }
    
    if (socket && currentRoom) {
        socket.emit('create_poll', {
            room_id: currentRoom,
            question: question,
            options: options,
            duration: 300 // 5分鐘
        });
    }
}

function displayPoll(data) {
    const messagesContainer = $('#chat-messages');
    const pollElement = $(`
        <div class="poll-container" id="poll-${data.poll_id}">
            <h6>${data.question}</h6>
            <div class="poll-options">
                ${data.options.map((option, index) => `
                    <div class="poll-option" onclick="votePoll('${data.poll_id}', ${index})">
                        <div class="vote-bar" style="width: 0%"></div>
                        <span>${option}</span>
                        <span class="vote-count">0</span>
                    </div>
                `).join('')}
            </div>
            <small class="text-muted">由 ${data.created_by} 發起</small>
        </div>
    `);
    messagesContainer.append(pollElement);
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

function votePoll(pollId, optionIndex) {
    if (socket) {
        socket.emit('vote_poll', {
            poll_id: pollId,
            option_index: optionIndex
        });
    }
}

function updatePollResults(data) {
    const pollElement = $(`#poll-${data.poll_id}`);
    if (!pollElement.length) return;
    
    const totalVotes = data.total_votes || 1;
    
    Object.entries(data.votes).forEach(([index, count]) => {
        const option = pollElement.find('.poll-option').eq(index);
        const percentage = (count / totalVotes * 100).toFixed(1);
        
        option.find('.vote-bar').css('width', percentage + '%');
        option.find('.vote-count').text(count);
    });
}

function useLuckyWheel() {
    if (!currentRoom) {
        showAlert('❌ 請先加入聊天室', 'danger');
        return;
    }
    
    // 顯示轉盤選擇對話框
    const wheels = Object.values(luckyWheels).filter(w => w.room_id === currentRoom);
    
    if (wheels.length === 0) {
        createCustomWheel(true);
        return;
    }
    
    // 讓用戶選擇現有轉盤或創建新的
    const wheelList = wheels.map(w => `<option value="${w.wheel_id}">${w.name}</option>`).join('');
    const selection = prompt(`選擇轉盤:\n${wheelList}\n\n或輸入 'new' 創建新轉盤`);
    
    if (selection === 'new') {
        createCustomWheel(true);
    } else if (selection && luckyWheels[selection]) {
        spinWheel(selection);
    }
}

// 廣播功能
function openBroadcast() {
    const modal = new bootstrap.Modal(document.getElementById('broadcastModal'));
    modal.show();
}

function updateBroadcastPreview(message, priority) {
    const preview = $('#broadcast-preview-content');
    const alertClass = {
        'info': 'alert-info',
        'warning': 'alert-warning',
        'danger': 'alert-danger'
    }[priority];
    
    preview.html(`
        <div class="alert ${alertClass} mb-0">
            <strong>廣播訊息：</strong><br>
            ${message || '(空白訊息)'}
        </div>
    `);
}

function sendBroadcast() {
    const message = $('#broadcast-message').val().trim();
    const priority = $('#broadcast-priority').val();
    
    if (!message) {
        showAlert('❌ 請輸入廣播訊息', 'danger');
        return;
    }
    
    if (socket) {
        socket.emit('broadcast_message', {
            message: message,
            priority: priority
        });
        
        $('#broadcastModal').modal('hide');
        $('#broadcast-message').val('');
        showAlert('📢 廣播已發送', 'success');
    }
}

function showBroadcastMessage(data) {
    const alertClass = data.priority === 'danger' ? 'alert-danger' : 
                      data.priority === 'warning' ? 'alert-warning' : 'alert-info';
    
    const broadcastHtml = `
        <div class="alert ${alertClass} position-fixed animate__animated animate__fadeInDown" 
             style="top: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 400px;">
            <h6 class="alert-heading">
                <i class="fas fa-broadcast-tower me-2"></i>廣播訊息
            </h6>
            <p class="mb-1">${data.message}</p>
            <small>來自: ${data.from} | ${data.timestamp}</small>
            <button type="button" class="btn-close" onclick="$(this).parent().remove()"></button>
        </div>
    `;
    
    $('body').append(broadcastHtml);
    
    // 播放通知音效
    playNotificationSound('broadcast');
    
    // 10秒後自動消失
    setTimeout(() => {
        $('.alert.position-fixed').fadeOut(() => {
            $('.alert.position-fixed').remove();
        });
    }, 10000);
}

// 幸運轉盤功能
function openLottery() {
    const modal = new bootstrap.Modal(document.getElementById('lotteryModal'));
    modal.show();
    initializeLotteryWheel();
}

function initializeLotteryWheel() {
    const wheelContainer = $('#lottery-wheel');
    wheelContainer.html(`
        <div class="wheel-container">
            <div class="wheel" id="wheel">
                <div class="wheel-pointer"></div>
            </div>
        </div>
        <div class="mt-3">
            <button class="btn btn-primary btn-lg" onclick="spinDefaultWheel()">
                <i class="fas fa-sync-alt me-2"></i>開始轉盤
            </button>
        </div>
        <div id="lottery-result" class="mt-3" style="display: none;">
            <h5>結果：<span id="lottery-winner"></span></h5>
        </div>
    `);
    
    // 默認選項
    drawWheel(['選項1', '選項2', '選項3', '選項4', '選項5', '選項6']);
}

function drawWheel(options) {
    const wheel = $('#wheel');
    wheel.empty();
    
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
    const anglePerSegment = 360 / options.length;
    
    let gradient = 'conic-gradient(';
    options.forEach((option, index) => {
        const startAngle = index * anglePerSegment;
        const endAngle = (index + 1) * anglePerSegment;
        const color = colors[index % colors.length];
        
        gradient += `${color} ${startAngle}deg ${endAngle}deg`;
        if (index < options.length - 1) gradient += ', ';
        
        // 添加文字標籤
        const segment = $(`
            <div class="wheel-segment" style="transform: rotate(${startAngle + anglePerSegment/2}deg)">
                <span style="transform: rotate(-${startAngle + anglePerSegment/2}deg)">${option}</span>
            </div>
        `);
        wheel.append(segment);
    });
    gradient += ')';
    
    wheel.css('background', gradient);
    wheel.append('<div class="wheel-pointer"></div>');
}

function createCustomWheel(forChat = false) {
    const name = prompt('請輸入轉盤名稱:');
    if (!name) return;
    
    const options = [];
    for (let i = 0; i < 10; i++) {
        const option = prompt(`請輸入選項 ${i + 1} (留空結束):`);
        if (!option) break;
        options.push(option);
    }
    
    if (options.length < 2) {
        showAlert('❌ 轉盤至少需要2個選項', 'danger');
        return;
    }
    
    if (forChat && socket && currentRoom) {
        socket.emit('create_wheel', {
            room_id: currentRoom,
            name: name,
            options: options
        });
    } else {
        // 本地轉盤
        drawWheel(options);
        window.currentWheelOptions = options;
    }
}

function spinDefaultWheel() {
    const options = window.currentWheelOptions || ['選項1', '選項2', '選項3', '選項4', '選項5', '選項6'];
    const wheel = $('#wheel');
    const randomIndex = Math.floor(Math.random() * options.length);
    const anglePerSegment = 360 / options.length;
    const rotation = 360 * 5 + (randomIndex * anglePerSegment) + (anglePerSegment / 2);
    
    wheel.css({
        'transition': 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
        'transform': `rotate(${rotation}deg)`
    });
    
    setTimeout(() => {
        $('#lottery-winner').text(options[randomIndex]);
        $('#lottery-result').show();
        showAlert(`🎉 轉盤結果: ${options[randomIndex]}`, 'success');
        playNotificationSound('success');
    }, 4000);
}

function spinWheel(wheelId) {
    if (socket) {
        socket.emit('spin_wheel', {
            wheel_id: wheelId
        });
    }
}

function displayWheelResult(data) {
    displaySystemMessage(`🎰 ${data.user_name} 轉動了轉盤，結果是: ${data.result}`);
}

function loadSavedWheels() {
    // 載入已儲存的轉盤
    const wheels = Object.values(luckyWheels);
    if (wheels.length === 0) {
        showAlert('❌ 沒有已儲存的轉盤', 'warning');
        return;
    }
    
    // 顯示轉盤列表讓用戶選擇
    // 這裡可以實現一個更好的UI來選擇轉盤
}

// 聊天室管理中心
function openRoomManager() {
    const modal = new bootstrap.Modal(document.getElementById('roomManagerModal'));
    modal.show();
    loadRoomManagerContent();
}

function loadRoomManagerContent() {
    $.get('/api/rooms', function(rooms) {
        const content = $('#room-manager-content');
        content.empty();
        
        const html = `
            <div class="row">
                ${rooms.map(room => `
                    <div class="col-md-6 mb-3">
                        <div class="room-card">
                            <h5>${room.name}</h5>
                            <p class="text-muted">${room.description}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small>創建者: ${room.created_by}</small>
                                <button class="btn btn-primary btn-sm" onclick="viewRoomResources('${room.id}')">
                                    <i class="fas fa-folder-open me-1"></i>查看資源
                                </button>
                            </div>
                            <div id="room-resources-${room.id}" class="mt-3" style="display: none;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        content.html(html);
    });
}

function viewRoomResources(roomId) {
    const resourcesDiv = $(`#room-resources-${roomId}`);
    
    if (resourcesDiv.is(':visible')) {
        resourcesDiv.slideUp();
        return;
    }
    
    $.get(`/api/room/${roomId}/resources`, function(resources) {
        let html = '<h6>聊天室資源:</h6>';
        
        if (resources.length === 0) {
            html += '<p class="text-muted">暫無資源</p>';
        } else {
            html += resources.map(resource => `
                <div class="resource-item">
                    <i class="fas ${getResourceIcon(resource.type)} resource-icon"></i>
                    <div>
                        <div>${resource.name}</div>
                        <small class="text-muted">上傳者: ${resource.uploaded_by} | ${resource.uploaded_at}</small>
                    </div>
                </div>
            `).join('');
        }
        
        resourcesDiv.html(html).slideDown();
    });
}

function getResourceIcon(type) {
    const icons = {
        'image': 'fa-image',
        'document': 'fa-file-alt',
        'file': 'fa-file',
        'link': 'fa-link'
    };
    return icons[type] || 'fa-file';
}

// 分享管理功能
function openShareManager() {
    const modal = new bootstrap.Modal(document.getElementById('shareManagerModal'));
    modal.show();
    loadShareManagerContent();
}

function loadShareManagerContent() {
    $.get('/api/share_manager', function(shares) {
        const content = $('#share-manager-content');
        
        let html = '<div class="share-list">';
        
        if (shares.length === 0) {
            html += '<p class="text-center text-muted">暫無分享記錄</p>';
        } else {
            html += shares.map(share => `
                <div class="share-item">
                    <div>
                        <strong>分析 ID:</strong> ${share.analysis_id}<br>
                        <div class="share-link">${share.share_url}</div>
                        <div class="share-stats">
                            <span><i class="fas fa-eye"></i> ${share.view_count} 次查看</span>
                            <span><i class="fas fa-clock"></i> 過期: ${new Date(share.expires_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary" onclick="copyShareLink('${share.share_url}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteShare('${share.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        html += '</div>';
        content.html(html);
    });
}

function shareResults() {
    if (!currentAnalysisId) {
        showAlert('❌ 沒有可分享的分析結果', 'warning');
        return;
    }
    
    const isPublic = confirm('是否設為公開分享？\n\n公開：任何人都可以查看\n私密：需要連結才能查看');
    const expiresDays = prompt('設定過期天數 (預設7天):', '7') || '7';
    
    $.ajax({
        url: '/api/share_result',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            analysis_id: currentAnalysisId,
            is_public: isPublic,
            expires_days: parseInt(expiresDays)
        }),
        success: function(response) {
            if (response.success) {
                copyShareLink(response.share_url);
                showAlert(`✅ 分享連結已創建並複製到剪貼板！\n\n${response.share_url}`, 'success');
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
            }
        },
        error: function() {
            showAlert('❌ 分享失敗', 'danger');
        }
    });
}

function copyShareLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showAlert('✅ 連結已複製到剪貼板', 'success');
    });
}

function deleteShare(shareId) {
    if (!confirm('確定要刪除此分享？')) return;
    
    $.ajax({
        url: `/api/share/${shareId}`,
        type: 'DELETE',
        success: function() {
            showAlert('✅ 分享已刪除', 'success');
            loadShareManagerContent();
        },
        error: function() {
            showAlert('❌ 刪除失敗', 'danger');
        }
    });
}

// 最小化區塊功能
function minimizeBlock(blockId, blockName) {
    const block = $(`#${blockId}`);
    block.hide();
    minimizedBlocks.add(blockId);
    
    // 添加到最小化容器
    const minimizedContainer = $('#minimized-blocks');
    const minimizedItem = $(`
        <div class="minimized-block" data-block="${blockId}" onclick="restoreBlock('${blockId}')">
            <i class="fas fa-window-restore"></i>
            <span>${blockName}</span>
        </div>
    `);
    
    minimizedContainer.append(minimizedItem);
    showAlert(`📦 已最小化: ${blockName}`, 'info');
}

function restoreBlock(blockId) {
    const block = $(`#${blockId}`);
    block.show();
    minimizedBlocks.delete(blockId);
    
    // 從最小化容器移除
    $(`.minimized-block[data-block="${blockId}"]`).remove();
    
    // 滾動到區塊
    $('html, body').animate({
        scrollTop: block.offset().top - 100
    }, 500);
}

// 檔案處理功能
function handleDroppedFiles(files) {
    console.log('📁 處理拖曳檔案:', files.length, '個');
    
    files.forEach(file => {
        // 上傳檔案到伺服器
        const formData = new FormData();
        formData.append('file', file);
        
        $.ajax({
            url: '/api/upload_file',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // 添加到拖曳檔案列表
                    droppedFiles.push({
                        name: file.name,
                        size: file.size,
                        lastModified: file.lastModified,
                        file: file,
                        virtualPath: response.virtual_path,
                        actualPath: response.file_path
                    });
                    
                    selectedFiles.push(response.virtual_path);
                    updateDroppedFilesList();
                    updateAnalysisCount();
                    updateSelectedCount();
                    
                    showAlert(`✅ 已添加檔案: ${file.name}`, 'success');
                } else {
                    showAlert(`❌ 上傳失敗: ${response.message}`, 'danger');
                }
            },
            error: function() {
                showAlert(`❌ 上傳檔案 ${file.name} 失敗`, 'danger');
            }
        });
    });
}

// 輔助函數
function uploadKeywords(file) {
    if (!file) {
        console.log('❌ 沒有選擇檔案');
        return;
    }
    
    console.log('📤 上傳關鍵字檔案:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    showAlert('📤 上傳中...', 'info');
    
    $.ajax({
        url: '/api/upload_keywords',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('📋 上傳回應:', response);
            if (response.success) {
                keywords = response.keywords;
                updateKeywordPreview();
                showAlert(`✅ ${response.message}`, 'success');
                playNotificationSound('success');
                updateAnalysisCount();
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 上傳失敗:', status, error);
            showAlert('❌ 上傳失敗', 'danger');
        }
    });
}

function updateKeywordPreview() {
    const preview = $('#keyword-preview');
    const modules = $('#keyword-modules');
    
    if (Object.keys(keywords).length === 0) {
        preview.hide();
        return;
    }
    
    modules.empty();
    for (const [module, keywordList] of Object.entries(keywords)) {
        const moduleElement = $(`
            <div class="keyword-module animate__animated animate__fadeIn" data-module="${module}">
                <span>${module}: ${keywordList.join(', ')}</span>
                <button class="delete-btn" onclick="deleteKeywordModule('${module}')" title="刪除此模組">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
        modules.append(moduleElement);
    }
    
    preview.show();
    console.log('📋 關鍵字預覽已更新');
}

function deleteKeywordModule(module) {
    if (confirm(`確定要刪除模組 "${module}" 嗎？`)) {
        $.ajax({
            url: `/api/keywords/delete/${encodeURIComponent(module)}`,
            type: 'DELETE',
            success: function(response) {
                if (response.success) {
                    delete keywords[module];
                    updateKeywordPreview();
                    showAlert(`✅ 已刪除模組: ${module}`, 'success');
                } else {
                    showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: function() {
                showAlert('❌ 刪除失敗', 'danger');
            }
        });
    }
}

function restoreKeywords() {
    if (confirm('確定要復原所有關鍵字模組嗎？')) {
        $.ajax({
            url: '/api/keywords/restore',
            type: 'POST',
            success: function(response) {
                if (response.success) {
                    keywords = response.keywords;
                    updateKeywordPreview();
                    showAlert(`✅ ${response.message}`, 'success');
                } else {
                    showAlert(`❌ ${response.message}`, 'danger');
                }
            },
            error: function() {
                showAlert('❌ 復原失敗', 'danger');
            }
        });
    }
}

function loadDirectory(path) {
    console.log('📂 載入目錄:', path);
    
    $('#file-list').html(`
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">載入中...</span>
            </div>
            <p class="mt-3 text-muted">載入檔案列表中...</p>
        </div>
    `);
    
    $.get('/api/browse', { path: path })
        .done(function(response) {
            console.log('📂 目錄載入回應:', response);
            
            if (response.error) {
                $('#file-list').html(`
                    <div class="text-center py-5">
                        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                        <p class="text-muted">${response.error}</p>
                        <button class="btn btn-primary" onclick="loadDirectory('${currentPath}')">重試</button>
                    </div>
                `);
                return;
            }
            
            currentPath = response.current_path;
            $('#path-input').val(currentPath);
            updateBreadcrumb();
            renderFileList(response.items);
        })
        .fail(function(xhr, status, error) {
            console.error('❌ 載入目錄失敗:', status, error);
            $('#file-list').html(`
                <div class="text-center py-5">
                    <i class="fas fa-wifi fa-3x text-danger mb-3"></i>
                    <p class="text-muted">載入失敗，請檢查網路連接</p>
                    <button class="btn btn-primary" onclick="loadDirectory('${currentPath}')">重試</button>
                </div>
            `);
        });
}

function renderFileList(items) {
    console.log('📋 渲染檔案列表:', items.length, '個項目');
    
    const fileList = $('#file-list');
    fileList.empty();
    
    if (items.length === 0) {
        fileList.html(`
            <div class="text-center py-5">
                <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                <p class="text-muted">此目錄為空</p>
            </div>
        `);
        return;
    }
    
    items.forEach(function(item, index) {
        const isSelected = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/')).includes(item.path);
        
        const fileItem = $(`
            <div class="file-item ${isSelected ? 'selected' : ''} animate__animated animate__fadeInUp" 
                 data-path="${item.path}" data-type="${item.type}" style="animation-delay: ${index * 0.05}s">
                <div class="d-flex align-items-center">
                    ${item.type === 'file' && !item.is_parent ? 
                        `<input type="checkbox" class="form-check-input me-3" ${isSelected ? 'checked' : ''}>` : 
                        '<div class="me-3" style="width: 16px;"></div>'
                    }
                    <div class="file-icon ${item.is_parent ? 'parent' : item.type === 'directory' ? 'directory' : 'log-file'}">
                        <i class="fas ${item.is_parent ? 'fa-arrow-left' : item.type === 'directory' ? 'fa-folder' : 'fa-file-alt'}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <small class="text-muted">
                            ${item.size ? item.size + ' • ' : ''}${item.modified}
                        </small>
                    </div>
                </div>
            </div>
        `);
        
        // 點擊事件
        fileItem.on('click', function(e) {
            console.log('👆 點擊項目:', item.name, item.type);
            
            if (item.type === 'directory') {
                loadDirectory(item.path);
            } else if (item.type === 'file' && !item.is_parent) {
                if (e.target.type !== 'checkbox') {
                    const checkbox = $(this).find('input[type="checkbox"]');
                    checkbox.prop('checked', !checkbox.prop('checked'));
                    checkbox.trigger('change');
                }
            }
        });
        
        // 檔案選擇事件
        const checkbox = fileItem.find('input[type="checkbox"]');
        checkbox.on('change', function(e) {
            e.stopPropagation();
            
            const path = item.path;
            const isChecked = $(this).is(':checked');
            
            console.log('☑️ 檔案選擇狀態改變:', path, isChecked);
            
            if (isChecked) {
                if (!selectedFiles.includes(path)) {
                    selectedFiles.push(path);
                }
                fileItem.addClass('selected');
            } else {
                selectedFiles = selectedFiles.filter(f => f !== path);
                fileItem.removeClass('selected');
            }
            
            updateSelectedCount();
        });
        
        fileList.append(fileItem);
    });
    
    console.log('✅ 檔案列表渲染完成');
}

function updateBreadcrumb() {
    const breadcrumb = $('#breadcrumb');
    const pathParts = currentPath.split('/').filter(part => part);
    
    breadcrumb.empty();
    
    // 根目錄
    const rootItem = $(`<li class="breadcrumb-item"><a href="#" onclick="loadDirectory('/')">根目錄</a></li>`);
    breadcrumb.append(rootItem);
    
    // 路徑部分
    let buildPath = '';
    pathParts.forEach((part, index) => {
        buildPath += '/' + part;
        const isLast = index === pathParts.length - 1;
        
        if (isLast) {
            breadcrumb.append(`<li class="breadcrumb-item active">${part}</li>`);
        } else {
            const pathToNavigate = buildPath;
            breadcrumb.append(`<li class="breadcrumb-item"><a href="#" onclick="loadDirectory('${pathToNavigate}')">${part}</a></li>`);
        }
    });
    
    console.log('🧭 面包屑導航已更新:', currentPath);
}

function navigateToPath() {
    const path = $('#path-input').val().trim();
    if (path) {
        console.log('🎯 導航到路徑:', path);
        loadDirectory(path);
    }
}

function refreshBrowser() {
    console.log('🔄 刷新瀏覽器');
    loadDirectory(currentPath);
}

function toggleSelectAll() {
    allSelectMode = !allSelectMode;
    console.log('🔄 切換全選模式:', allSelectMode);
    
    $('.file-item[data-type="file"]').each(function() {
        const checkbox = $(this).find('input[type="checkbox"]');
        const path = $(this).data('path');
        
        if (allSelectMode) {
            checkbox.prop('checked', true);
            $(this).addClass('selected');
            if (!selectedFiles.includes(path)) {
                selectedFiles.push(path);
            }
        } else {
            checkbox.prop('checked', false);
            $(this).removeClass('selected');
            selectedFiles = selectedFiles.filter(f => f !== path);
        }
    });
    
    updateSelectedCount();
    
    // 更新按鈕文字
    const btn = $('button[onclick="toggleSelectAll()"]');
    if (allSelectMode) {
        btn.html('<i class="fas fa-times me-1"></i>取消全選');
    } else {
        btn.html('<i class="fas fa-check-square me-1"></i>全選');
    }
}

function updateSelectedCount() {
    const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
    $('#selected-count').text(browserFiles.length);
    
    const analyzeBtn = $('#analyze-btn');
    const totalFiles = selectedFiles.length;
    
    if (totalFiles > 0 && Object.keys(keywords).length > 0) {
        analyzeBtn.prop('disabled', false);
    } else {
        analyzeBtn.prop('disabled', true);
    }
    
    updateAnalysisCount();
    
    console.log('📊 已選擇檔案數量:', totalFiles);
}

function updateDroppedFilesList() {
    const container = $('#dropped-files-container');
    const listElement = $('#dropped-files-list');
    
    if (droppedFiles.length === 0) {
        listElement.hide();
        return;
    }
    
    listElement.show();
    container.empty();
    
    droppedFiles.forEach((fileInfo, index) => {
        const fileElement = $(`
            <div class="dropped-file-item animate__animated animate__fadeInUp" data-index="${index}">
                <div class="d-flex align-items-center">
                    <div class="file-icon log-file me-3">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${fileInfo.name}</h6>
                        <small class="text-muted">
                            ${formatFileSize(fileInfo.size)} • 
                            ${new Date(fileInfo.lastModified).toLocaleString()}
                        </small>
                    </div>
                    <button class="btn btn-outline-danger btn-sm" onclick="removeDroppedFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `);
        
        container.append(fileElement);
    });
}

function removeDroppedFile(index) {
    const removedFile = droppedFiles[index];
    selectedFiles = selectedFiles.filter(f => f !== removedFile.virtualPath);
    
    droppedFiles.splice(index, 1);
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    
    showAlert('🗑️ 已移除檔案', 'info');
}

function clearDroppedFiles() {
    droppedFiles.forEach(fileInfo => {
        selectedFiles = selectedFiles.filter(f => f !== fileInfo.virtualPath);
    });
    
    droppedFiles = [];
    updateDroppedFilesList();
    updateAnalysisCount();
    updateSelectedCount();
    showAlert('🗑️ 已清空拖曳檔案列表', 'info');
}

function updateAnalysisCount() {
    const includeBrowser = $('#include-browser-files').is(':checked');
    const includeDropped = $('#include-dropped-files').is(':checked');
    
    const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
    const browserCount = includeBrowser ? browserFiles.length : 0;
    const droppedCount = includeDropped ? droppedFiles.length : 0;
    const totalCount = browserCount + droppedCount;
    
    $('#browser-files-count').text(browserCount);
    $('#dropped-files-count').text(droppedCount);
    $('#total-files-count').text(totalCount);
    
    const quickAnalyzeBtn = $('#quick-analyze-btn');
    const hasKeywords = Object.keys(keywords).length > 0;
    const hasFiles = totalCount > 0;
    
    quickAnalyzeBtn.prop('disabled', !hasKeywords || !hasFiles);
    
    if (!hasKeywords) {
        quickAnalyzeBtn.html('<i class="fas fa-exclamation-triangle me-2"></i>請先上傳關鍵字');
    } else if (!hasFiles) {
        quickAnalyzeBtn.html('<i class="fas fa-folder-open me-2"></i>請選擇檔案');
    } else {
        quickAnalyzeBtn.html(`<i class="fas fa-rocket me-2"></i>分析 ${totalCount} 個檔案`);
    }
}

function startQuickAnalysis() {
    console.log('⚡ 開始快速分析');
    
    const includeBrowser = $('#include-browser-files').is(':checked');
    const includeDropped = $('#include-dropped-files').is(':checked');
    
    let analysisFiles = [];
    
    if (includeBrowser) {
        const browserFiles = selectedFiles.filter(f => !f.startsWith('/tmp/uploaded/'));
        analysisFiles = analysisFiles.concat(browserFiles);
    }
    
    if (includeDropped) {
        const droppedPaths = droppedFiles.map(f => f.virtualPath);
        analysisFiles = analysisFiles.concat(droppedPaths);
    }
    
    if (analysisFiles.length === 0) {
        showAlert('⚠️ 請選擇要分析的檔案', 'warning');
        return;
    }
    
    const originalSelectedFiles = selectedFiles.slice();
    selectedFiles = analysisFiles;
    
    startStreamAnalysis();
    
    setTimeout(() => {
        selectedFiles = originalSelectedFiles;
    }, 1000);
}

function startStreamAnalysis() {
    console.log('🚀 開始流式分析');
    
    if (selectedFiles.length === 0) {
        showAlert('⚠️ 請選擇要分析的檔案', 'warning');
        return;
    }
    
    if (Object.keys(keywords).length === 0) {
        showAlert('⚠️ 請先上傳關鍵字清單', 'warning');
        return;
    }
    
    // 顯示結果區塊
    $('#results-block').show();
    
    // 確保統計區塊在結果區塊上方
    const statsBlock = $('#statistics-block');
    const resultsBlock = $('#results-block');
    resultsBlock.before(statsBlock);
    
    initializeStreamingAnalysis();
    
    // 啟動流式分析
    $.ajax({
        url: '/api/analyze_stream',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            files: selectedFiles
        }),
        success: function(response) {
            console.log('🎯 流式分析啟動:', response);
            if (response.success) {
                currentAnalysisId = response.analysis_id;
                startEventSource(response.analysis_id);
                showAlert('🚀 分析已開始，結果將即時顯示！', 'success');
                playNotificationSound('start');
                updateAnalysisButtonState('running');
            } else {
                showAlert(`❌ ${response.message}`, 'danger');
                updateAnalysisButtonState('idle');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 啟動分析失敗:', status, error);
            showAlert('❌ 啟動分析失敗，請檢查網路連接', 'danger');
            updateAnalysisButtonState('idle');
        }
    });
}

function initializeStreamingAnalysis() {
    const statsContainer = $('#result-stats');
    const detailsContainer = $('#detailed-results');
    
    // 顯示統計圖表
    $('#statistics-section').show();
    
    // 初始化統計區域
    statsContainer.html(`
        <div class="col-md-2">
            <div class="card bg-primary text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-file-alt me-2"></i>檔案</h5>
                    <h2 id="stat-files" class="counter-number">${selectedFiles.length}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card bg-success text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-cube me-2"></i>模組</h5>
                    <h2 id="stat-modules" class="counter-number">0/${Object.keys(keywords).length}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card bg-info text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-search me-2"></i>匹配</h5>
                    <h2 id="stat-matches" class="counter-number">0</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-warning text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-cogs me-2"></i>進度</h5>
                    <div class="progress progress-modern mb-2">
                        <div class="progress-bar progress-bar-animated" id="progress-bar" style="width: 0%"></div>
                    </div>
                    <small id="progress-text" class="progress-text">準備中...</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-secondary text-white stats-card">
                <div class="card-body text-center">
                    <h5><i class="fas fa-clock me-2"></i>狀態</h5>
                    <div id="analysis-status-display">
                        <div class="d-flex align-items-center justify-content-center">
                            <div class="spinner-border spinner-border-sm me-2" role="status" id="status-spinner"></div>
                            <span id="current-module-display">初始化中...</span>
                        </div>
                        <button class="btn btn-danger btn-sm mt-2" id="stop-analysis-inline" onclick="stopStreamAnalysis()">
                            <i class="fas fa-stop me-1"></i>停止分析
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    // 初始化結果區域
    detailsContainer.html(`
        <div id="stream-results" class="stream-results">
            <div class="analysis-starting animate__animated animate__fadeIn">
                <div class="text-center py-4">
                    <div class="d-flex align-items-center justify-content-center mb-3">
                        <div class="spinner-border text-primary me-3" role="status"></div>
                        <h5 class="mb-0">正在啟動分析引擎...</h5>
                    </div>
                    <p class="text-muted">結果將在下方即時顯示，您可以繼續操作其他功能</p>
                </div>
            </div>
        </div>
    `);
    
    // 滾動到結果區域
    $('html, body').animate({
        scrollTop: $('#results-block').offset().top - 50
    }, 300);
    
    // 初始化圖表
    initializeModuleChart();
}

function initializeModuleChart() {
    const ctx = document.getElementById('moduleChart');
    if (!ctx) return;
    
    moduleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '匹配數量',
                data: [],
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: '各模組匹配統計',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function updateAnalysisButtonState(state) {
    const analyzeBtn = $('#analyze-btn');
    
    switch (state) {
        case 'running':
            analyzeBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>分析進行中')
                      .removeClass('btn-danger-gradient')
                      .addClass('btn-warning')
                      .prop('disabled', false)
                      .attr('onclick', 'stopStreamAnalysis()');
            break;
        case 'stopping':
            analyzeBtn.html('<i class="fas fa-circle-notch fa-spin me-2"></i>正在停止')
                      .addClass('btn-secondary')
                      .prop('disabled', true);
            break;
        case 'idle':
        default:
            analyzeBtn.html('<i class="fas fa-stream me-2"></i>開始流式分析')
                      .removeClass('btn-warning btn-secondary')
                      .addClass('btn-danger-gradient')
                      .prop('disabled', selectedFiles.length === 0 || Object.keys(keywords).length === 0)
                      .attr('onclick', 'startStreamAnalysis()');
            break;
    }
}

function startEventSource(analysisId) {
    console.log('🌊 啟動 EventSource:', analysisId);
    
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    try {
        eventSource = new EventSource(`/api/analysis_stream/${analysisId}`);
        
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                setTimeout(() => {
                    handleStreamMessage(data);
                }, 0);
            } catch (e) {
                console.error('❌ 解析 SSE 訊息失敗:', e, event.data);
            }
        };
        
        eventSource.onerror = function(event) {
            console.error('❌ EventSource 錯誤:', event);
            if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
                console.log('🔌 EventSource 連接已關閉');
                eventSource = null;
            }
        };
        
        eventSource.onopen = function(event) {
            console.log('✅ EventSource 連接已建立');
        };
        
    } catch (e) {
        console.error('❌ 建立 EventSource 失敗:', e);
        showAlert('❌ 建立即時連接失敗', 'danger');
    }
}

function handleStreamMessage(data) {
    try {
        console.log('📩 收到流式訊息:', data.type);
        
        switch (data.type) {
            case 'heartbeat':
                break;
                
            case 'start':
                updateProgressStatus('🚀 分析開始', '正在初始化...');
                $('.analysis-starting').remove();
                break;
                
            case 'module_start':
                updateProgressStatus(`🔍 分析模組: ${data.module}`, '準備搜尋關鍵字...');
                break;
                
            case 'file_start':
                updateProgressStatus(`📂 分析檔案: ${data.module}`, `正在處理: ${data.file.split('/').pop()}`);
                break;
                
            case 'matches_found':
                handleMatchesFound(data);
                break;
                
            case 'progress':
                updateProgress(data.progress);
                break;
                
            case 'module_complete':
                updateModuleComplete(data);
                break;
                
            case 'complete':
                handleAnalysisComplete(data);
                break;
                
            case 'error':
            case 'timeout':
                handleAnalysisError(data);
                break;
                
            default:
                console.log('🤔 未知訊息類型:', data.type);
        }
    } catch (e) {
        console.error('❌ 處理流式訊息時發生錯誤:', e, data);
    }
}

let moduleResults = {};

function handleMatchesFound(data) {
    try {
        console.log('🎯 發現匹配 - 模組:', data.module, '檔案:', data.file.split('/').pop(), '匹配數:', data.matches.length);
        
        // 初始化模組結果
        if (!moduleResults[data.module]) {
            moduleResults[data.module] = {
                total_matches: 0,
                files: {}
            };
        }
        
        // 儲存匹配結果
        if (!moduleResults[data.module].files[data.file]) {
            moduleResults[data.module].files[data.file] = [];
        }
        moduleResults[data.module].files[data.file] = moduleResults[data.module].files[data.file].concat(data.matches);
        moduleResults[data.module].total_matches = data.total_matches;
        
        // 更新統計
        updateStatsLightweight(data.total_matches);
        
        // 更新圖表
        updateModuleChart(data.module, data.total_matches);
        
        // 更新結果顯示
        updateStreamResults();
        
    } catch (e) {
        console.error('❌ 處理匹配結果時發生錯誤:', e);
    }
}

function updateProgressStatus(title, message) {
    $('#current-module-display').html(`<strong>${title}</strong><br><small>${message}</small>`);
}

function updateProgress(progress) {
    $('#progress-bar').css('width', progress + '%');
    $('#progress-text').text(`進度: ${progress}%`);
}

function updateStatsLightweight(totalMatches) {
    $('#stat-matches').text(totalMatches);
    $('#total-matches-chart').text(totalMatches);
}

function updateModuleChart(module, matches) {
    if (!moduleChart) return;
    
    const labels = moduleChart.data.labels;
    const data = moduleChart.data.datasets[0].data;
    
    const index = labels.indexOf(module);
    if (index === -1) {
        labels.push(module);
        data.push(matches);
    } else {
        data[index] = matches;
    }
    
    moduleChart.update();
    
    // 更新統計摘要
    $('#total-modules').text(labels.length);
}

function updateStreamResults() {
    const resultsContainer = $('#stream-results');
    let html = '';
    
    // 根據當前檢視模式顯示結果
    if (currentViewMode === 'module') {
        html = generateModuleViewHTML();
    } else {
        html = generateFileViewHTML();
    }
    
    resultsContainer.html(html);
}

function generateModuleViewHTML() {
    let html = '<div class="module-view">';
    
    for (const [module, data] of Object.entries(moduleResults)) {
        if (data.total_matches === 0) continue;
        
        html += `
            <div class="module-result-card animate__animated animate__fadeIn">
                <div class="module-header">
                    <h5 class="mb-0">
                        <i class="fas fa-cube text-primary me-2"></i>${module}
                        <span class="badge bg-primary float-end">${data.total_matches} 匹配</span>
                    </h5>
                </div>
                <div class="module-body">
        `;
        
        for (const [file, matches] of Object.entries(data.files)) {
            const fileName = file.split('/').pop();
            html += `
                <div class="file-matches mb-3">
                    <h6 class="text-muted">
                        <i class="fas fa-file-alt me-2"></i>${fileName}
                        <small class="text-muted">(${matches.length} 匹配)</small>
                    </h6>
                    <div class="matches-list">
            `;
            
            matches.slice(0, 5).forEach(match => {
                html += `
                    <div class="match-item">
                        <span class="line-number">行 ${match.line_number}:</span>
                        <span class="match-content">${escapeHtml(match.content)}</span>
                        <span class="keyword-tag">${match.keyword}</span>
                    </div>
                `;
            });
            
            if (matches.length > 5) {
                html += `<div class="text-muted">...還有 ${matches.length - 5} 個匹配</div>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function generateFileViewHTML() {
    let html = '<div class="file-view">';
    
    // 按檔案組織結果
    const fileMap = {};
    for (const [module, data] of Object.entries(moduleResults)) {
        for (const [file, matches] of Object.entries(data.files)) {
            if (!fileMap[file]) {
                fileMap[file] = {};
            }
            fileMap[file][module] = matches;
        }
    }
    
    for (const [file, modules] of Object.entries(fileMap)) {
        const fileName = file.split('/').pop();
        const totalMatches = Object.values(modules).reduce((sum, matches) => sum + matches.length, 0);
        
        html += `
            <div class="file-result-card animate__animated animate__fadeIn">
                <div class="file-header">
                    <h5 class="mb-0">
                        <i class="fas fa-file-alt text-info me-2"></i>${fileName}
                        <span class="badge bg-info float-end">${totalMatches} 匹配</span>
                    </h5>
                </div>
                <div class="file-body">
        `;
        
        for (const [module, matches] of Object.entries(modules)) {
            html += `
                <div class="module-matches mb-3">
                    <h6 class="text-primary">
                        <i class="fas fa-cube me-2"></i>${module}
                        <small class="text-muted">(${matches.length} 匹配)</small>
                    </h6>
                    <div class="matches-list">
            `;
            
            matches.slice(0, 3).forEach(match => {
                html += `
                    <div class="match-item">
                        <span class="line-number">行 ${match.line_number}:</span>
                        <span class="match-content">${escapeHtml(match.content)}</span>
                        <span class="keyword-tag">${match.keyword}</span>
                    </div>
                `;
            });
            
            if (matches.length > 3) {
                html += `<div class="text-muted">...還有 ${matches.length - 3} 個匹配</div>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function updateModuleComplete(data) {
    const completedModules = Object.keys(moduleResults).length;
    const totalModules = Object.keys(keywords).length;
    $('#stat-modules').text(`${completedModules}/${totalModules}`);
    
    showAlert(`✅ 模組 "${data.module}" 分析完成，找到 ${data.total_matches} 個匹配`, 'success');
}

function handleAnalysisComplete(data) {
    updateAnalysisButtonState('idle');
    $('#status-spinner').hide();
    $('#current-module-display').html('<span class="text-success"><i class="fas fa-check-circle me-2"></i>分析完成</span>');
    $('#stop-analysis-inline').hide();
    
    showAlert(`🎉 分析完成！總計找到 ${data.total_matches} 個匹配，耗時 ${data.total_time.toFixed(2)} 秒`, 'success');
    playNotificationSound('complete');
    
    // 更新統計
    $('#total-files-chart').text(selectedFiles.length);
    
    // 關閉 EventSource
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

function handleAnalysisError(data) {
    updateAnalysisButtonState('idle');
    $('#status-spinner').hide();
    $('#current-module-display').html('<span class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>分析失敗</span>');
    $('#stop-analysis-inline').hide();
    
    showAlert(`❌ ${data.message || '分析過程發生錯誤'}`, 'danger');
    playNotificationSound('error');
    
    // 關閉 EventSource
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

function stopStreamAnalysis() {
    if (!currentAnalysisId) return;
    
    updateAnalysisButtonState('stopping');
    
    // 關閉 EventSource
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // 發送停止請求
    $.ajax({
        url: `/api/stop_analysis/${currentAnalysisId}`,
        type: 'POST',
        success: function() {
            showAlert('⏹️ 分析已停止', 'warning');
            updateAnalysisButtonState('idle');
            currentAnalysisId = null;
        },
        error: function() {
            showAlert('❌ 停止分析失敗', 'danger');
            updateAnalysisButtonState('idle');
        }
    });
}

function toggleViewMode() {
    currentViewMode = currentViewMode === 'module' ? 'file' : 'module';
    updateStreamResults();
    
    const btn = $('#view-mode-btn');
    if (currentViewMode === 'module') {
        btn.html('<i class="fas fa-exchange-alt me-1"></i>切換到檔案檢視');
    } else {
        btn.html('<i class="fas fa-exchange-alt me-1"></i>切換到模組檢視');
    }
}

function exportResults() {
    if (!currentAnalysisId) {
        showAlert('❌ 沒有可匯出的結果', 'warning');
        return;
    }
    
    window.open(`/api/export_results/${currentAnalysisId}`, '_blank');
}

function generateReport() {
    if (!currentAnalysisId) {
        showAlert('❌ 沒有可生成報告的結果', 'warning');
        return;
    }
    
    window.open(`/analysis_report/${currentAnalysisId}`, '_blank');
}

// 工具函數
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showAlert(message, type = 'info') {
    const alertId = 'alert-' + Date.now();
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show animate__animated animate__fadeInDown" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('#alert-container').prepend(alertHtml);
    
    // 5秒後自動關閉
    setTimeout(() => {
        $(`#${alertId}`).fadeOut(() => {
            $(`#${alertId}`).remove();
        });
    }, 5000);
}

function showNotification(message) {
    // 瀏覽器通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Enhanced Log 分析平台', {
            body: message,
            icon: '/favicon.ico'
        });
    }
    
    // 頁面內通知
    showAlert(message, 'info');
}

function playNotificationSound(type) {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch (type) {
            case 'success':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;
                break;
            case 'error':
                oscillator.frequency.value = 300;
                gainNode.gain.value = 0.2;
                break;
            case 'start':
                oscillator.frequency.value = 600;
                gainNode.gain.value = 0.1;
                break;
            case 'complete':
                oscillator.frequency.value = 1000;
                gainNode.gain.value = 0.1;
                break;
            case 'broadcast':
                oscillator.frequency.value = 900;
                gainNode.gain.value = 0.15;
                break;
            default:
                oscillator.frequency.value = 500;
                gainNode.gain.value = 0.1;
        }
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
    } catch (e) {
        console.log('播放音效失敗:', e);
    }
}

function scrollToTop() {
    $('html, body').animate({ scrollTop: 0 }, 300);
}

// 初始化通知權限
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// 載入已儲存的佈局
$(document).ready(function() {
    loadDashboardLayout();
});