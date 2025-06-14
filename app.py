#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, abort
import os
import csv
import subprocess
import shutil
from datetime import datetime
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
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import base64

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# 全域變數儲存分析狀態
analysis_status = {}
analysis_streams = {}
user_comments = {}
chat_rooms = {}
online_users = {}

# FastGrep 配置
config = {
    'keywords': {},
    'original_keywords': {},  # 保存原始關鍵字用於復原
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
            created_by TEXT
        )
    ''')
    
    # 聊天訊息表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            user_name TEXT,
            message TEXT,
            message_type TEXT DEFAULT 'text',
            file_path TEXT,
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
    
    # 用戶評論表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_comments (
            id TEXT PRIMARY KEY,
            analysis_id TEXT,
            module_name TEXT,
            file_path TEXT,
            comment TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def check_fastgrep_available():
    """檢查 fastgrep 是否可用 - 強健版本"""
    try:
        # 先嘗試 fastgrep
        result = subprocess.run(['fastgrep', '--help'], 
                              capture_output=True, text=True, timeout=5)
        
        output = result.stdout + result.stderr
        fastgrep_indicators = ['選項', 'usage', 'fastgrep', '模式', '檔案']
        
        for indicator in fastgrep_indicators:
            if indicator in output.lower():
                print(f"✅ fastgrep 檢查成功，找到指標: {indicator}")
                return True
        
        print(f"❌ fastgrep 輸出不包含預期指標，使用 grep 替代")
        return False
        
    except FileNotFoundError:
        print("❌ fastgrep 命令找不到，使用 grep 替代")
        return False
    except subprocess.TimeoutExpired:
        print("❌ fastgrep 命令超時，使用 grep 替代")
        return False
    except Exception as e:
        print(f"❌ fastgrep 檢查發生錯誤: {str(e)}，使用 grep 替代")
        return False

def build_search_command(keyword, file_path, settings=None):
    """建立搜尋命令 - 優先使用 fastgrep，fallback 到 grep"""
    if settings is None:
        settings = config['fastgrep_settings']
    
    # 使用雙引號包裹關鍵字確保正確搜尋
    quoted_keyword = f'"{keyword}"'
    
    if check_fastgrep_available():
        cmd = ['fastgrep']
        cmd.extend(['-n'])          # 顯示行號
        cmd.extend(['-i'])          # 忽略大小寫
        
        # 執行緒數量
        if settings.get('threads', 1) > 1:
            cmd.extend(['-j', str(settings['threads'])])
        
        # 記憶體映射
        if settings.get('use_mmap', False):
            cmd.extend(['-m'])
        
        # 搜尋模式（關鍵字）
        cmd.append(quoted_keyword)
        cmd.append(file_path)
    else:
        # 使用標準 grep 作為 fallback
        cmd = ['grep']
        cmd.extend(['-n'])          # 顯示行號
        cmd.extend(['-i'])          # 忽略大小寫
        cmd.extend(['-F'])          # 固定字串搜尋
        cmd.append(quoted_keyword)
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

def search_streaming(analysis_id, file_paths, keywords):
    """流式搜尋"""
    try:
        status = analysis_status[analysis_id]
        stream_queue = analysis_streams[analysis_id]
        
        status['status'] = 'running'
        
        settings = config['fastgrep_settings']
        timeout = settings.get('timeout', 120)
        
        total_operations = len(file_paths) * sum(len(keyword_list) for keyword_list in keywords.values())
        completed_operations = 0
        
        # 發送開始訊息
        stream_queue.put({
            'type': 'start',
            'message': '開始分析...',
            'total_files': len(file_paths),
            'total_modules': len(keywords)
        })
        
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

        for module, keyword_list in keywords.items():
            status['current_module'] = module
            module_start_time = datetime.now()
            
            # 發送模組開始訊息
            stream_queue.put({
                'type': 'module_start',
                'module': module,
                'keywords': keyword_list
            })

            # 為每個檔案分別執行搜尋
            for file_path in file_paths:
                status['current_file'] = os.path.basename(file_path)
                
                # 發送檔案開始訊息
                stream_queue.put({
                    'type': 'file_start',
                    'module': module,
                    'file': file_path
                })

                # 處理虛擬檔案路徑（上傳的檔案）
                if file_path.startswith('/tmp/uploaded/'):
                    # 處理上傳的檔案
                    actual_path = os.path.join('uploads', os.path.basename(file_path))
                    if not os.path.exists(actual_path):
                        continue
                    file_path = actual_path

                if not os.path.exists(file_path) or not os.path.isfile(file_path):
                    error_msg = f"檔案不存在: {file_path}"
                    status['results'][module]['errors'].append(error_msg)
                    continue

                status['results'][module]['processed_files'] += 1

                for keyword in keyword_list:
                    try:
                        # 建立搜尋命令
                        cmd = build_search_command(keyword, file_path, settings)
                        
                        print(f"執行搜尋: {' '.join(cmd)}")
                        
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
                            pass
                        else:
                            # 其他錯誤
                            error_msg = process.stderr.strip() if process.stderr else f"返回碼: {process.returncode}"
                            status['results'][module]['errors'].append(f"檔案 '{file_path}' 關鍵字 '{keyword}': {error_msg}")
                        
                    except subprocess.TimeoutExpired:
                        error_msg = f"檔案 '{file_path}' 關鍵字 '{keyword}' 超時"
                        status['results'][module]['errors'].append(error_msg)
                    except Exception as e:
                        error_msg = f"檔案 '{file_path}' 關鍵字 '{keyword}' 錯誤: {str(e)}"
                        status['results'][module]['errors'].append(error_msg)
                    
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
        
        # 發送完成訊息
        stream_queue.put({
            'type': 'complete',
            'total_time': status['total_time'],
            'total_matches': sum(module['total_matches'] for module in status['results'].values())
        })
        
    except Exception as e:
        status['status'] = 'error'
        status['error'] = str(e)
        status['progress'] = 100
        stream_queue.put({
            'type': 'error',
            'message': f"分析過程發生錯誤: {str(e)}"
        })

def read_file_lines(file_path, target_line, context=200, start_line=None, end_line=None):
    """讀取檔案指定行數及其上下文，支援自訂範圍"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        total_lines = len(lines)
        
        # 如果指定了起始和結束行，使用它們
        if start_line is not None and end_line is not None:
            start_line = max(1, min(start_line, total_lines))
            end_line = min(total_lines, max(end_line, start_line))
        else:
            # 否則使用目標行和上下文
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
        'name': f'用戶{len(online_users) + 1}',
        'joined_at': datetime.now()
    }
    emit('user_connected', {'user_id': user_id, 'online_count': len(online_users)})

@socketio.on('disconnect')
def handle_disconnect():
    user_id = request.sid
    if user_id in online_users:
        del online_users[user_id]
    emit('user_disconnected', {'user_id': user_id, 'online_count': len(online_users)}, broadcast=True)

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data['room_id']
    user_name = data.get('user_name', f'用戶{request.sid[:8]}')
    
    join_room(room_id)
    online_users[request.sid]['name'] = user_name
    online_users[request.sid]['current_room'] = room_id
    
    emit('user_joined_room', {
        'user_name': user_name,
        'room_id': room_id
    }, room=room_id)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data['room_id']
    user_name = online_users.get(request.sid, {}).get('name', '匿名用戶')
    
    leave_room(room_id)
    if request.sid in online_users:
        online_users[request.sid].pop('current_room', None)
    
    emit('user_left_room', {
        'user_name': user_name,
        'room_id': room_id
    }, room=room_id)

@socketio.on('send_message')
def handle_send_message(data):
    room_id = data['room_id']
    message = data['message']
    user_name = online_users.get(request.sid, {}).get('name', '匿名用戶')
    
    # 儲存到資料庫
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO chat_messages (room_id, user_name, message, message_type)
        VALUES (?, ?, ?, ?)
    ''', (room_id, user_name, message, 'text'))
    conn.commit()
    conn.close()
    
    emit('new_message', {
        'user_name': user_name,
        'message': message,
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'room_id': room_id
    }, room=room_id)

# API 路由
@app.route('/')
def index():
    return render_template('enhanced_index.html')

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

@app.route('/chat')
def chat_page():
    """聊天室頁面"""
    return render_template('chat.html')

@app.route('/api/browse')
def browse_files():
    """瀏覽檔案API"""
    path = request.args.get('path', '/home/vince_lin/Rust_Project')
    
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
        file_path = os.path.join(upload_dir, file.filename)
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
        
        # 驗證檔案
        valid_files = []
        for f in selected_files:
            if f.startswith('/tmp/uploaded/'):
                # 處理上傳的檔案
                actual_path = os.path.join('uploads', os.path.basename(f))
                if os.path.exists(actual_path):
                    valid_files.append(actual_path)
            elif os.path.exists(f) and os.path.isfile(f):
                valid_files.append(f)
        
        if not valid_files:
            return jsonify({'success': False, 'message': '選擇的檔案都不存在或無法訪問'})
        
        # 啟動流式分析
        analysis_id = str(uuid.uuid4())
        
        # 創建流式隊列
        stream_queue = queue.Queue()
        analysis_streams[analysis_id] = stream_queue
        
        # 儲存分析狀態
        analysis_status[analysis_id] = {
            'status': 'started',
            'progress': 0,
            'total_files': len(valid_files),
            'total_modules': len(config['keywords']),
            'results': {},
            'current_file': '',
            'current_module': '',
            'start_time': datetime.now()
        }
        
        # 在背景執行分析
        thread = threading.Thread(
            target=search_streaming,
            args=(analysis_id, valid_files, config['keywords'])
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'analysis_id': analysis_id,
            'message': '開始流式分析',
            'valid_files_count': len(valid_files)
        })
        
    except Exception as e:
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

@app.route('/api/user_comment', methods=['POST'])
def save_user_comment():
    """儲存用戶評論"""
    try:
        data = request.get_json()
        comment_id = str(uuid.uuid4())
        
        conn = sqlite3.connect('chat_data.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO user_comments (id, analysis_id, module_name, file_path, comment, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (comment_id, data.get('analysis_id'), data.get('module_name'), 
              data.get('file_path'), data.get('comment'), data.get('user_name', '匿名')))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'comment_id': comment_id})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/user_comment/<comment_id>', methods=['GET', 'PUT', 'DELETE'])
def manage_user_comment(comment_id):
    """管理用戶評論"""
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    try:
        if request.method == 'GET':
            cursor.execute('SELECT * FROM user_comments WHERE id = ?', (comment_id,))
            comment = cursor.fetchone()
            if comment:
                return jsonify({
                    'success': True,
                    'comment': {
                        'id': comment[0],
                        'analysis_id': comment[1],
                        'module_name': comment[2],
                        'file_path': comment[3],
                        'comment': comment[4],
                        'created_by': comment[5],
                        'created_at': comment[6]
                    }
                })
            return jsonify({'success': False, 'message': '評論不存在'})
        
        elif request.method == 'PUT':
            data = request.get_json()
            cursor.execute('''
                UPDATE user_comments SET comment = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (data.get('comment'), comment_id))
            conn.commit()
            return jsonify({'success': True, 'message': '評論已更新'})
        
        elif request.method == 'DELETE':
            cursor.execute('DELETE FROM user_comments WHERE id = ?', (comment_id,))
            conn.commit()
            return jsonify({'success': True, 'message': '評論已刪除'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
    finally:
        conn.close()

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

if __name__ == '__main__':
    print("🚀 Enhanced Log 分析平台 v5 啟動中...")
    print("🆕 新增功能：")
    print("   - 增強檔案檢視器 (搜尋、高亮、書籤)")
    print("   - 關鍵字模組管理 (刪除/復原)")
    print("   - 壓縮檔案支援")
    print("   - 聊天室系統")
    print("   - 用戶評論功能")
    print("   - 分析報告生成")
    print("   - 投票和轉盤功能")
    print("=" * 50)
    
    # 確保必要目錄存在
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('uploads/archives', exist_ok=True)
    
    # 初始化資料庫
    init_database()
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)