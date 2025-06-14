// Enhanced Log 分析平台 v6 - 核心配置模組
// static/js/core/config.js

window.appConfig = {
    // 版本資訊
    version: '6.0.0',
    appName: 'Enhanced Log 分析平台',
    
    // API 端點
    api: {
        browse: '/api/browse',
        uploadKeywords: '/api/upload_keywords',
        keywords: '/api/keywords',
        deleteKeyword: '/api/keywords/delete/',
        restoreKeywords: '/api/keywords/restore',
        uploadFile: '/api/upload_file',
        uploadArchive: '/api/upload_archive',
        analyzeStream: '/api/analyze_stream',
        analysisStream: '/api/analysis_stream/',
        shareResult: '/api/share_result',
        shareManager: '/api/share_manager',
        rooms: '/api/rooms',
        roomResources: '/api/room/',
        downloadSample: '/download_sample'
    },
    
    // 全域狀態
    state: {
        currentPath: '/home',
        selectedFiles: [],
        droppedFiles: [],
        keywords: {},
        allSelectMode: false,
        currentAnalysisId: null,
        eventSource: null,
        audioContext: null,
        currentViewMode: 'module',
        minimizedBlocks: new Set(),
        socket: null,
        currentRoom: null,
        userName: '',
        moduleChart: null,
        currentLayout: 'default',
        onlineUsers: [],
        chatRooms: [],
        luckyWheels: {},
        polls: {},
        moduleResults: {}
    },
    
    // 預設設定
    defaults: {
        contextLines: 200,
        animationDuration: 300,
        notificationDuration: 3000,
        streamTimeout: 5000,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        supportedLogExtensions: ['.log', '.txt', '.out', '.err'],
        supportedArchiveExtensions: ['.zip', '.7z', '.tar.gz', '.gz', '.tar']
    },
    
    // 圖表配置
    chart: {
        colors: {
            primary: 'rgba(102, 126, 234, 0.8)',
            primaryBorder: 'rgba(102, 126, 234, 1)',
            success: 'rgba(40, 167, 69, 0.8)',
            danger: 'rgba(220, 53, 69, 0.8)',
            warning: 'rgba(255, 193, 7, 0.8)',
            info: 'rgba(23, 162, 184, 0.8)'
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
    },
    
    // 音效配置
    sounds: {
        notification: {
            frequency: 440,
            duration: 200,
            type: 'sine'
        },
        success: {
            frequency: 587,
            duration: 300,
            type: 'sine'
        },
        error: {
            frequency: 330,
            duration: 400,
            type: 'square'
        },
        broadcast: {
            frequency: 660,
            duration: 500,
            type: 'sine'
        }
    }
};