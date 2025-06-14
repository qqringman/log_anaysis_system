// Enhanced Log 分析平台 v6 - 聊天管理器
// static/js/managers/chat-manager.js

window.chatManager = {
    init: function() {
        console.log('💬 初始化聊天管理器');
        
        // 設置聊天事件監聽器
        this.setupEventListeners();
    },
    
    // 初始化 Socket.IO
    initSocketIO: function() {
        console.log('🔌 初始化 Socket.IO 連接');
        
        try {
            // 創建 Socket.IO 連接
            appConfig.state.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });
            
            const socket = appConfig.state.socket;
            
            // 連接事件
            socket.on('connect', () => {
                console.log('✅ Socket.IO 連接成功');
                socket.emit('set_username', { username: appConfig.state.userName });
                utils.showAlert('✅ 已連接到聊天服務器', 'success', 2000);
            });
            
            // 斷開連接事件
            socket.on('disconnect', (reason) => {
                console.log('❌ Socket.IO 連接斷開:', reason);
                utils.showAlert('❌ 與聊天服務器的連接已斷開', 'warning');
            });
            
            // 重新連接事件
            socket.on('reconnect', (attemptNumber) => {
                console.log('🔄 Socket.IO 重新連接成功，嘗試次數:', attemptNumber);
                utils.showAlert('✅ 已重新連接到聊天服務器', 'success', 2000);
            });
            
            // 用戶連接事件
            socket.on('user_connected', (data) => {
                console.log('👤 用戶連接:', data);
                appConfig.state.onlineUsers = data.online_users || [];
                this.updateOnlineUsersList();
            });
            
            // 用戶斷開事件
            socket.on('user_disconnected', (data) => {
                console.log('👤 用戶斷開:', data);
                appConfig.state.onlineUsers = data.online_users || [];
                this.updateOnlineUsersList();
            });
            
            // 用戶列表更新
            socket.on('user_list_updated', (data) => {
                appConfig.state.onlineUsers = data.online_users || [];
                this.updateOnlineUsersList();
            });
            
            // 加入聊天室成功
            socket.on('joined_room', (data) => {
                appConfig.state.currentRoom = data.room_id;
                this.loadChatHistory(data.history);
                this.updateRoomUsers(data.room_users);
                $('#current-room-name').text(`聊天室: ${data.room_id}`);
                $('#chat-area').show();
                utils.showAlert(`✅ 已加入聊天室`, 'success', 2000);
            });
            
            // 新訊息
            socket.on('new_message', (data) => {
                this.displayChatMessage(data);
                
                // 如果不是自己的訊息，播放通知音
                if (data.user_name !== appConfig.state.userName) {
                    utils.playNotificationSound('notification');
                    
                    // 如果被提及，顯示通知
                    if (data.mentioned_users && data.mentioned_users.includes(appConfig.state.userName)) {
                        utils.showNotification(`${data.user_name} 提及了您: ${data.message}`);
                    }
                }
            });
            
            // 被提及通知
            socket.on('mentioned', (data) => {
                utils.showNotification(`${data.by} 在 ${data.room_id} 提及了您: ${data.message}`);
                utils.playNotificationSound('notification');
            });
            
            // 用戶加入聊天室
            socket.on('user_joined_room', (data) => {
                this.displaySystemMessage(`${data.user_name} 加入了聊天室`);
                this.updateRoomUsers(data.room_users);
            });
            
            // 用戶離開聊天室
            socket.on('user_left_room', (data) => {
                this.displaySystemMessage(`${data.user_name} 離開了聊天室`);
                this.updateRoomUsers(data.room_users);
            });
            
            // 廣播訊息
            socket.on('broadcast', (data) => {
                broadcastManager.showBroadcastMessage(data);
            });
            
            // 新聊天室
            socket.on('new_room_available', (data) => {
                utils.showAlert(`🏠 新聊天室: ${data.name} (創建者: ${data.created_by})`, 'info');
                this.loadRoomList();
            });
            
            // 聊天室創建成功
            socket.on('room_created', (data) => {
                $('#chatModal').modal('hide');
                utils.showAlert(`✅ 聊天室 "${data.name}" 創建成功！`, 'success');
                setTimeout(() => {
                    this.joinRoom(data.room_id);
                    this.openChat();
                }, 500);
            });
            
            // 新投票
            socket.on('new_poll', (data) => {
                this.displayPoll(data);
            });
            
            // 投票更新
            socket.on('poll_updated', (data) => {
                this.updatePollResults(data);
            });
            
            // 新轉盤
            socket.on('new_wheel', (data) => {
                appConfig.state.luckyWheels[data.wheel_id] = data;
                utils.showAlert(`🎰 ${data.created_by} 創建了新轉盤: ${data.name}`, 'info');
            });
            
            // 轉盤結果
            socket.on('wheel_result', (data) => {
                this.displayWheelResult(data);
            });
            
        } catch (e) {
            console.error('⚠️ Socket.IO 初始化失敗:', e);
            utils.showAlert('❌ 聊天功能初始化失敗', 'danger');
        }
    },
    
    // 開啟聊天室
    openChat: function() {
        // 檢查是否有聊天室名稱
        if (!this.chatUserName) {
            // 顯示聊天室登入對話框
            $('#chatLoginModal').modal('show');
            $('#chatUsername').focus();
            
            // Enter 鍵提交
            $('#chatUsername').off('keypress').on('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmChatLogin();
                }
            });
            return;
        }
        
        // 已登入，開啟聊天室
        const modal = new bootstrap.Modal(document.getElementById('chatModal'));
        modal.show();
        this.loadRoomList();
        this.updateOnlineUsersList();
        
        // 顯示或隱藏管理功能
        this.updateAdminUI();
        
        // 如果還沒有加入任何聊天室，自動加入預設聊天室
        if (!appConfig.state.currentRoom) {
            setTimeout(() => {
                this.joinRoom('general');
            }, 500);
        }
    },

    // 確認聊天室登入
    confirmChatLogin: function() {
        const username = $('#chatUsername').val().trim();
        
        if (!username) {
            utils.showAlert('請輸入您的名稱', 'warning');
            return;
        }
        
        this.chatUserName = username;
        this.isAdmin = (username === 'vince_lin');
        
        // 關閉登入對話框
        $('#chatLoginModal').modal('hide');
        
        // 更新全域用戶名稱為聊天室用戶名稱
        if (appConfig.state.socket) {
            appConfig.state.socket.emit('update_chat_username', { username: username });
        }
        
        // 開啟聊天室
        setTimeout(() => {
            this.openChat();
        }, 300);
    },
    
    // 更新管理員UI
    updateAdminUI: function() {
        if (this.isAdmin) {
            // 顯示管理功能按鈕
            $('.admin-only').show();
            $('#room-manager-btn').show();
        } else {
            // 隱藏管理功能按鈕
            $('.admin-only').hide();
            $('#room-manager-btn').hide();
        }
    },
    
    // 載入聊天室列表
    loadRoomList: function() {
        $.get(appConfig.api.rooms, (rooms) => {
            const roomList = $('#room-list');
            roomList.empty();
            
            rooms.forEach(room => {
                const isActive = room.id === appConfig.state.currentRoom;
                const roomItem = $(`
                    <div class="user-item ${isActive ? 'active bg-primary text-white' : ''}" 
                         onclick="chatManager.joinRoom('${room.id}')"
                         title="${room.description}">
                        <i class="fas fa-door-open me-2"></i>${room.name}
                        <small class="d-block ${isActive ? 'text-white-50' : 'text-muted'}">${room.description}</small>
                    </div>
                `);
                roomList.append(roomItem);
            });
            
            appConfig.state.chatRooms = rooms;
        }).fail(() => {
            utils.showAlert('❌ 載入聊天室列表失敗', 'danger');
        });
    },
    
    // 更新線上用戶列表
    updateOnlineUsersList: function() {
        const usersList = $('#online-users-list');
        usersList.empty();
        
        appConfig.state.onlineUsers.forEach(user => {
            const isCurrentUser = user.name === appConfig.state.userName;
            const userItem = $(`
                <div class="user-item online ${isCurrentUser ? 'fw-bold' : ''}" 
                     onclick="${isCurrentUser ? '' : `chatManager.mentionUser('${user.name}')`}"
                     title="${isCurrentUser ? '您' : '點擊 @ 此用戶'}">
                    ${user.name} ${isCurrentUser ? '(您)' : ''}
                </div>
            `);
            usersList.append(userItem);
        });
    },
    
    // 更新聊天室用戶
    updateRoomUsers: function(roomUsers) {
        console.log('聊天室用戶:', roomUsers);
        // 可以在這裡更新聊天室內的用戶顯示
    },
    
    // 加入聊天室
    joinRoom: function(roomId) {
        if (!appConfig.state.socket) {
            utils.showAlert('❌ 聊天連接尚未建立', 'danger');
            return;
        }
        
        console.log('🏠 加入聊天室:', roomId);
        appConfig.state.socket.emit('join_room', { room_id: roomId });
    },
    
    // 創建新聊天室
    createNewRoom: function() {
        const name = prompt('請輸入聊天室名稱:');
        if (!name || !name.trim()) return;
        
        const description = prompt('請輸入聊天室描述 (可選):') || '';
        
        if (!appConfig.state.socket) {
            utils.showAlert('❌ 聊天連接尚未建立', 'danger');
            return;
        }
        
        appConfig.state.socket.emit('create_room', {
            name: name.trim(),
            description: description.trim(),
            is_public: true
        });
    },
    
    // 載入聊天記錄
    loadChatHistory: function(history) {
        const messagesContainer = $('#chat-messages');
        messagesContainer.empty();
        
        if (!history || history.length === 0) {
            messagesContainer.html(`
                <div class="text-center text-muted p-5">
                    <i class="fas fa-comments fa-3x mb-3"></i>
                    <p>暫無聊天記錄，開始聊天吧！</p>
                </div>
            `);
            return;
        }
        
        history.forEach(msg => {
            this.displayChatMessage(msg, false);
        });
        
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    },
    
    // 發送訊息
    sendMessage: function() {
        const input = $('#chat-input');
        const message = input.val().trim();
        
        if (!message) return;
        
        if (!appConfig.state.currentRoom) {
            utils.showAlert('❌ 請先選擇聊天室', 'danger');
            return;
        }
        
        if (!appConfig.state.socket) {
            utils.showAlert('❌ 聊天連接尚未建立', 'danger');
            return;
        }
        
        appConfig.state.socket.emit('send_message', {
            room_id: appConfig.state.currentRoom,
            message: message,
            message_type: 'text'
        });
        
        input.val('');
    },
    
    // 顯示聊天訊息
    displayChatMessage: function(data, scrollToBottom = true) {
        const messagesContainer = $('#chat-messages');
        
        // 移除空白提示
        messagesContainer.find('.text-center').remove();
        
        const isCurrentUser = data.user_name === appConfig.state.userName;
        const isMention = data.mentioned_users && data.mentioned_users.includes(appConfig.state.userName);
        
        const messageElement = $(`
            <div class="chat-message ${isMention ? 'mention' : ''} ${isCurrentUser ? 'text-end' : ''} animate__animated animate__fadeIn">
                <div class="user-name">${data.user_name}</div>
                <div class="timestamp">${this.formatTimestamp(data.timestamp)}</div>
                <div class="message-content">${this.formatMessage(data.message)}</div>
                ${data.message_type === 'file' ? this.formatFileMessage(data) : ''}
            </div>
        `);
        
        messagesContainer.append(messageElement);
        
        if (scrollToBottom) {
            messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
        }
    },
    
    // 顯示系統訊息
    displaySystemMessage: function(message) {
        const messagesContainer = $('#chat-messages');
        const messageElement = $(`
            <div class="text-center text-muted small my-2 animate__animated animate__fadeIn">
                <i class="fas fa-info-circle me-1"></i>${message}
            </div>
        `);
        messagesContainer.append(messageElement);
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    },
    
    // 格式化訊息
    formatMessage: function(message) {
        // 格式化 @ 提及
        message = message.replace(/@(\w+)/g, '<span class="badge bg-primary">@$1</span>');
        
        // 格式化連結
        message = message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        // 格式化 JIRA 連結
        message = message.replace(/([A-Z]+-\d+)/g, '<a href="https://jira.example.com/browse/$1" target="_blank" rel="noopener">$1</a>');
        
        return message;
    },
    
    // 格式化檔案訊息
    formatFileMessage: function(data) {
        if (data.message_type === 'image') {
            return `<img src="${data.file_url}" class="img-fluid mt-2" style="max-width: 300px;">`;
        }
        
        return `
            <div class="mt-2">
                <a href="${data.file_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="fas ${utils.getFileIcon(data.file_name)} me-1"></i>
                    ${data.file_name}
                </a>
            </div>
        `;
    },
    
    // 格式化時間戳
    formatTimestamp: function(timestamp) {
        if (!timestamp) return '';
        return utils.formatTime(timestamp);
    },
    
    // 提及用戶
    mentionUser: function(username) {
        const input = $('#chat-input');
        const currentText = input.val();
        const newText = currentText + (currentText ? ' ' : '') + '@' + username + ' ';
        input.val(newText);
        input.focus();
    },
    
    // 上傳檔案
    uploadChatFile: function() {
        const input = $('<input type="file" accept="image/*,.pdf,.doc,.docx,.txt">');
        input.on('change', function() {
            const file = this.files[0];
            if (!file) return;
            
            if (file.size > appConfig.defaults.maxFileSize) {
                utils.showAlert('❌ 檔案大小不能超過 100MB', 'danger');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                if (appConfig.state.socket && appConfig.state.currentRoom) {
                    appConfig.state.socket.emit('upload_file', {
                        room_id: appConfig.state.currentRoom,
                        file_data: e.target.result,
                        file_name: file.name,
                        file_type: chatManager.getFileType(file.name)
                    });
                    
                    utils.showAlert('📤 檔案上傳中...', 'info', 2000);
                }
            };
            reader.readAsDataURL(file);
        });
        input.click();
    },
    
    // 取得檔案類型
    getFileType: function(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
        return 'file';
    },
    
    // 創建投票
    createPoll: function() {
        const question = prompt('請輸入投票問題:');
        if (!question) return;
        
        const options = [];
        for (let i = 0; i < 4; i++) {
            const option = prompt(`請輸入選項 ${i + 1} (留空結束):`);
            if (!option) break;
            options.push(option);
        }
        
        if (options.length < 2) {
            utils.showAlert('❌ 投票至少需要2個選項', 'danger');
            return;
        }
        
        if (appConfig.state.socket && appConfig.state.currentRoom) {
            appConfig.state.socket.emit('create_poll', {
                room_id: appConfig.state.currentRoom,
                question: question,
                options: options,
                duration: 300 // 5分鐘
            });
        }
    },
    
    // 顯示投票
    displayPoll: function(data) {
        const messagesContainer = $('#chat-messages');
        const pollElement = $(`
            <div class="poll-container animate__animated animate__fadeIn" id="poll-${data.poll_id}">
                <h6>${data.question}</h6>
                <div class="poll-options">
                    ${data.options.map((option, index) => `
                        <div class="poll-option" onclick="chatManager.votePoll('${data.poll_id}', ${index})">
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
        
        appConfig.state.polls[data.poll_id] = data;
    },
    
    // 投票
    votePoll: function(pollId, optionIndex) {
        if (appConfig.state.socket) {
            appConfig.state.socket.emit('vote_poll', {
                poll_id: pollId,
                option_index: optionIndex
            });
        }
    },
    
    // 更新投票結果
    updatePollResults: function(data) {
        const pollElement = $(`#poll-${data.poll_id}`);
        if (!pollElement.length) return;
        
        const totalVotes = data.total_votes || 1;
        
        Object.entries(data.votes).forEach(([index, count]) => {
            const option = pollElement.find('.poll-option').eq(index);
            const percentage = (count / totalVotes * 100).toFixed(1);
            
            option.find('.vote-bar').css('width', percentage + '%');
            option.find('.vote-count').text(count);
        });
    },
    
    // 使用幸運轉盤
    useLuckyWheel: function() {
        if (!appConfig.state.currentRoom) {
            utils.showAlert('❌ 請先加入聊天室', 'danger');
            return;
        }
        
        wheelManager.showWheelSelector(true);
    },
    
    // 顯示轉盤結果
    displayWheelResult: function(data) {
        this.displaySystemMessage(`🎰 ${data.user_name} 轉動了轉盤，結果是: ${data.result}`);
        utils.playNotificationSound('success');
    },
    
    // 設置事件監聽器
    setupEventListeners: function() {
        // 聊天輸入框 Enter 鍵發送
        $('#chat-input').on('keypress', function(e) {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                chatManager.sendMessage();
            }
        });
        
        // 發送按鈕
        $(document).on('click', '#send-message-btn', function() {
            chatManager.sendMessage();
        });
        
        // @ 提及自動完成
        $('#chat-input').on('input', function() {
            const text = $(this).val();
            const lastAtIndex = text.lastIndexOf('@');
            
            if (lastAtIndex >= 0 && lastAtIndex === text.length - 1) {
                // 顯示用戶列表提示
                chatManager.showUserSuggestions();
            }
        });
    },
    
    // 顯示用戶建議
    showUserSuggestions: function() {
        // 可以實現一個自動完成的下拉選單
        console.log('顯示用戶建議');
    }
};