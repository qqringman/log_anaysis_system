// Enhanced File Viewer - 完整頁面匯出功能 v2
(function() {
    'use strict';
    
    window.exportHTML = async function() {
        showToast('info', '正在準備匯出完整 HTML 頁面...');
        
        try {
            // 1. 獲取完整的 HTML 結構
            const fullHTML = await buildCompleteHTML();
            
            // 2. 下載檔案
            downloadHTML(fullHTML);
            
            showToast('success', 'HTML 頁面已匯出（包含所有樣式和功能）');
            
        } catch (error) {
            console.error('Export HTML failed:', error);
            showToast('error', '匯出失敗: ' + error.message);
        }
    };
    
    // 構建完整的 HTML
    async function buildCompleteHTML() {
        // 獲取當前頁面的 head 內容
        const headContent = document.head.innerHTML;
        
        // 收集所有內聯樣式
        const inlineStyles = await collectAllInlineStyles();
        
        // 收集所有內聯腳本
        const inlineScripts = await collectAllInlineScripts();
        
        // 獲取 body 內容
        const bodyContent = prepareBodyContent();
        
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title} - 完整匯出</title>
    
    <!-- 匯出時間標記 -->
    <meta name="exported-date" content="${new Date().toISOString()}">
    <meta name="exported-from" content="${window.location.href}">
    
    <!-- Bootstrap CSS -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <!-- Animate.css -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    
    <!-- 內聯所有自定義樣式 -->
    <style type="text/css">
${inlineStyles}

/* 匯出頁面額外樣式 */
.exported-watermark {
    position: fixed;
    top: 30px;
    right: 20px;
    background: rgba(255, 193, 7, 0.9);
    color: #856404;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

/* 確保匯出後的樣式正確 */
body {
    margin: 0;
    padding: 0;
}

/* 隱藏不需要的功能 */
.device-switcher,
.btn-export,
.btn-export-html {
    display: none !important;
}
    </style>
</head>
<body>
${bodyContent}

    <!-- jQuery -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js"></script>
    <!-- Bootstrap Bundle -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js"></script>
    
    <!-- 內聯所有腳本 -->
    <script type="text/javascript">
    // 匯出頁面標記
    window.isExportedHTML = true;
    window.exportedDate = "${new Date().toISOString()}";
    
    // 初始化全域變數
${getGlobalVariables()}

    // 核心功能
${inlineScripts}

    // 初始化匯出頁面
    $(document).ready(function() {
        initializeExportedPage();
    });
    
    function initializeExportedPage() {
        // 添加匯出標記
        $('body').append('<div class="exported-watermark"><i class="fas fa-download me-1"></i>此頁為靜態頁面</div>');
        
        // 恢復書籤和跳轉點
        if (window.bookmarks) {
            bookmarks.forEach(line => {
                $('#line-' + line + ' .line-number').addClass('bookmark');
            });
        }
        
        if (window.jumpPoints) {
            jumpPoints.forEach(line => {
                $('#line-' + line + ' .line-number').addClass('jump-point');
            });
        }
        
        // 恢復高亮
        if (window.highlightColors) {
            Object.entries(highlightColors).forEach(([text, colors]) => {
                colors.forEach(color => {
                    // 重新應用高亮
                    highlightWithColor(text, color);
                });
            });
        }
        
        // 初始化功能
        if (typeof setupKeyboardShortcuts === 'function') {
            setupKeyboardShortcuts();
        }
        
        if (typeof updateStatus === 'function') {
            updateStatus();
        }
        
        // 禁用某些功能
        window.exportFile = function() {
            alert('此功能在匯出的頁面中不可用');
        };
        
        window.exportHTML = function() {
            alert('您已經在查看匯出的頁面');
        };
        
        console.log('Exported page initialized');
    }
    </script>
</body>
</html>`;
        
        return html;
    }
    
    // 收集所有內聯樣式
    async function collectAllInlineStyles() {
        let allStyles = '';
        
        // 1. 獲取所有 <link> 標籤的樣式表
        const cssFiles = [
            '/static/css/file_viewer.css',
            '/static/css/file_viewer_marks.css',
            '/static/css/file_viewer_enhanced.css',
            '/static/css/file_viewer_final.css',
            '/static/css/file_viewer_navigation_fix.css',
            '/static/css/file_viewer_export_fix.css',
            '/static/css/file_viewer_mobile.css'
        ];
        
        // 嘗試從當前頁面獲取實際的 CSS 文件列表
        $('link[rel="stylesheet"]').each(function() {
            const href = $(this).attr('href');
            if (href && href.includes('/static/css/') && !href.includes('cdnjs')) {
                const fileName = href.split('/').pop();
                if (!cssFiles.some(f => f.includes(fileName))) {
                    cssFiles.push(href);
                }
            }
        });
        
        // 載入每個 CSS 文件
        for (const cssFile of cssFiles) {
            try {
                const url = cssFile.startsWith('/') ? window.location.origin + cssFile : cssFile;
                const response = await fetch(url);
                
                if (response.ok) {
                    const cssText = await response.text();
                    allStyles += `\n/* === ${cssFile} === */\n`;
                    allStyles += processCSS(cssText, url);
                }
            } catch (e) {
                console.warn(`Failed to load CSS: ${cssFile}`, e);
            }
        }
        
        // 2. 收集 <style> 標籤的內容
        $('style').each(function() {
            allStyles += '\n/* === Inline Style === */\n';
            allStyles += $(this).text();
        });
        
        // 3. 收集計算後的關鍵樣式
        allStyles += collectComputedStyles();
        
        return allStyles;
    }
    
    // 收集所有內聯腳本
    async function collectAllInlineScripts() {
        let allScripts = '';
        
        // JavaScript 文件列表
        const jsFiles = [
            '/static/js/file_viewer.js',
            '/static/js/file_viewer_marks.js',
            '/static/js/file_viewer_fixes.js',
            '/static/js/file_viewer_enhanced.js',
            '/static/js/file_viewer_final.js',
            '/static/js/file_viewer_navigation_fix.js'
        ];
        
        // 載入每個 JS 文件
        for (const jsFile of jsFiles) {
            try {
                const url = jsFile.startsWith('/') ? window.location.origin + jsFile : jsFile;
                const response = await fetch(url);
                
                if (response.ok) {
                    const jsText = await response.text();
                    allScripts += `\n/* === ${jsFile} === */\n`;
                    allScripts += jsText;
                }
            } catch (e) {
                console.warn(`Failed to load JS: ${jsFile}`, e);
            }
        }
        
        return allScripts;
    }
    
    // 處理 CSS 中的相對路徑
    function processCSS(cssText, baseUrl) {
        // 替換相對路徑為絕對路徑
        return cssText.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
            if (url.startsWith('http') || url.startsWith('data:')) {
                return match;
            }
            
            // 構建絕對 URL
            if (url.startsWith('/')) {
                return `url('${window.location.origin}${url}')`;
            }
            
            const base = new URL(baseUrl);
            const absoluteUrl = new URL(url, base.origin + base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1));
            return `url('${absoluteUrl.href}')`;
        });
    }
    
    // 收集計算後的樣式
    function collectComputedStyles() {
        let computedStyles = '\n/* === Computed Styles === */\n';
        
        // 保存當前的高亮顏色
        for (let i = 1; i <= 10; i++) {
            const elements = $(`.highlight-color-${i}`);
            if (elements.length > 0) {
                const bgColor = elements.first().css('background-color');
                computedStyles += `.highlight-color-${i} { background-color: ${bgColor} !important; }\n`;
            }
        }
        
        // 保存搜尋高亮
        const searchHighlight = $('.search-highlight').first();
        if (searchHighlight.length > 0) {
            const bgColor = searchHighlight.css('background-color');
            computedStyles += `.search-highlight { background-color: ${bgColor} !important; }\n`;
        }
        
        return computedStyles;
    }
    
    // 準備 body 內容
    function prepareBodyContent() {
        const $body = $('body').clone();
        
        // 移除腳本標籤
        $body.find('script').remove();
        
        // 移除不需要的元素
        $body.find('.device-switcher').remove();
        $body.find('.toast-container').empty();
        $body.find('.exported-watermark').remove();
        
        // 保留所有輸入值
        $('input, textarea, select').each(function(index) {
            const $original = $(this);
            const $cloned = $body.find('input, textarea, select').eq(index);
            
            if ($original.is(':checkbox') || $original.is(':radio')) {
                $cloned.prop('checked', $original.prop('checked'));
            } else {
                $cloned.val($original.val());
            }
        });
        
        return $body.html();
    }
    
    // 獲取全域變數
    function getGlobalVariables() {
        return `
    window.currentStartLine = ${window.currentStartLine || 1};
    window.currentEndLine = ${window.currentEndLine || 1};
    window.totalLines = ${window.totalLines || 1};
    window.currentFilePath = '${window.currentFilePath || ''}';
    window.currentTargetLine = ${window.currentTargetLine || 1};
    window.bookmarks = new Set(${JSON.stringify(Array.from(window.bookmarks || []))});
    window.jumpPoints = new Set(${JSON.stringify(Array.from(window.jumpPoints || []))});
    window.highlightColors = ${JSON.stringify(window.highlightColors || {})};
    window.activeHighlightColors = new Set(${JSON.stringify(Array.from(window.activeHighlightColors || []))});
    window.searchResults = [];
    window.currentSearchIndex = 0;
    window.lastSearchText = '${window.lastSearchText || ''}';
    window.useRegex = ${window.useRegex || false};
    window.jumpModeEnabled = ${window.jumpModeEnabled || false};
    window.navigationHistory = [];
    window.historyIndex = -1;
        `;
    }
    
    // 下載 HTML 檔案
    function downloadHTML(content) {
        const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const fileName = `${currentFilePath.split('/').pop()}_exported_${timestamp}.html`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
})();