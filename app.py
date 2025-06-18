#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, abort, redirect, url_for, session
import os
import csv
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import threading
import uuid
import time
import json
import queue
import re
from io import StringIO
import tempfile
import zipfile
import tarfile
import gzip
import py7zr
from collections import defaultdict
import sqlite3
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms, send
import base64
import secrets
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=10e6)

# 全域變數
analysis_status = {}
analysis_streams = {}
user_comments = {}
chat_rooms = {}
online_users = {}
shared_results = {}
lucky_wheels = {}
polls = {}
file_comments = {}  # 新增：檔案評論
uploads_dir = os.path.join('uploads', 'chat')
comments_dir = os.path.join('uploads', 'comments')
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(comments_dir, exist_ok=True)

# FastGrep 配置
config = {
    'keywords': {},
    'original_keywords': {},
    'fastgrep_settings': {
        'threads': 4,
        'use_mmap': True,
        'context_lines': 0,
        'timeout': 120
    }
}

# 初始化資料庫
def init_database():
    """初始化 SQLite 資料庫"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    # 聊天室表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            is_public INTEGER DEFAULT 1
        )
    ''')
    
    # 聊天訊息表 - 增加更多欄位
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            user_name TEXT,
            message TEXT,
            message_type TEXT DEFAULT 'text',
            file_path TEXT,
            file_name TEXT,
            file_size INTEGER,
            mentioned_users TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
        )
    ''')
    
    # 投票表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS polls (
            id TEXT PRIMARY KEY,
            room_id TEXT,
            question TEXT,
            options TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ends_at DATETIME,
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
        )
    ''')
    
    # 投票結果表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS poll_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id TEXT,
            user_name TEXT,
            option_index INTEGER,
            voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (poll_id) REFERENCES polls (id)
        )
    ''')
    
    # 幸運轉盤表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lucky_wheels (
            id TEXT PRIMARY KEY,
            room_id TEXT,
            name TEXT,
            options TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
        )
    ''')
    
    # 分享結果表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shared_results (
            id TEXT PRIMARY KEY,
            analysis_id TEXT,
            share_token TEXT UNIQUE,
            is_public INTEGER DEFAULT 0,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            view_count INTEGER DEFAULT 0
        )
    ''')
    
    # 聊天室資源表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS room_resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            resource_type TEXT,
            resource_url TEXT,
            resource_name TEXT,
            uploaded_by TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
        )
    ''')
    
    # 創建預設聊天室
    cursor.execute('''
        INSERT OR IGNORE INTO chat_rooms (id, name, description, created_by)
        VALUES 
        ('general', '一般討論', '歡迎大家在這裡自由討論', 'system'),
        ('analysis', '分析討論', '討論日誌分析相關問題', 'system'),
        ('tech', '技術支援', '技術問題與解答', 'system')
    ''')
    
    # 用戶評論表 - 添加 parent_comment_id 欄位
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_comments (
            id TEXT PRIMARY KEY,
            analysis_id TEXT,
            module_name TEXT,
            file_path TEXT,
            comment TEXT,
            topic TEXT DEFAULT '一般討論',
            author TEXT,
            parent_comment_id TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_comment_id) REFERENCES user_comments (id)
        )
    ''')
    
    # 檢查現有表格是否有 parent_comment_id 欄位，如果沒有則添加
    cursor.execute("PRAGMA table_info(user_comments)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'parent_comment_id' not in columns:
        cursor.execute('ALTER TABLE user_comments ADD COLUMN parent_comment_id TEXT')
    
    if 'topic' not in columns:
        cursor.execute('ALTER TABLE user_comments ADD COLUMN topic TEXT DEFAULT "一般討論"')
    
    if 'author' not in columns:
        cursor.execute('ALTER TABLE user_comments ADD COLUMN author TEXT')
    
    conn.commit()
    conn.close()

def check_fastgrep_available():
    """檢查 grep 命令是否可用"""
    try:
        result = subprocess.run(['grep', '--version'], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def build_search_command(keyword, file_path, settings=None):
    """建立搜尋命令 - 使用標準 grep"""
    if settings is None:
        settings = config['fastgrep_settings']
    
    # 使用標準 grep
    cmd = ['grep']
    cmd.extend(['-n'])          # 顯示行號
    cmd.extend(['-i'])          # 忽略大小寫
    cmd.extend(['-F'])          # 固定字串搜尋
    cmd.append(keyword)         # 不使用引號包裹
    cmd.append(file_path)
    
    return cmd

def parse_search_output(output_lines, keyword, file_path):
    """解析搜尋輸出"""
    matches = []
    
    for line in output_lines:
        if not line.strip():
            continue
            
        # 輸出格式: line_number:content
        if ':' in line:
            first_colon = line.find(':')
            if first_colon > 0:
                line_number_str = line[:first_colon]
                content = line[first_colon + 1:] if first_colon + 1 < len(line) else ""
                
                try:
                    line_number = int(line_number_str)
                    if content.strip():
                        matches.append({
                            'filename': file_path,
                            'line_number': line_number,
                            'content': content.strip(),
                            'keyword': keyword
                        })
                except ValueError:
                    continue
    
    return matches

def search_streaming(analysis_id, file_paths, keywords):
    """流式搜尋 - 修復版本"""
    try:
        status = analysis_status[analysis_id]
        stream_queue = analysis_streams[analysis_id]
        
        status['status'] = 'running'
        
        settings = config['fastgrep_settings']
        timeout = settings.get('timeout', 120)
        
        # 初始化結果結構
        for module in keywords.keys():
            status['results'][module] = {
                'total_matches': 0,
                'files': {},
                'keywords_found': [],
                'search_time': 0,
                'errors': [],
                'processed_files': 0,
                'total_files': len(file_paths)
            }
        
        total_operations = len(file_paths) * sum(len(keyword_list) for keyword_list in keywords.values())
        completed_operations = 0
        
        # 發送開始訊息
        stream_queue.put({
            'type': 'start',
            'message': '開始分析...',
            'total_files': len(file_paths),
            'total_modules': len(keywords)
        })
        
        print(f"開始分析 {len(file_paths)} 個檔案，{len(keywords)} 個模組")

        for module, keyword_list in keywords.items():
            status['current_module'] = module
            module_start_time = datetime.now()
            
            # 發送模組開始訊息
            stream_queue.put({
                'type': 'module_start',
                'module': module,
                'keywords': keyword_list
            })
            
            print(f"開始分析模組: {module}, 關鍵字: {keyword_list}")

            # 為每個檔案分別執行搜尋
            for file_path in file_paths:
                status['current_file'] = os.path.basename(file_path)
                
                # 發送檔案開始訊息
                stream_queue.put({
                    'type': 'file_start',
                    'module': module,
                    'file': file_path
                })

                # 處理上傳的檔案路徑
                actual_file_path = file_path
                if file_path.startswith('/tmp/uploaded/'):
                    # 上傳的檔案實際存放在 uploads 目錄
                    filename = os.path.basename(file_path)
                    actual_file_path = os.path.join('uploads', filename)
                    
                    # 如果還沒有實際檔案，嘗試從 droppedFiles 創建
                    if not os.path.exists(actual_file_path):
                        print(f"警告：檔案不存在 {actual_file_path}")
                        continue

                if not os.path.exists(actual_file_path) or not os.path.isfile(actual_file_path):
                    error_msg = f"檔案不存在: {actual_file_path}"
                    status['results'][module]['errors'].append(error_msg)
                    print(error_msg)
                    continue

                status['results'][module]['processed_files'] += 1
                print(f"處理檔案: {actual_file_path}")

                for keyword in keyword_list:
                    try:
                        # 建立搜尋命令
                        cmd = build_search_command(keyword, actual_file_path, settings)
                        
                        print(f"執行命令: {' '.join(cmd)}")
                        
                        # 執行搜尋
                        process = subprocess.run(
                            cmd, 
                            capture_output=True, 
                            text=True, 
                            timeout=timeout,
                            encoding='utf-8',
                            errors='ignore'
                        )
                        
                        if process.returncode == 0:
                            # 找到匹配
                            output_lines = process.stdout.strip().split('\n')
                            matches = parse_search_output(output_lines, keyword, file_path)
                            
                            print(f"找到 {len(matches)} 個匹配")
                            
                            # 組織結果並即時發送
                            if matches:
                                if file_path not in status['results'][module]['files']:
                                    status['results'][module]['files'][file_path] = []
                                
                                file_matches = []
                                for match in matches:
                                    match_data = {
                                        'line_number': match['line_number'],
                                        'content': match['content'],
                                        'keyword': match['keyword']
                                    }
                                    status['results'][module]['files'][file_path].append(match_data)
                                    file_matches.append(match_data)
                                    status['results'][module]['total_matches'] += 1
                                
                                if keyword not in status['results'][module]['keywords_found']:
                                    status['results'][module]['keywords_found'].append(keyword)

                                # 即時發送匹配結果
                                stream_queue.put({
                                    'type': 'matches_found',
                                    'module': module,
                                    'file': file_path,
                                    'keyword': keyword,
                                    'matches': file_matches,
                                    'total_matches': status['results'][module]['total_matches']
                                })
                        
                        elif process.returncode == 1:
                            # 沒找到匹配，正常情況
                            print(f"未找到匹配: {keyword}")
                        else:
                            # 其他錯誤
                            error_msg = process.stderr.strip() if process.stderr else f"返回碼: {process.returncode}"
                            status['results'][module]['errors'].append(f"檔案 '{file_path}' 關鍵字 '{keyword}': {error_msg}")
                            print(f"搜尋錯誤: {error_msg}")
                        
                    except subprocess.TimeoutExpired:
                        error_msg = f"檔案 '{file_path}' 關鍵字 '{keyword}' 超時"
                        status['results'][module]['errors'].append(error_msg)
                        print(error_msg)
                    except Exception as e:
                        error_msg = f"檔案 '{file_path}' 關鍵字 '{keyword}' 錯誤: {str(e)}"
                        status['results'][module]['errors'].append(error_msg)
                        print(error_msg)
                    
                    # 更新進度
                    completed_operations += 1
                    progress = min(int((completed_operations / total_operations) * 100), 100)
                    status['progress'] = progress
                    
                    # 發送進度更新
                    stream_queue.put({
                        'type': 'progress',
                        'progress': progress,
                        'completed': completed_operations,
                        'total': total_operations
                    })
                    
                    time.sleep(0.01)

            # 計算模組搜尋時間
            module_end_time = datetime.now()
            status['results'][module]['search_time'] = (module_end_time - module_start_time).total_seconds()
            
            # 發送模組完成訊息
            stream_queue.put({
                'type': 'module_complete',
                'module': module,
                'search_time': status['results'][module]['search_time'],
                'total_matches': status['results'][module]['total_matches']
            })
        
        # 完成分析
        status['status'] = 'completed'
        status['progress'] = 100
        status['end_time'] = datetime.now()
        status['total_time'] = (status['end_time'] - status['start_time']).total_seconds()
        
        # 計算總匹配數
        total_matches = sum(module['total_matches'] for module in status['results'].values())
        
        # 發送完成訊息
        stream_queue.put({
            'type': 'complete',
            'total_time': status['total_time'],
            'total_matches': total_matches
        })
        
        print(f"分析完成！總匹配數: {total_matches}, 耗時: {status['total_time']:.2f}秒")
        
    except Exception as e:
        print(f"分析過程發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        
        status['status'] = 'error'
        status['error'] = str(e)
        status['progress'] = 100
        stream_queue.put({
            'type': 'error',
            'message': f"分析過程發生錯誤: {str(e)}"
        })

def generate_analysis_report(analysis_id):
    """生成分析報告"""
    if analysis_id not in analysis_status:
        return None
    
    status = analysis_status[analysis_id]
    results = status.get('results', {})
    
    # 統計資料
    total_files = status.get('total_files', 0)
    total_matches = sum(module['total_matches'] for module in results.values())
    total_modules = len(results)
    
    # 按模組分組結果
    module_summary = []
    for module, data in results.items():
        module_summary.append({
            'name': module,
            'matches': data['total_matches'],
            'files_count': len(data['files']),
            'keywords_found': data['keywords_found'],
            'search_time': data['search_time']
        })
    
    # 按檔案分組結果
    file_summary = defaultdict(lambda: {'modules': [], 'total_matches': 0})
    for module, data in results.items():
        for file_path, matches in data['files'].items():
            file_summary[file_path]['modules'].append({
                'module': module,
                'matches': len(matches),
                'keywords': list(set(match['keyword'] for match in matches))
            })
            file_summary[file_path]['total_matches'] += len(matches)
    
    return {
        'analysis_id': analysis_id,
        'summary': {
            'total_files': total_files,
            'total_matches': total_matches,
            'total_modules': total_modules,
            'analysis_time': status.get('total_time', 0)
        },
        'module_view': module_summary,
        'file_view': dict(file_summary),
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

# WebSocket 事件處理
@socketio.on('connect')
def handle_connect():
    user_id = request.sid
    online_users[user_id] = {
        'id': user_id,
        'name': f'用戶{len(online_users) + 1}',
        'joined_at': datetime.now(),
        'current_room': None
    }
    emit('user_connected', {
        'user_id': user_id, 
        'online_count': len(online_users),
        'online_users': get_online_users_list()
    }, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    user_id = request.sid
    if user_id in online_users:
        # 離開所有房間
        if online_users[user_id].get('current_room'):
            leave_room(online_users[user_id]['current_room'])
        del online_users[user_id]
    emit('user_disconnected', {
        'user_id': user_id, 
        'online_count': len(online_users),
        'online_users': get_online_users_list()
    }, broadcast=True)

@socketio.on('set_username')
def handle_set_username(data):
    user_id = request.sid
    if user_id in online_users:
        online_users[user_id]['name'] = data['username']
        emit('username_set', {'username': data['username']})
        emit('user_list_updated', {
            'online_users': get_online_users_list()
        }, broadcast=True)

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data['room_id']
    user_id = request.sid
    
    if user_id in online_users:
        # 離開當前房間
        current_room = online_users[user_id].get('current_room')
        if current_room and current_room != room_id:
            leave_room(current_room)
            emit('user_left_room', {
                'user_name': online_users[user_id]['name'],
                'room_id': current_room
            }, room=current_room)
        
        # 加入新房間
        join_room(room_id)
        online_users[user_id]['current_room'] = room_id
        
        # 獲取聊天記錄
        chat_history = get_chat_history(room_id, limit=50)
        
        emit('joined_room', {
            'room_id': room_id,
            'history': chat_history,
            'room_users': get_room_users(room_id)
        })
        
        emit('user_joined_room', {
            'user_name': online_users[user_id]['name'],
            'room_id': room_id,
            'room_users': get_room_users(room_id)
        }, room=room_id)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data['room_id']
    user_id = request.sid
    
    if user_id in online_users:
        leave_room(room_id)
        online_users[user_id]['current_room'] = None
        
        emit('user_left_room', {
            'user_name': online_users[user_id]['name'],
            'room_id': room_id,
            'room_users': get_room_users(room_id)
        }, room=room_id)

@socketio.on('send_message')
def handle_send_message(data):
    room_id = data['room_id']
    message = data['message']
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    message_type = data.get('message_type', 'text')
    
    # 處理提及(@)功能
    mentioned_users = extract_mentions(message)
    
    # 儲存到資料庫
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO chat_messages (room_id, user_name, message, message_type, mentioned_users)
        VALUES (?, ?, ?, ?, ?)
    ''', (room_id, user_name, message, message_type, json.dumps(mentioned_users)))
    message_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # 發送消息
    message_data = {
        'id': message_id,
        'user_name': user_name,
        'message': message,
        'message_type': message_type,
        'mentioned_users': mentioned_users,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'room_id': room_id
    }
    
    emit('new_message', message_data, room=room_id)
    
    # 如果有提及用戶，發送通知
    if mentioned_users:
        for mentioned in mentioned_users:
            for uid, user in online_users.items():
                if user['name'] == mentioned:
                    emit('mentioned', {
                        'by': user_name,
                        'message': message,
                        'room_id': room_id
                    }, room=uid)

@socketio.on('upload_file')
def handle_upload_file(data):
    room_id = data['room_id']
    file_data = data['file_data']
    file_name = secure_filename(data['file_name'])
    file_type = data.get('file_type', 'file')
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    
    # 儲存檔案
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_filename = f"{timestamp}_{file_name}"
    file_path = os.path.join(uploads_dir, unique_filename)
    
    # Base64 解碼並儲存
    file_content = base64.b64decode(file_data.split(',')[1] if ',' in file_data else file_data)
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    # 儲存到資料庫
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO chat_messages (room_id, user_name, message, message_type, file_path, file_name, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (room_id, user_name, '', file_type, file_path, file_name, len(file_content)))
    message_id = cursor.lastrowid
    
    # 儲存到資源表
    cursor.execute('''
        INSERT INTO room_resources (room_id, resource_type, resource_url, resource_name, uploaded_by)
        VALUES (?, ?, ?, ?, ?)
    ''', (room_id, file_type, file_path, file_name, user_name))
    
    conn.commit()
    conn.close()
    
    # 發送檔案消息
    emit('new_message', {
        'id': message_id,
        'user_name': user_name,
        'message': f'上傳了檔案: {file_name}',
        'message_type': file_type,
        'file_url': f'/uploads/chat/{unique_filename}',
        'file_name': file_name,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'room_id': room_id
    }, room=room_id)

@socketio.on('create_poll')
def handle_create_poll(data):
    room_id = data['room_id']
    question = data['question']
    options = data['options']
    duration = data.get('duration', 300)  # 預設5分鐘
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    poll_id = str(uuid.uuid4())
    ends_at = datetime.now() + timedelta(seconds=duration)
    
    # 儲存投票
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO polls (id, room_id, question, options, created_by, ends_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (poll_id, room_id, question, json.dumps(options), user_name, ends_at))
    conn.commit()
    conn.close()
    
    polls[poll_id] = {
        'question': question,
        'options': options,
        'votes': {i: 0 for i in range(len(options))},
        'voters': set()
    }
    
    emit('new_poll', {
        'poll_id': poll_id,
        'question': question,
        'options': options,
        'created_by': user_name,
        'ends_at': ends_at.isoformat(),
        'room_id': room_id
    }, room=room_id)

@socketio.on('vote_poll')
def handle_vote_poll(data):
    poll_id = data['poll_id']
    option_index = data['option_index']
    user_id = request.sid
    
    if user_id not in online_users or poll_id not in polls:
        return
    
    user_name = online_users[user_id]['name']
    
    # 檢查是否已投票
    if user_name in polls[poll_id]['voters']:
        emit('vote_error', {'message': '您已經投過票了'})
        return
    
    # 記錄投票
    polls[poll_id]['votes'][option_index] += 1
    polls[poll_id]['voters'].add(user_name)
    
    # 儲存到資料庫
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO poll_votes (poll_id, user_name, option_index)
        VALUES (?, ?, ?)
    ''', (poll_id, user_name, option_index))
    conn.commit()
    conn.close()
    
    # 廣播投票結果更新
    emit('poll_updated', {
        'poll_id': poll_id,
        'votes': polls[poll_id]['votes'],
        'total_votes': len(polls[poll_id]['voters'])
    }, broadcast=True)

@socketio.on('create_wheel')
def handle_create_wheel(data):
    room_id = data['room_id']
    name = data['name']
    options = data['options']
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    wheel_id = str(uuid.uuid4())
    
    # 儲存轉盤
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO lucky_wheels (id, room_id, name, options, created_by)
        VALUES (?, ?, ?, ?, ?)
    ''', (wheel_id, room_id, name, json.dumps(options), user_name))
    conn.commit()
    conn.close()
    
    lucky_wheels[wheel_id] = {
        'name': name,
        'options': options,
        'room_id': room_id
    }
    
    emit('new_wheel', {
        'wheel_id': wheel_id,
        'name': name,
        'options': options,
        'created_by': user_name,
        'room_id': room_id
    }, room=room_id)

@socketio.on('spin_wheel')
def handle_spin_wheel(data):
    wheel_id = data['wheel_id']
    user_id = request.sid
    
    if user_id not in online_users or wheel_id not in lucky_wheels:
        return
    
    user_name = online_users[user_id]['name']
    wheel = lucky_wheels[wheel_id]
    
    # 隨機選擇結果
    import random
    result_index = random.randint(0, len(wheel['options']) - 1)
    result = wheel['options'][result_index]
    
    emit('wheel_result', {
        'wheel_id': wheel_id,
        'user_name': user_name,
        'result': result,
        'result_index': result_index
    }, room=wheel['room_id'])

@socketio.on('broadcast_message')
def handle_broadcast_message(data):
    message = data['message']
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    
    # 發送廣播消息給所有線上用戶
    emit('broadcast', {
        'from': user_name,
        'message': message,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }, broadcast=True)

@socketio.on('create_room')
def handle_create_room(data):
    name = data['name']
    description = data.get('description', '')
    is_public = data.get('is_public', True)
    user_id = request.sid
    
    if user_id not in online_users:
        return
    
    user_name = online_users[user_id]['name']
    room_id = str(uuid.uuid4())
    
    # 儲存聊天室
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO chat_rooms (id, name, description, created_by, is_public)
        VALUES (?, ?, ?, ?, ?)
    ''', (room_id, name, description, user_name, 1 if is_public else 0))
    conn.commit()
    conn.close()
    
    chat_rooms[room_id] = {
        'name': name,
        'description': description,
        'created_by': user_name,
        'is_public': is_public
    }
    
    emit('room_created', {
        'room_id': room_id,
        'name': name,
        'description': description
    })
    
    # 通知所有人有新聊天室
    emit('new_room_available', {
        'room_id': room_id,
        'name': name,
        'description': description,
        'created_by': user_name
    }, broadcast=True)

# Helper functions
def get_online_users_list():
    return [{'id': uid, 'name': user['name']} for uid, user in online_users.items()]

def get_room_users(room_id):
    room_users = []
    for uid, user in online_users.items():
        if user.get('current_room') == room_id:
            room_users.append({'id': uid, 'name': user['name']})
    return room_users

def get_chat_history(room_id, limit=50):
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, user_name, message, message_type, file_name, timestamp, mentioned_users
        FROM chat_messages
        WHERE room_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (room_id, limit))
    
    messages = []
    for row in cursor.fetchall():
        msg = {
            'id': row[0],
            'user_name': row[1],
            'message': row[2],
            'message_type': row[3],
            'file_name': row[4],
            'timestamp': row[5],
            'mentioned_users': json.loads(row[6]) if row[6] else []
        }
        messages.append(msg)
    
    conn.close()
    return messages[::-1]  # 反轉順序，最舊的在前

def extract_mentions(message):
    mentions = re.findall(r'@(\w+)', message)
    return list(set(mentions))

# API 路由
@app.route('/')
def index():
    return render_template('enhanced_index_v2.html')

@app.route('/room/<room_id>')
def room_page(room_id):
    """獨立聊天室頁面"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM chat_rooms WHERE id = ?', (room_id,))
    room = cursor.fetchone()
    conn.close()
    
    if not room:
        abort(404, '聊天室不存在')
    
    room_data = {
        'id': room[0],
        'name': room[1],
        'description': room[2]
    }
    
    return render_template('room.html', room=room_data)

@app.route('/room_manager')
def room_manager():
    """聊天室管理中心"""
    return render_template('room_manager.html')

@app.route('/api/rooms')
def get_rooms():
    """獲取所有聊天室"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM chat_rooms ORDER BY created_at DESC')
    
    rooms = []
    for row in cursor.fetchall():
        rooms.append({
            'id': row[0],
            'name': row[1],
            'description': row[2],
            'created_at': row[3],
            'created_by': row[4],
            'is_public': bool(row[5]) if len(row) > 5 else True
        })
    
    conn.close()
    return jsonify(rooms)

@app.route('/api/room/<room_id>/resources')
def get_room_resources(room_id):
    """獲取聊天室資源"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT resource_type, resource_url, resource_name, uploaded_by, uploaded_at
        FROM room_resources
        WHERE room_id = ?
        ORDER BY uploaded_at DESC
    ''', (room_id,))
    
    resources = []
    for row in cursor.fetchall():
        resources.append({
            'type': row[0],
            'url': row[1],
            'name': row[2],
            'uploaded_by': row[3],
            'uploaded_at': row[4]
        })
    
    conn.close()
    return jsonify(resources)

@app.route('/file_viewer')
def file_viewer():
    """檢視檔案"""
    file_path = request.args.get('path')
    line_number = request.args.get('line', type=int, default=1)
    context = request.args.get('context', type=int, default=200)
    start_line = request.args.get('start', type=int)
    end_line = request.args.get('end', type=int)
    
    if not file_path or not os.path.exists(file_path):
        abort(404, '檔案不存在')
    
    result = read_file_lines(file_path, line_number, context, start_line, end_line)
    
    if not result['success']:
        abort(500, f'讀取檔案失敗: {result["error"]}')
    
    return render_template('enhanced_file_viewer.html', 
                         file_path=file_path,
                         file_name=os.path.basename(file_path),
                         result=result)

@app.route('/analysis_report/<analysis_id>')
def analysis_report(analysis_id):
    """分析報告頁面"""
    report_data = generate_analysis_report(analysis_id)
    if not report_data:
        abort(404, '分析結果不存在')
    
    return render_template('analysis_report.html', report=report_data)

@app.route('/api/browse')
def browse_files():
    """瀏覽檔案API"""
    path = request.args.get('path', '/home')
    
    try:
        abs_path = os.path.abspath(path)
        
        if not os.path.exists(abs_path):
            return jsonify({'error': f'路徑不存在: {path}'})
        
        if not os.path.isdir(abs_path):
            return jsonify({'error': f'不是目錄: {path}'})
        
        items = []
        
        # 添加返回上級目錄選項
        if abs_path != '/':
            parent_path = os.path.dirname(abs_path)
            items.append({
                'name': '..',
                'path': parent_path,
                'type': 'directory',
                'is_parent': True,
                'size': '',
                'modified': ''
            })
        
        # 列出目錄內容
        try:
            for item in sorted(os.listdir(abs_path)):
                if item.startswith('.'):
                    continue
                
                item_path = os.path.join(abs_path, item)
                
                try:
                    stat = os.stat(item_path)
                    modified = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')
                    
                    if os.path.isdir(item_path):
                        items.append({
                            'name': item,
                            'path': item_path,
                            'type': 'directory',
                            'is_parent': False,
                            'size': '',
                            'modified': modified
                        })
                    else:
                        size = format_file_size(stat.st_size)
                        items.append({
                            'name': item,
                            'path': item_path,
                            'type': 'file',
                            'is_parent': False,
                            'size': size,
                            'modified': modified
                        })
                except (OSError, PermissionError):
                    continue
                    
        except PermissionError:
            return jsonify({'error': f'沒有權限訪問: {path}'})
        
        return jsonify({
            'current_path': abs_path,
            'items': items
        })
        
    except Exception as e:
        return jsonify({'error': f'瀏覽目錄失敗: {str(e)}'})

@app.route('/api/upload_keywords', methods=['POST'])
def upload_keywords():
    """上傳關鍵字檔案"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        if not file.filename.endswith('.csv'):
            return jsonify({'success': False, 'message': '請上傳 CSV 檔案'})
        
        # 讀取 CSV 內容
        content = file.read().decode('utf-8')
        csv_reader = csv.DictReader(content.splitlines())
        
        new_keywords = {}
        for row in csv_reader:
            module = None
            keyword_list = None
            
            # 嘗試不同的欄位名稱組合
            for module_field in ['Module', 'module', '模組', 'Category', 'category']:
                if module_field in row:
                    module = row[module_field].strip()
                    break
            
            for keyword_field in ['Keyword list', 'keyword list', 'Keywords', 'keywords', '關鍵字', '關鍵字清單']:
                if keyword_field in row:
                    keyword_list = row[keyword_field].strip()
                    break
            
            if module and keyword_list:
                # 分割關鍵字
                keywords_split = []
                for separator in [',', ';', '\n']:
                    if separator in keyword_list:
                        keywords_split = [k.strip() for k in keyword_list.split(separator) if k.strip()]
                        break
                
                if not keywords_split:
                    keywords_split = [keyword_list]
                
                new_keywords[module] = keywords_split
        
        if not new_keywords:
            return jsonify({'success': False, 'message': 'CSV 檔案格式不正確'})
        
        # 保存原始關鍵字用於復原
        config['original_keywords'] = new_keywords.copy()
        config['keywords'] = new_keywords
        
        return jsonify({
            'success': True,
            'message': f'成功載入 {len(new_keywords)} 個模組的關鍵字',
            'keywords': new_keywords
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'處理檔案失敗: {str(e)}'})

@app.route('/api/keywords')
def get_keywords():
    """獲取當前關鍵字"""
    return jsonify(config['keywords'])

@app.route('/api/keywords/delete/<module>', methods=['DELETE'])
def delete_keyword_module(module):
    """刪除關鍵字模組"""
    if module in config['keywords']:
        del config['keywords'][module]
        return jsonify({'success': True, 'message': f'已刪除模組: {module}'})
    return jsonify({'success': False, 'message': '模組不存在'})

@app.route('/api/keywords/restore', methods=['POST'])
def restore_keywords():
    """復原所有關鍵字模組"""
    config['keywords'] = config['original_keywords'].copy()
    return jsonify({
        'success': True, 
        'message': '已復原所有關鍵字模組',
        'keywords': config['keywords']
    })

@app.route('/api/upload_file', methods=['POST'])
def upload_file():
    """上傳檔案用於分析"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        # 儲存檔案
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join('uploads', unique_filename)
        
        file.save(file_path)
        
        return jsonify({
            'success': True,
            'message': '檔案上傳成功',
            'file_path': file_path,
            'virtual_path': f'/tmp/uploaded/{filename}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'上傳失敗: {str(e)}'})

@app.route('/api/upload_archive', methods=['POST'])
def upload_archive():
    """上傳並解壓縮檔案"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '沒有選擇檔案'})
        
        # 檢查檔案格式
        allowed_extensions = ['.zip', '.7z', '.tar.gz', '.gz', '.tar']
        if not any(file.filename.endswith(ext) for ext in allowed_extensions):
            return jsonify({'success': False, 'message': '不支援的檔案格式'})
        
        # 儲存檔案
        upload_dir = 'uploads/archives'
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, secure_filename(file.filename))
        file.save(file_path)
        
        # 解壓縮
        extract_dir = os.path.join(upload_dir, f"extracted_{uuid.uuid4().hex}")
        os.makedirs(extract_dir, exist_ok=True)
        
        extracted_files = extract_archive(file_path, extract_dir)
        
        # 過濾日誌檔案
        log_files = []
        log_extensions = ['.log', '.txt', '.out', '.err']
        for file_path in extracted_files:
            if any(file_path.endswith(ext) for ext in log_extensions):
                log_files.append({
                    'name': os.path.basename(file_path),
                    'path': file_path,
                    'size': format_file_size(os.path.getsize(file_path))
                })
        
        return jsonify({
            'success': True,
            'message': f'成功解壓縮，找到 {len(log_files)} 個日誌檔案',
            'files': log_files
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'處理檔案失敗: {str(e)}'})

@app.route('/api/analyze_stream', methods=['POST'])
def analyze_stream():
    """啟動流式分析"""
    try:
        data = request.get_json()
        selected_files = data.get('files', [])
        
        if not selected_files:
            return jsonify({'success': False, 'message': '請至少選擇一個檔案'})
        
        if not config['keywords']:
            return jsonify({'success': False, 'message': '請先上傳關鍵字清單'})
        
        # 啟動流式分析
        analysis_id = str(uuid.uuid4())
        
        # 創建流式隊列
        stream_queue = queue.Queue()
        analysis_streams[analysis_id] = stream_queue
        
        # 儲存分析狀態
        analysis_status[analysis_id] = {
            'status': 'started',
            'progress': 0,
            'total_files': len(selected_files),
            'total_modules': len(config['keywords']),
            'results': {},
            'current_file': '',
            'current_module': '',
            'start_time': datetime.now()
        }
        
        # 在背景執行分析
        thread = threading.Thread(
            target=search_streaming,
            args=(analysis_id, selected_files, config['keywords'])
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'analysis_id': analysis_id,
            'message': '開始流式分析',
            'valid_files_count': len(selected_files)
        })
        
    except Exception as e:
        print(f"分析錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'分析錯誤: {str(e)}'})

@app.route('/api/analysis_stream/<analysis_id>')
def get_analysis_stream(analysis_id):
    """SSE 流式獲取分析結果"""
    if analysis_id not in analysis_streams:
        abort(404, '分析 ID 不存在')
    
    def generate():
        stream_queue = analysis_streams[analysis_id]
        
        while True:
            try:
                message = stream_queue.get(timeout=5)
                yield f"data: {json.dumps(message, ensure_ascii=False)}\n\n"
                
                if message.get('type') in ['complete', 'error']:
                    break
                    
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            except:
                break
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/share_result', methods=['POST'])
def share_result():
    """分享分析結果"""
    try:
        data = request.get_json()
        analysis_id = data['analysis_id']
        is_public = data.get('is_public', False)
        expires_days = data.get('expires_days', 7)
        
        share_token = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(days=expires_days)
        
        conn = sqlite3.connect('chat_data.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO shared_results (id, analysis_id, share_token, is_public, created_by, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (str(uuid.uuid4()), analysis_id, share_token, 1 if is_public else 0, 
              session.get('username', 'anonymous'), expires_at))
        conn.commit()
        conn.close()
        
        share_url = url_for('view_shared_result', token=share_token, _external=True)
        
        return jsonify({
            'success': True,
            'share_url': share_url,
            'share_token': share_token,
            'expires_at': expires_at.isoformat()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'分享失敗: {str(e)}'})

@app.route('/shared/<token>')
def view_shared_result(token):
    """查看分享的結果"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT analysis_id, is_public, expires_at, view_count
        FROM shared_results
        WHERE share_token = ?
    ''', (token,))
    
    result = cursor.fetchone()
    if not result:
        abort(404, '分享連結無效')
    
    analysis_id, is_public, expires_at, view_count = result
    
    # 檢查是否過期
    if datetime.now() > datetime.fromisoformat(expires_at):
        abort(410, '分享連結已過期')
    
    # 更新查看次數
    cursor.execute('''
        UPDATE shared_results SET view_count = view_count + 1
        WHERE share_token = ?
    ''', (token,))
    conn.commit()
    conn.close()
    
    # 獲取分析報告
    report = generate_analysis_report(analysis_id)
    if not report:
        abort(404, '分析結果不存在')
    
    return render_template('shared_report.html', report=report, is_public=is_public)

@app.route('/api/share_manager')
def share_manager():
    """分享管理中心"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, analysis_id, share_token, is_public, created_by, created_at, expires_at, view_count
        FROM shared_results
        ORDER BY created_at DESC
    ''')
    
    shares = []
    for row in cursor.fetchall():
        shares.append({
            'id': row[0],
            'analysis_id': row[1],
            'share_token': row[2],
            'is_public': bool(row[3]),
            'created_by': row[4],
            'created_at': row[5],
            'expires_at': row[6],
            'view_count': row[7],
            'share_url': url_for('view_shared_result', token=row[2], _external=True)
        })
    
    conn.close()
    return jsonify(shares)

@app.route('/api/share/<share_id>', methods=['DELETE'])
def delete_share(share_id):
    """刪除分享"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM shared_results WHERE id = ?', (share_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/download_sample')
def download_sample():
    """下載範例關鍵字檔案"""
    try:
        sample_file = os.path.join('uploads', 'keywords_sample.csv')
        if os.path.exists(sample_file):
            return send_from_directory('uploads', 'keywords_sample.csv', as_attachment=True)
        
        # 動態生成範例檔案
        sample_content = """Module,Keyword list
Error,error,ERROR,failed,FAILED,exception,Exception,EXCEPTION
Warning,warning,WARN,alert,Alert,ALERT
Security,unauthorized,forbidden,attack,intrusion,hack,breach
Database,database error,connection failed,timeout,deadlock,query failed
Network,connection refused,network unreachable,dns resolution failed,timeout
System,out of memory,disk full,cpu usage,high load,memory leak
Authentication,login failed,authentication error,invalid credentials,access denied
Performance,slow query,timeout,high latency,performance degradation"""
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
        temp_file.write(sample_content)
        temp_file.close()
        
        return send_from_directory(os.path.dirname(temp_file.name), 
                                 os.path.basename(temp_file.name), 
                                 as_attachment=True, 
                                 download_name='keywords_sample.csv')
    except Exception as e:
        return jsonify({'error': f'下載範例檔案失敗: {str(e)}'}), 500

@app.route('/uploads/chat/<path:filename>')
def serve_chat_file(filename):
    """提供聊天室上傳檔案"""
    return send_from_directory(uploads_dir, filename)

@app.route('/api/export_file')
def export_file():
    """匯出檔案"""
    file_path = request.args.get('path')
    
    if not file_path or not os.path.exists(file_path):
        abort(404, '檔案不存在')
    
    try:
        # 取得檔案名稱
        filename = os.path.basename(file_path)
        
        # 使用 send_file 直接下載檔案
        return send_from_directory(
            os.path.dirname(file_path),
            filename,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        abort(500, f'下載檔案失敗: {str(e)}')

@app.route('/api/get_line_content')
def get_line_content():
    """獲取指定行的內容用於預覽"""
    try:
        file_path = request.args.get('path')
        line_number = request.args.get('line', type=int)
        
        if not file_path or not line_number:
            return jsonify({
                'success': False, 
                'message': '缺少必要參數'
            })
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({
                'success': False, 
                'message': '檔案不存在'
            })
        
        if line_number < 1:
            return jsonify({
                'success': False, 
                'message': '行號必須大於 0'
            })
        
        # 讀取指定行的內容
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for current_line_number, line in enumerate(f, 1):
                    if current_line_number == line_number:
                        # 移除換行符並限制長度
                        content = line.rstrip('\n\r')
                        if len(content) > 200:
                            content = content[:200] + '...'
                        
                        return jsonify({
                            'success': True,
                            'content': content,
                            'line_number': line_number,
                            'file_path': file_path
                        })
                
                # 如果到這裡說明行號超出範圍
                return jsonify({
                    'success': False,
                    'message': f'行號 {line_number} 超出檔案範圍'
                })
                
        except UnicodeDecodeError:
            # 嘗試其他編碼
            encodings = ['utf-8', 'gbk', 'big5', 'latin1']
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                        for current_line_number, line in enumerate(f, 1):
                            if current_line_number == line_number:
                                content = line.rstrip('\n\r')
                                if len(content) > 200:
                                    content = content[:200] + '...'
                                
                                return jsonify({
                                    'success': True,
                                    'content': content,
                                    'line_number': line_number,
                                    'file_path': file_path
                                })
                    break
                except:
                    continue
            
            return jsonify({
                'success': False,
                'message': '無法讀取檔案內容'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'讀取失敗: {str(e)}'
        })

def get_line_range():
    """獲取指定範圍的行內容"""
    try:
        file_path = request.args.get('path')
        start_line = request.args.get('start', type=int)
        end_line = request.args.get('end', type=int)
        
        if not file_path or not start_line or not end_line:
            return jsonify({
                'success': False, 
                'message': '缺少必要參數'
            })
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({
                'success': False, 
                'message': '檔案不存在'
            })
        
        if start_line < 1 or end_line < start_line:
            return jsonify({
                'success': False, 
                'message': '行號範圍無效'
            })
        
        # 限制範圍大小（防止過大的請求）
        if end_line - start_line + 1 > 100:
            return jsonify({
                'success': False, 
                'message': '範圍過大（最多100行）'
            })
        
        lines = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for current_line_number, line in enumerate(f, 1):
                    if current_line_number >= start_line and current_line_number <= end_line:
                        lines.append({
                            'line_number': current_line_number,
                            'content': line.rstrip('\n\r')
                        })
                    elif current_line_number > end_line:
                        break
            
            return jsonify({
                'success': True,
                'lines': lines,
                'start_line': start_line,
                'end_line': end_line,
                'total_returned': len(lines)
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'讀取檔案失敗: {str(e)}'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'處理請求失敗: {str(e)}'
        })

# 修改評論 API 路由
@app.route('/api/comments')
def get_comments():
    """獲取檔案評論 - 支援巢狀回覆"""
    file_path = request.args.get('file_path')
    if not file_path:
        return jsonify({'success': False, 'message': '缺少檔案路徑'})
    
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    # 獲取所有評論（包括回覆）
    cursor.execute('''
        SELECT id, comment as content, topic, author, created_at, updated_at, parent_comment_id
        FROM user_comments
        WHERE file_path = ?
        ORDER BY created_at ASC
    ''', (file_path,))
    
    all_comments = []
    comment_map = {}
    
    for row in cursor.fetchall():
        comment = {
            'id': row[0],
            'content': row[1],
            'topic': row[2] or '一般討論',
            'author': row[3] or session.get('username', '匿名用戶'),
            'created_at': row[4],
            'updated_at': row[5],
            'parent_comment_id': row[6],
            'replies': [],
            'attachments': []  # 這裡可以後續擴展附件功能
        }
        comment_map[comment['id']] = comment
        all_comments.append(comment)
    
    # 組織巢狀結構
    root_comments = []
    for comment in all_comments:
        if comment['parent_comment_id']:
            # 這是回覆，將其添加到父評論的 replies 中
            parent = comment_map.get(comment['parent_comment_id'])
            if parent:
                parent['replies'].append(comment)
        else:
            # 這是根評論
            root_comments.append(comment)
    
    conn.close()
    
    return jsonify({
        'success': True,
        'comments': root_comments
    })

@app.route('/api/comment', methods=['POST'])
def create_comment():
    """新增評論 - 支援回覆"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        content = data.get('content')
        topic = data.get('topic', '一般討論')
        parent_comment_id = data.get('parent_comment_id')
        attachments = data.get('attachments', [])
        
        if not file_path or not content:
            return jsonify({'success': False, 'message': '缺少必要資料'})
        
        # 處理附件
        saved_attachments = []
        for attachment in attachments:
            if attachment.get('data'):
                # 儲存附件
                filename = f"{uuid.uuid4().hex}_{attachment['name']}"
                filepath = os.path.join(comments_dir, filename)
                
                # Base64 解碼並儲存
                file_data = attachment['data'].split(',')[1] if ',' in attachment['data'] else attachment['data']
                file_content = base64.b64decode(file_data)
                
                with open(filepath, 'wb') as f:
                    f.write(file_content)
                
                saved_attachments.append({
                    'name': attachment['name'],
                    'type': attachment['type'],
                    'size': attachment['size'],
                    'path': filepath,
                    'url': f'/uploads/comments/{filename}'
                })
        
        # 創建評論
        comment_id = str(uuid.uuid4())
        author = session.get('username', '匿名用戶')
        
        conn = sqlite3.connect('chat_data.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_comments 
            (id, file_path, comment, topic, author, parent_comment_id, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (comment_id, file_path, content, topic, author, parent_comment_id, author))
        
        conn.commit()
        conn.close()
        
        comment = {
            'id': comment_id,
            'content': content,
            'topic': topic,
            'author': author,
            'parent_comment_id': parent_comment_id,
            'attachments': saved_attachments,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'comment': comment
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'新增評論失敗: {str(e)}'})

@app.route('/api/comment', methods=['PUT'])
def update_comment():
    """更新評論"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        edit_id = data.get('edit_id')
        content = data.get('content')
        topic = data.get('topic')
        
        if not file_path or not edit_id or not content:
            return jsonify({'success': False, 'message': '缺少必要資料'})
        
        conn = sqlite3.connect('chat_data.db')
        cursor = conn.cursor()
        
        # 更新評論
        cursor.execute('''
            UPDATE user_comments 
            SET comment = ?, topic = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (content, topic, edit_id))
        
        # 獲取更新後的評論
        cursor.execute('''
            SELECT id, comment as content, topic, author, created_at, updated_at, parent_comment_id
            FROM user_comments
            WHERE id = ?
        ''', (edit_id,))
        
        row = cursor.fetchone()
        if row:
            comment = {
                'id': row[0],
                'content': row[1],
                'topic': row[2],
                'author': row[3],
                'created_at': row[4],
                'updated_at': row[5],
                'parent_comment_id': row[6]
            }
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'comment': comment
            })
        else:
            conn.close()
            return jsonify({'success': False, 'message': '找不到評論'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'更新評論失敗: {str(e)}'})

@app.route('/api/comment/<comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    """刪除評論"""
    try:
        # 在所有檔案中尋找並刪除評論
        for file_path in file_comments:
            comments = file_comments[file_path]
            for i, comment in enumerate(comments):
                if comment['id'] == comment_id:
                    # 刪除附件檔案
                    for attachment in comment.get('attachments', []):
                        if 'path' in attachment and os.path.exists(attachment['path']):
                            os.remove(attachment['path'])
                    
                    # 刪除評論
                    comments.pop(i)
                    return jsonify({'success': True})
        
        return jsonify({'success': False, 'message': '找不到評論'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'刪除評論失敗: {str(e)}'})

@app.route('/uploads/comments/<path:filename>')
def serve_comment_file(filename):
    """提供評論附件檔案"""
    return send_from_directory(comments_dir, filename)
        
# 工具函數
def read_file_lines(file_path, target_line, context=200, start_line=None, end_line=None):
    """讀取檔案指定行數及其上下文"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        total_lines = len(lines)
        
        if start_line is not None and end_line is not None:
            start_line = max(1, min(start_line, total_lines))
            end_line = min(total_lines, max(end_line, start_line))
        else:
            start_line = max(1, target_line - context)
            end_line = min(total_lines, target_line + context)
        
        result_lines = []
        for i in range(start_line - 1, end_line):
            result_lines.append({
                'line_number': i + 1,
                'content': lines[i].rstrip('\n\r'),
                'is_target': (i + 1) == target_line
            })
        
        return {
            'success': True,
            'lines': result_lines,
            'total_lines': total_lines,
            'start_line': start_line,
            'end_line': end_line,
            'target_line': target_line
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def format_file_size(size_bytes):
    """格式化檔案大小"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_names[i]}"

def extract_archive(file_path, extract_to):
    """解壓縮檔案並返回檔案列表"""
    extracted_files = []
    
    try:
        if file_path.endswith('.zip'):
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_to)
                extracted_files = [os.path.join(extract_to, name) for name in zip_ref.namelist()]
        
        elif file_path.endswith('.tar.gz') or file_path.endswith('.tgz'):
            with tarfile.open(file_path, 'r:gz') as tar_ref:
                tar_ref.extractall(extract_to)
                extracted_files = [os.path.join(extract_to, name) for name in tar_ref.getnames()]
        
        elif file_path.endswith('.tar'):
            with tarfile.open(file_path, 'r') as tar_ref:
                tar_ref.extractall(extract_to)
                extracted_files = [os.path.join(extract_to, name) for name in tar_ref.getnames()]
        
        elif file_path.endswith('.gz'):
            output_file = os.path.join(extract_to, os.path.basename(file_path[:-3]))
            with gzip.open(file_path, 'rb') as gz_file:
                with open(output_file, 'wb') as out_file:
                    out_file.write(gz_file.read())
            extracted_files = [output_file]
        
        elif file_path.endswith('.7z'):
            with py7zr.SevenZipFile(file_path, mode='r') as z:
                z.extractall(path=extract_to)
                extracted_files = [os.path.join(extract_to, name) for name in z.getnames()]
        
        # 過濾出實際的檔案（排除目錄）
        extracted_files = [f for f in extracted_files if os.path.isfile(f)]
        
    except Exception as e:
        print(f"解壓縮失敗: {str(e)}")
        return []
    
    return extracted_files

if __name__ == '__main__':
    print("🚀 Enhanced Log 分析平台 v6 啟動中...")
    print("🆕 新增功能：")
    print("   - 修復分析引擎")
    print("   - 完整聊天室系統（含歷史記錄）")
    print("   - 創建新聊天室功能")
    print("   - 獨立聊天室頁面")
    print("   - 線上用戶列表與@提及功能")
    print("   - 廣播系統")
    print("   - 自定義幸運轉盤")
    print("   - 聊天室管理中心")
    print("   - 分享功能")
    print("=" * 50)
    
    # 確保必要目錄存在
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('uploads/archives', exist_ok=True)
    os.makedirs('uploads/chat', exist_ok=True)
    
    # 初始化資料庫
    init_database()
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)