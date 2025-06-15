// 修復匯出下拉選單被擋住的問題
(function() {
    'use strict';

    // 防止重複下載的標記
    let isExporting = false;
    
    function fixExportDropdownOverflow() {
        console.log('Fixing export dropdown overflow issues...');
        
        // 1. 確保所有父容器都允許 overflow
        $('.export-group').parents().each(function() {
            const $el = $(this);
            const tagName = this.tagName.toLowerCase();
            
            // 跳過 body 和 html
            if (tagName === 'body' || tagName === 'html') return;
            
            // 檢查當前的 overflow 設置
            const overflow = $el.css('overflow');
            const overflowY = $el.css('overflow-y');
            
            // 如果是 file-viewer 或 toolbar，強制設置 overflow: visible
            if ($el.hasClass('file-viewer') || $el.hasClass('toolbar') || $el.hasClass('file-header')) {
                $el.css({
                    'overflow': 'visible !important',
                    'overflow-y': 'visible !important',
                    'overflow-x': 'visible !important'
                });
                console.log(`Fixed overflow for: ${tagName}.${$el.attr('class')}`);
            }
        });
        
        // 2. 將下拉選單移到 body 層級
        moveDropdownToBody();
        
        // 3. 修復 z-index 層級
        fixZIndexLayers();
    }
    
    function moveDropdownToBody() {
        const $dropdown = $('.export-dropdown');
        const $exportGroup = $('.export-group');
        
        if ($dropdown.length === 0) return;
        
        // 保存原始位置的引用
        $exportGroup.data('dropdown-moved', true);
        
        // 移動到 body
        $dropdown.appendTo('body');
        
        // 重新綁定點擊事件
        $('.btn-export').off('click.exportfix').on('click.exportfix', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdownAtPosition();
        });
    }
    
    function toggleDropdownAtPosition() {
        const $dropdown = $('.export-dropdown');
        const $button = $('.btn-export');
        const isOpen = $dropdown.is(':visible');
        
        if (isOpen) {
            // 關閉
            $dropdown.fadeOut(200);
            $('.export-group').removeClass('dropdown-open');
        } else {
            // 計算位置
            const btnOffset = $button.offset();
            const btnHeight = $button.outerHeight();
            const btnWidth = $button.outerWidth();
            
            // 設置位置
            $dropdown.css({
                position: 'fixed',
                top: btnOffset.top + btnHeight + 5,
                left: btnOffset.left,
                width: Math.max(280, btnWidth),
                display: 'block',
                opacity: 0,
                'z-index': 999999
            });
            
            // 檢查是否超出視窗
            const dropdownHeight = $dropdown.outerHeight();
            const windowHeight = $(window).height();
            const windowWidth = $(window).width();
            
            // 調整位置避免超出視窗
            if (btnOffset.top + btnHeight + dropdownHeight > windowHeight) {
                // 顯示在按鈕上方
                $dropdown.css('top', btnOffset.top - dropdownHeight - 5);
            }
            
            if (btnOffset.left + $dropdown.outerWidth() > windowWidth) {
                // 靠右對齊
                $dropdown.css('left', btnOffset.left + btnWidth - $dropdown.outerWidth());
            }
            
            // 顯示動畫
            $dropdown.animate({ opacity: 1 }, 200);
            $('.export-group').addClass('dropdown-open');
        }
    }
    
    function fixZIndexLayers() {
        // 設置各層級的 z-index
        const zIndexMap = {
            '.file-header': 100,
            '.toolbar': 1000,
            '.export-group': 10000,
            '.btn-export': 10001,
            '.export-dropdown': 999999,
            '.context-menu': 999998,
            '.toast-container': 999997
        };
        
        Object.entries(zIndexMap).forEach(([selector, zIndex]) => {
            $(selector).css('z-index', zIndex);
        });
    }

	function exportAllFile() {
		showToast('info', '正在準備下載完整檔案...');
		
		const downloadUrl = `/api/export_file?path=${encodeURIComponent(currentFilePath)}`;
		
		// 創建一個隱藏的 iframe 來下載檔案
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = downloadUrl;
		document.body.appendChild(iframe);
		
		// 5秒後移除 iframe
		setTimeout(() => {
			document.body.removeChild(iframe);
		}, 5000);
		
		showToast('success', '檔案下載已開始');
	}

	// 覆蓋原有的匯出函數
    window.exportPartialFile = function() {
        // 防止重複點擊
        if (isExporting) {
            console.log('Export already in progress...');
            return;
        }
        
        isExporting = true;
        
        try {
            showToast('info', '正在準備匯出當前顯示的內容...');
            
            // 收集當前顯示的所有行
            const lines = [];
            $('.code-line').each(function() {
                const lineNumber = $(this).data('line');
                const content = $(this).find('.line-content').text();
                lines.push(`${lineNumber}: ${content}`);
            });
            
            // 創建 Blob 並下載
            const content = lines.join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            // 使用時間戳確保檔名唯一
            const timestamp = new Date().getTime();
            const fileName = `${currentFilePath.split('/').pop()}_lines_${currentStartLine}-${currentEndLine}_${timestamp}.txt`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            
            // 單次點擊
            a.click();
            
            // 延遲清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                isExporting = false;
            }, 100);
            
            showToast('success', `已匯出第 ${currentStartLine} 到 ${currentEndLine} 行`);
            
        } catch (error) {
            console.error('Export failed:', error);
            showToast('error', '匯出失敗: ' + error.message);
            isExporting = false;
        }
    };
    
    // 綁定視窗調整事件
    $(window).on('resize.exportfix', function() {
        if ($('.export-dropdown').is(':visible')) {
            toggleDropdownAtPosition();
        }
    });
    
    // 點擊其他地方關閉
    $(document).on('click.exportfix', function(e) {
        if (!$(e.target).closest('.export-group, .export-dropdown').length) {
            $('.export-dropdown').fadeOut(200);
            $('.export-group').removeClass('dropdown-open');
        }
    });
    
    // 重新綁定匯出選項
    $(document).on('click', '.export-option', function(e) {
        e.stopPropagation();
        const type = $(this).attr('onclick').includes('all') ? 'all' : 'partial';
        
        // 執行匯出
        if (typeof window.exportFile === 'function') {
            window.exportFile(type);
        }
        
        // 關閉下拉選單
        $('.export-dropdown').fadeOut(200);
        $('.export-group').removeClass('dropdown-open');
    });
    
    // 初始化
    $(document).ready(function() {
        setTimeout(fixExportDropdownOverflow, 300);
		
        // 移除所有既有的點擊事件
        $('.export-option').off('click.export');
        
        // 重新綁定，使用命名空間避免重複
        $('.export-option').on('click.export', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // 阻止事件傳播
            
            // 獲取 onclick 屬性並執行
            const onclickFunc = $(this).attr('onclick');
            if (onclickFunc) {
                // 移除 onclick 屬性避免重複執行
                $(this).removeAttr('onclick');
                
                // 執行函數
                try {
                    eval(onclickFunc);
                } catch (error) {
                    console.error('Execute export function failed:', error);
                }
                
                // 恢復 onclick 屬性
                setTimeout(() => {
                    $(this).attr('onclick', onclickFunc);
                }, 500);
            }
        });		
		
		// 添加觸摸設備支援
		if ('ontouchstart' in window) {
			$('.export-option').on('touchstart', function() {
				$(this).addClass('touch-active');
			}).on('touchend', function() {
				$(this).removeClass('touch-active');
			});
		}		
    });
    
    // 導出調試功能
    window.debugExportOverflow = function() {
        console.log('=== Export Dropdown Debug ===');
        
        // 檢查元素
        console.log('Export button exists:', $('.btn-export').length > 0);
        console.log('Export dropdown exists:', $('.export-dropdown').length > 0);
        console.log('Export dropdown visible:', $('.export-dropdown').is(':visible'));
        console.log('Export dropdown position:', $('.export-dropdown').css('position'));
        console.log('Export dropdown z-index:', $('.export-dropdown').css('z-index'));
        
        // 檢查父元素的 overflow
        console.log('\n=== Parent Elements Overflow ===');
        $('.export-group').parents().each(function() {
            const $el = $(this);
            const tagName = this.tagName.toLowerCase();
            if (tagName === 'body' || tagName === 'html') return;
            
            console.log(`${tagName}.${$el.attr('class')}:`, {
                overflow: $el.css('overflow'),
                'overflow-x': $el.css('overflow-x'),
                'overflow-y': $el.css('overflow-y'),
                'z-index': $el.css('z-index')
            });
        });
        
        // 強制顯示下拉選單
        console.log('\n=== Force showing dropdown ===');
        $('.export-dropdown').css({
            display: 'block',
            opacity: 1,
            'z-index': 999999,
            background: 'yellow',
            border: '2px solid red'
        });
    };
	
	// 修復匯出檔案功能
	window.exportFile = function(type) {
		if (type === 'all') {
			exportAllFile();
		} else {
			exportPartialFile();
		}
		
		// 關閉下拉選單
		$('.export-dropdown').removeClass('show');
		$('.export-group').removeClass('dropdown-open');
	};	
    
})();