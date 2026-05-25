let selectedProject = '';
let selectedBranches = [];

let sessionCheckTimer = null;
let branchStatusTimer = null;

// 通用弹窗回调函数
let confirmCallback = null;

console.log('脚本加载完成');

// Toast通知历史记录
let toastHistory = [];
const MAX_TOAST_HISTORY = 50;

// 通用提示Toast函数
// 参数：message-消息内容, type-类型(error/success/warning/info), action-操作名称(可选), saveToHistory-是否保存到历史(默认true)
function showAlert(message, type = 'info', action = '', saveToHistory = true) {
    const container = document.getElementById('toast-container');
    
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 根据类型设置图标
    let icon = 'ℹ️';
    let typeText = '信息';
    switch(type) {
        case 'error':
            icon = '❌';
            typeText = '失败';
            break;
        case 'success':
            icon = '✅';
            typeText = '成功';
            break;
        case 'warning':
            icon = '⚠️';
            typeText = '警告';
            break;
    }
    
    // 构建详细消息
    let displayMessage = message;
    if (action) {
        displayMessage = `<span class="toast-action">${action}</span><span class="toast-detail">${message}</span>`;
    }
    
    // 记录到历史（如果需要），获取其索引
    let historyIndex = -1;
    if (saveToHistory) {
        toastHistory.unshift({
            message: message,
            type: type,
            action: action,
            time: new Date().toLocaleString('zh-CN')
        });
        historyIndex = 0;
        
        // 限制历史记录数量
        if (toastHistory.length > MAX_TOAST_HISTORY) {
            toastHistory.pop();
        }
        
        // 更新历史按钮显示数量
        updateToastHistoryBadge();
    }
    
    // 设置关闭按钮和索引
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    if (historyIndex >= 0) {
        closeBtn.onclick = function() { removeToastFromHistory(historyIndex); };
        // 设置data-history-index属性，用于removeToastFromHistory查找
        toast.dataset.historyIndex = historyIndex;
    } else {
        closeBtn.onclick = function() { this.parentElement.remove(); };
    }
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            ${displayMessage}
        </div>
    `;
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    
    // 5秒后自动移除
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 5000);
}

function updateToastHistoryBadge() {
    const badge = document.getElementById('toast-history-badge');
    if (badge && toastHistory.length > 0) {
        badge.textContent = toastHistory.length;
        badge.style.display = 'inline';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

let isToastHistoryOpen = false;

function showToastHistory() {
    const container = document.getElementById('toast-container');
    const historyBtnGroup = document.getElementById('toast-history-btn-group');
    const historyBtn = document.getElementById('toast-history-btn');
    const historyIndicator = document.getElementById('history-indicator');
    const clearBtn = document.getElementById('history-clear-btn');
    
    // 如果已经打开，关闭它
    if (isToastHistoryOpen) {
        // 清空历史显示
        const existingToasts = container.querySelectorAll('.toast');
        existingToasts.forEach(t => t.remove());
        isToastHistoryOpen = false;
        // 恢复按钮状态
        historyBtnGroup.classList.remove('active');
        historyBtn.classList.remove('active');
        historyIndicator.textContent = '▼';
        clearBtn.style.display = 'none';
        return;
    }
    
    // 清空现有Toast
    const existingToasts = container.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
    
    // 更新按钮状态
    historyBtnGroup.classList.add('active');
    historyBtn.classList.add('active');
    historyIndicator.textContent = '▲';
    // 显示垃圾桶按钮
    if (toastHistory.length > 0) {
        clearBtn.style.display = 'flex';
    }
    
    // 显示历史记录（倒序遍历，最新的在最上面）
    for (let i = toastHistory.length - 1; i >= 0; i--) {
        const item = toastHistory[i];
        const toast = document.createElement('div');
        toast.className = `toast toast-${item.type}`;
        toast.dataset.historyIndex = i;
        
        let icon = 'ℹ️';
        switch(item.type) {
            case 'error':
                icon = '❌';
                break;
            case 'success':
                icon = '✅';
                break;
            case 'warning':
                icon = '⚠️';
                break;
        }
        
        let displayMessage = item.message;
        if (item.action) {
            displayMessage = `<span class="toast-action">${item.action}</span><span class="toast-detail">${item.message}</span>`;
        }
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                ${displayMessage}
                <span class="toast-time">${item.time}</span>
            </div>
            <button class="toast-close" onclick="removeToastFromHistory(${i});">&times;</button>
        `;
        
        container.appendChild(toast);
    }
    
    isToastHistoryOpen = true;
    
    if (toastHistory.length === 0) {
        // 更新按钮状态（让箭头变化）
        historyBtnGroup.classList.add('active');
        historyBtn.classList.add('active');
        historyIndicator.textContent = '▲';
        
        // 直接创建toast，不记录到历史，不加时间
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-info';
        toast.innerHTML = `
            <span class="toast-icon">ℹ️</span>
            <div class="toast-content">
                暂无历史通知
            </div>
            <button class="toast-close" onclick="this.parentElement.remove();">&times;</button>
        `;
        container.appendChild(toast);
        
        // 5秒后自动移除并恢复按钮状态
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
                // 恢复按钮状态
                isToastHistoryOpen = false;
                historyBtnGroup.classList.remove('active');
                historyBtn.classList.remove('active');
                historyIndicator.textContent = '▼';
                clearBtn.style.display = 'none';
            }, 300);
        }, 5000);
    }
}

function clearToastHistory() {
    toastHistory = [];
    updateToastHistoryBadge();
    
    // 清空显示的Toast
    const container = document.getElementById('toast-container');
    const existingToasts = container.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
    
    // 关闭历史视图
    isToastHistoryOpen = false;
    
    // 恢复按钮状态
    const historyBtnGroup = document.getElementById('toast-history-btn-group');
    const historyBtn = document.getElementById('toast-history-btn');
    const historyIndicator = document.getElementById('history-indicator');
    const clearBtn = document.getElementById('history-clear-btn');
    if (historyBtnGroup) historyBtnGroup.classList.remove('active');
    if (historyBtn) historyBtn.classList.remove('active');
    if (historyIndicator) historyIndicator.textContent = '▼';
    if (clearBtn) clearBtn.style.display = 'none';
}

function removeToastFromHistory(index) {
    // 从历史记录中移除
    if (index >= 0 && index < toastHistory.length) {
        toastHistory.splice(index, 1);
        updateToastHistoryBadge();
    }
    
    // 从DOM中移除toast
    const container = document.getElementById('toast-container');
    const toasts = container.querySelectorAll('.toast');
    // 找到对应的toast并移除（通过data-history-index匹配）
    toasts.forEach(t => {
        if (t.dataset.historyIndex && parseInt(t.dataset.historyIndex) === index) {
            t.remove();
        }
    });
    
    // 如果历史空了且面板是打开的，关闭面板
    if (toastHistory.length === 0 && isToastHistoryOpen) {
        isToastHistoryOpen = false;
        const historyBtnGroup = document.getElementById('toast-history-btn-group');
        const historyBtn = document.getElementById('toast-history-btn');
        const historyIndicator = document.getElementById('history-indicator');
        const clearBtn = document.getElementById('history-clear-btn');
        if (historyBtnGroup) historyBtnGroup.classList.remove('active');
        if (historyBtn) historyBtn.classList.remove('active');
        if (historyIndicator) historyIndicator.textContent = '▼';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

// 通用确认弹窗函数
function showConfirm(message, callback, type = 'confirm') {
    const modal = document.getElementById('confirm-modal');
    const icon = document.getElementById('confirm-icon');
    const title = document.getElementById('confirm-title');
    const actionBtn = document.getElementById('confirm-action-btn');
    
    // 保存回调函数
    confirmCallback = callback;
    
    // 根据类型设置图标、标题和按钮样式
    switch(type) {
        case 'delete':
            icon.textContent = '🗑️';
            title.textContent = '确认删除';
            title.style.color = '#c62828';
            // 设置删除按钮样式和图标
            actionBtn.className = 'btn-delete-modal';
            actionBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
            `;
            break;
        case 'warning':
            icon.textContent = '⚠️';
            title.textContent = '确认操作';
            title.style.color = '#e65100';
            // 设置警告按钮样式和图标
            actionBtn.className = 'btn-warning';
            actionBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            break;
        default:
            icon.textContent = '❓';
            title.textContent = '确认';
            title.style.color = '#1976d2';
            // 设置默认确认按钮样式和图标
            actionBtn.className = 'btn-primary';
            actionBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
    }
    
    document.getElementById('confirm-message').innerHTML = message;
    modal.classList.add('show');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('show');
    confirmCallback = null;
}

function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

function startSessionMonitor() {
    if (sessionCheckTimer) {
        clearInterval(sessionCheckTimer);
    }

    sessionCheckTimer = setInterval(() => {
        fetch('/check_session')
            .then(response => response.json())
            .then(data => {
                if (!data.valid) {
                    window.location.href = '/login';
                }
            })
            .catch(() => {});
    }, 30000);
}

function updateSessionActivity() {
    fetch('/check_session').catch(() => {});
}

document.addEventListener('click', function(e) {
    updateSessionActivity();
}, false);
document.addEventListener('keypress', function(e) {
    updateSessionActivity();
}, false);

// 点击外部区域清除分支选中状态（更温和的实现）
document.addEventListener('click', function(e) {
    const target = e.target;
    // 如果点击的不是分支相关的元素，清除选中状态
    const isBranchRelated = target.closest('.branch-row') || 
                           target.closest('.branches-header') ||
                           target.closest('.modal-overlay') ||
                           target.classList.contains('action-btn') ||
                           target.classList.contains('branch-checkbox') ||
                           target.closest('.add-branch-btn') ||
                           target.closest('form') ||
                           target.closest('.batch-actions') ||  // 批量操作按钮区域
                           target.classList.contains('btn-auto-lock') ||  // 自动锁定按钮
                           target.classList.contains('btn-batch-delete') ||  // 批量删除按钮
                           target.classList.contains('btn-batch-lock') ||  // 批量锁定按钮
                           target.classList.contains('btn-batch-unlock') ||  // 批量解锁按钮
                           target.closest('.toggle-switch') ||  // 开关组件
                           target.closest('.project-section');  // 项目区域
    
    if (!isBranchRelated) {
        // 清除所有选中状态
        document.querySelectorAll('.branch-row.selected').forEach(row => {
            row.classList.remove('selected');
        });
        document.querySelectorAll('.branch-checkbox:checked').forEach(cb => {
            cb.checked = false;
        });
        // 清除全选复选框
        document.querySelectorAll('input[id^="select-all-"]').forEach(cb => {
            cb.checked = false;
        });
        // 清空选中状态变量
        selectedBranches = [];
        selectedProject = '';
    }
}, true);

function refreshBranchStatuses() {
    if (branchStatusTimer) {
        clearInterval(branchStatusTimer);
    }

    branchStatusTimer = setInterval(() => {
        fetch('/get_branch_status')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.projects) {
                    Object.keys(data.projects).forEach(project => {
                        const branches = data.projects[project];
                        Object.keys(branches).forEach(branchName => {
                            const status = branches[branchName];
                            const escapedBranch = escapeBranchName(branchName);
                            const statusSpan = document.getElementById(`status-${project}-${escapedBranch}`);
                            const toggleCheckbox = document.getElementById(`toggle-${project}-${escapedBranch}`);
                            
                            // 查找分支名称元素（用于更新🔒图标）
                            const row = document.getElementById(`row-${project}-${escapedBranch}`);
                            const branchNameSpan = row ? row.querySelector('.branch-name') : null;
                            // 查找自动锁定指示器
                            const autoLockIndicator = row ? row.querySelector('.auto-lock-indicator') : null;

                            if (statusSpan && toggleCheckbox) {
                                const isCurrentlyLocked = statusSpan.textContent === '已锁定';
                                const shouldBeLocked = status.locked;
                                const autoLockTime = status.auto_lock_time || 0;
                                const autoLockUnit = status.auto_lock_unit || 'minutes';

                                if (isCurrentlyLocked !== shouldBeLocked) {
                                    if (shouldBeLocked) {
                                        statusSpan.textContent = '已锁定';
                                        statusSpan.className = 'branch-status locked';
                                        toggleCheckbox.checked = true;
                                    } else {
                                        statusSpan.textContent = '已放开';
                                        statusSpan.className = 'branch-status unlocked';
                                        toggleCheckbox.checked = false;
                                    }
                                }
                                
                                // 只要有自动锁定配置，就显示自动锁定指示器（不管分支状态）
                                if (autoLockTime > 0 && !autoLockIndicator) {
                                    const indicatorHtml = createAutoLockIndicator(project, branchName, autoLockTime, autoLockUnit);
                                    const actionsDiv = row.querySelector('.branch-actions');
                                    const statusBtn = actionsDiv ? actionsDiv.querySelector('.branch-status') : null;
                                    if (statusBtn) {
                                        statusBtn.insertAdjacentHTML('beforebegin', indicatorHtml);
                                    }
                                }
                                
                                // 更新🔒图标
                                if (branchNameSpan) {
                                    const currentText = branchNameSpan.textContent;
                                    if (shouldBeLocked && !currentText.startsWith('🔒')) {
                                        branchNameSpan.textContent = '🔒 ' + currentText;
                                    } else if (!shouldBeLocked && currentText.startsWith('🔒 ')) {
                                        branchNameSpan.textContent = currentText.substring(2);
                                    }
                                }
                            }
                        });
                    });
                    bindAutoLockInputEvents();
                }
            })
            .catch(() => {});
    }, 2000);
}

document.addEventListener('DOMContentLoaded', function() {
    restoreExpandState();
    startSessionMonitor();
    refreshBranchStatuses();
    bindAutoLockInputEvents();
});

function bindAutoLockInputEvents() {
    document.querySelectorAll('.auto-lock-indicator').forEach(indicator => {
        indicator.addEventListener('click', function(e) {
            e.stopPropagation();
            const timeSpan = this.querySelector('.auto-lock-time');
            if (timeSpan && !this.querySelector('.auto-lock-input')) {
                handleAutoLockTimeClick(timeSpan);
            }
        });
    });
}

function saveExpandState() {
    const tabContainer = document.getElementById('tab-container');
    const projectsContainer = document.getElementById('projects-container');
    const logContainer = document.getElementById('log-container');

    localStorage.setItem('tabExpanded', tabContainer && tabContainer.style.display !== 'none' ? 'true' : 'false');
    localStorage.setItem('projectsExpanded', projectsContainer && projectsContainer.style.display !== 'none' ? 'true' : 'false');
    localStorage.setItem('logExpanded', logContainer && logContainer.style.display !== 'none' ? 'true' : 'false');

    // 保存当前活动的tab
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab') || activeTab.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
        localStorage.setItem('activeTab', tabId || 'add-project');
    }
}

function restoreExpandState() {
    const tabContainer = document.getElementById('tab-container');
    const projectsContainer = document.getElementById('projects-container');
    const logContainer = document.getElementById('log-container');

    if (tabContainer && localStorage.getItem('tabExpanded') === 'true') {
        tabContainer.style.display = 'block';
        const icon = document.getElementById('tab-toggle-icon');
        if (icon) icon.textContent = '▲';
    }
    if (projectsContainer && localStorage.getItem('projectsExpanded') === 'true') {
        projectsContainer.style.display = 'block';
        const icon = document.getElementById('projects-toggle-icon');
        if (icon) icon.textContent = '▲';
    }
    if (logContainer && localStorage.getItem('logExpanded') === 'true') {
        logContainer.style.display = 'block';
        const icon = document.getElementById('log-toggle-icon');
        if (icon) icon.textContent = '▲';
        // 恢复日志区域时加载带导航按钮的日志
        loadLogs();
    }

    // 恢复当前活动的tab
    const activeTabId = localStorage.getItem('activeTab') || 'add-project';
    switchTab(activeTabId);
}

function refreshPage() {
    saveExpandState();
    location.reload();
}

function toggleEditTimeout() {
    const display = document.getElementById('timeout-wrapper');
    const edit = document.getElementById('timeout-edit-container');
    if (display && edit) {
        display.style.display = 'none';
        edit.style.display = 'inline-flex';
        document.getElementById('session-timeout-input').focus();
    }
}

function saveTimeout() {
    const input = document.getElementById('session-timeout-input');
    const value = parseInt(input.value);
    if (value < 1 || value > 1440) {
        showAlert('超时时间必须在 1-1440 分钟之间', 'warning');
        return;
    }
    fetch('/update_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `session_timeout=${value}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('session-timeout-display').textContent = value;
            cancelEditTimeout();
        } else {
            showAlert('修改分支名', 'success', '修改分支名');
        }
    });
}

function cancelEditTimeout() {
    const display = document.getElementById('timeout-wrapper');
    const edit = document.getElementById('timeout-edit-container');
    if (display && edit) {
        display.style.display = 'inline-flex';
        edit.style.display = 'none';
        document.getElementById('session-timeout-input').value = document.getElementById('session-timeout-display').textContent;
    }
}

function startInlineEditFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    startInlineEdit(project, branch);
}

function startInlineEdit(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const textSpan = document.getElementById(`branch-text-${project}-${escapedBranch}`);
    const input = document.getElementById(`branch-input-${project}-${escapedBranch}`);
    const editBtn = document.getElementById(`edit-btn-${project}-${escapedBranch}`);
    const deleteBtn = document.getElementById(`delete-btn-${project}-${escapedBranch}`);
    const saveBtn = document.getElementById(`save-btn-${project}-${escapedBranch}`);
    const cancelBtn = document.getElementById(`cancel-btn-${project}-${escapedBranch}`);
    if (textSpan && input && editBtn && saveBtn && cancelBtn) {
        textSpan.style.display = 'none';
        input.style.display = 'inline-block';
        input.value = textSpan.textContent.replace(/^🔒\s*/, '');
        editBtn.style.display = 'none';
        // 使用 visibility 替代 display，保持布局空间
        if (deleteBtn) deleteBtn.style.visibility = 'hidden';
        saveBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
        input.focus();
        // 添加回车键保存功能
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveInlineEdit(project, branch);
            }
        };
    }
}

function saveInlineEditFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    saveInlineEdit(project, branch);
}

function saveInlineEdit(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const input = document.getElementById(`branch-input-${project}-${escapedBranch}`);
    const textSpan = document.getElementById(`branch-text-${project}-${escapedBranch}`);
    const newBranchName = input.value.trim();
    if (!newBranchName) {
        showAlert('分支名称不能为空', 'warning', '重命名分支');
        return;
    }
    fetch(`/rename_branch?project=${encodeURIComponent(project)}&old_branch=${encodeURIComponent(branch)}&new_branch=${encodeURIComponent(newBranchName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(`分支 "${branch}" 已重命名为 "${newBranchName}"`, 'success', '重命名分支');
                // 异步更新页面上的分支名，不刷新整个页面
                updateBranchNameOnPage(project, branch, newBranchName);
            } else {
                if (data.error && data.error.includes('分支名已存在')) {
                    showAlert(`分支 "${newBranchName}" 已存在`, 'error', '重命名分支');
                } else {
                    showAlert(data.error || '重命名失败', 'error', '重命名分支');
                }
            }
        });
}

// 异步更新页面上的分支名
function updateBranchNameOnPage(project, oldBranchName, newBranchName) {
    const escapedOldBranch = escapeBranchName(oldBranchName);
    const escapedNewBranch = escapeBranchName(newBranchName);
    
    // 更新分支行 ID
    const branchRow = document.getElementById(`row-${project}-${escapedOldBranch}`);
    if (!branchRow) return;
    
    branchRow.id = `row-${project}-${escapedNewBranch}`;
    
    // 更新分支文本
    const branchText = document.getElementById(`branch-text-${project}-${escapedOldBranch}`);
    if (branchText) {
        // 保持前面的锁图标（如果有）
        const lockIcon = branchText.textContent.trim().startsWith('🔒') ? '🔒 ' : '';
        branchText.textContent = lockIcon + newBranchName;
        branchText.id = `branch-text-${project}-${escapedNewBranch}`;
    }
    
    // 更新分支输入框
    const branchInput = document.getElementById(`branch-input-${project}-${escapedOldBranch}`);
    if (branchInput) {
        branchInput.id = `branch-input-${project}-${escapedNewBranch}`;
    }
    
    // 更新按钮 ID 和 data-branch 属性
    const buttons = branchRow.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.id) {
            btn.id = btn.id.replace(escapedOldBranch, escapedNewBranch);
        }
        
        // 更新 data-branch 属性
        if (btn.dataset.branch === oldBranchName) {
            btn.dataset.branch = newBranchName;
        }
    });
    
    // 更新其他元素 ID（状态、开关等）
    const statusSpan = document.getElementById(`status-${project}-${escapedOldBranch}`);
    if (statusSpan) {
        statusSpan.id = `status-${project}-${escapedNewBranch}`;
    }
    
    const toggleInput = document.getElementById(`toggle-${project}-${escapedOldBranch}`);
    if (toggleInput) {
        toggleInput.id = `toggle-${project}-${escapedNewBranch}`;
        // 更新 data-branch 属性
        if (toggleInput.dataset.branch === oldBranchName) {
            toggleInput.dataset.branch = newBranchName;
        }
    }
    
    const selectCheckbox = document.getElementById(`select-${project}-${escapedOldBranch}`);
    if (selectCheckbox) {
        selectCheckbox.id = `select-${project}-${escapedNewBranch}`;
        // 更新 data-branch 属性
        if (selectCheckbox.dataset.branch === oldBranchName) {
            selectCheckbox.dataset.branch = newBranchName;
        }
    }
    
    // 更新状态后关闭编辑模式
    cancelInlineEdit(project, newBranchName);
}

function cancelInlineEditFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    cancelInlineEdit(project, branch);
}

function cancelInlineEdit(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const textSpan = document.getElementById(`branch-text-${project}-${escapedBranch}`);
    const input = document.getElementById(`branch-input-${project}-${escapedBranch}`);
    const editBtn = document.getElementById(`edit-btn-${project}-${escapedBranch}`);
    const deleteBtn = document.getElementById(`delete-btn-${project}-${escapedBranch}`);
    const saveBtn = document.getElementById(`save-btn-${project}-${escapedBranch}`);
    const cancelBtn = document.getElementById(`cancel-btn-${project}-${escapedBranch}`);
    if (textSpan && input && editBtn && saveBtn && cancelBtn) {
        textSpan.style.display = 'inline';
        input.style.display = 'none';
        editBtn.style.display = 'inline-flex';
        // 恢复删除按钮可见性
        if (deleteBtn) deleteBtn.style.visibility = 'visible';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }
}

function toggleCollapse() {
    const content = document.querySelector('.collapse-content');
    const icon = document.querySelector('.collapse-icon');
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

// 辅助函数：转义分支名称中的特殊字符，与模板中的处理保持一致
function escapeBranchName(branch) {
    return branch.replace(/\//g, '__slash__')
                 .replace(/\\/g, '__backslash__')
                 .replace(/"/g, '__quote__')
                 .replace(/'/g, '__singlequote__');
}

// 辅助函数：转义JavaScript字符串（用于HTML onclick属性）
function escapeJsString(str) {
    // 在HTML onclick属性中，需要转义：
    // 1. 反斜杠（必须在最前面）
    // 2. HTML双引号（避免破坏HTML属性）
    // 3. JavaScript单引号（避免破坏JavaScript字符串）
    return str.replace(/\\/g, '\\\\').replace(/"/g, '&quot;').replace(/'/g, "\'");
}

// 辅助函数：HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 创建自动锁定指示器元素
function createAutoLockIndicator(project, branch, autoLockTime, autoLockUnit) {
    const displayValue = Number.isInteger(autoLockTime) ? autoLockTime : autoLockTime.toFixed(1);
    const displayUnit = autoLockUnit === 'hours' ? '小时' : '分钟';
    
    return `
        <div class="auto-lock-indicator">
            <span class="auto-lock-icon">⏰</span>
            <span class="auto-lock-time" data-project="${project}" data-branch="${branch}" 
                  data-auto-lock-time="${autoLockTime}" data-auto-lock-unit="${autoLockUnit}"
                  title="点击编辑自动锁定时间">${displayValue}</span>
            <span class="auto-lock-unit">${displayUnit}</span>
        </div>
    `;
}

// 自动锁定时间点击编辑处理函数
function handleAutoLockTimeClick(span) {
    const project = span.dataset.project;
    const branch = span.dataset.branch;
    const currentTime = span.dataset.autoLockTime;
    const currentUnit = span.dataset.autoLockUnit;
    const currentValue = span.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'auto-lock-input';
    input.value = currentValue;
    input.dataset.project = project;
    input.dataset.branch = branch;
    input.dataset.autoLockTime = currentTime;
    input.dataset.autoLockUnit = currentUnit;
    
    input.addEventListener('blur', function(e) {
        e.stopPropagation();
        handleAutoLockInputBlur(this, span);
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        } else if (e.key === 'Escape') {
            span.style.display = '';
            this.remove();
        }
    });
    
    span.style.display = 'none';
    span.parentNode.insertBefore(input, span.nextSibling);
    input.select();
    input.focus();
}

// 自动锁定时间输入框失去焦点处理函数
function handleAutoLockInputBlur(input, span) {
    const project = input.dataset.project;
    const branch = input.dataset.branch;
    const currentTime = parseFloat(input.dataset.autoLockTime);
    const currentUnit = input.dataset.autoLockUnit;
    
    if (!project || !branch || isNaN(currentTime)) {
        span.textContent = currentTime;
        span.style.display = '';
        input.remove();
        return;
    }
    
    const inputValue = input.value.trim();
    const newValue = parseInt(inputValue, 10);
    
    if (isNaN(newValue) || newValue <= 0) {
        span.textContent = currentTime;
        span.style.display = '';
        input.remove();
        return;
    }
    
    fetch('/set_auto_lock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&minutes=${newValue}&unit=${currentUnit}`,
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const displayUnit = currentUnit === 'hours' ? '小时' : '分钟';
            span.textContent = newValue;
            span.dataset.autoLockTime = newValue;
            span.style.display = '';
            input.remove();
            showAlert(`自动锁定时间已更新为 ${newValue}${displayUnit}`, 'success', '修改自动锁定时间');
        } else {
            span.textContent = currentTime;
            span.style.display = '';
            input.remove();
            showAlert('更新失败: ' + (data.error || '未知错误'), 'error', '修改自动锁定时间');
        }
    })
    .catch(error => {
        span.textContent = currentTime;
        span.style.display = '';
        input.remove();
        showAlert('更新失败，请重试', 'error', '修改自动锁定时间');
    });
}

// 辅助函数：将转义后的分支名称还原为原始名称
function unescapeBranchName(escapedBranch) {
    return escapedBranch.replace(/__slash__/g, '/')
                       .replace(/__backslash__/g, '\\')
                       .replace(/__quote__/g, '"')
                       .replace(/__singlequote__/g, "'");
}

// 更新分支锁定状态UI（统一函数，便于复用和更健壮的DOM查找）
function updateBranchLockUI(project, branch, isLocked) {
    const escapedBranch = escapeBranchName(branch);
    
    // 尝试多种方式查找分支行元素
    let row = document.getElementById(`row-${project}-${escapedBranch}`);
    
    // 如果没找到，尝试使用CSS转义
    if (!row) {
        const escapedProject = CSS.escape(project);
        row = document.getElementById(`row-${escapedProject}-${escapedBranch}`);
    }
    
    // 如果还是没找到，尝试通过分支名称查找
    if (!row) {
        const rows = document.querySelectorAll('.branch-row');
        for (const r of rows) {
            const nameSpan = r.querySelector('.branch-name');
            if (nameSpan) {
                const cleanName = nameSpan.textContent.replace('🔒 ', '').trim();
                if (cleanName === branch) {
                    row = r;
                    break;
                }
            }
        }
    }
    
    // 如果找到了行元素，更新UI
    if (row) {
        const statusSpan = row.querySelector('.branch-status') || document.getElementById(`status-${project}-${escapedBranch}`);
        const branchNameSpan = row.querySelector('.branch-name');
        const toggleCheckbox = row.querySelector('.toggle-switch input[type="checkbox"]') || document.getElementById(`toggle-${project}-${escapedBranch}`);
        
        if (statusSpan) {
            statusSpan.textContent = isLocked ? '已锁定' : '已放开';
            statusSpan.className = isLocked ? 'branch-status locked' : 'branch-status unlocked';
        }
        if (toggleCheckbox) {
            toggleCheckbox.checked = isLocked;
        }
        if (branchNameSpan) {
            const currentText = branchNameSpan.textContent;
            if (isLocked && !currentText.startsWith('🔒')) {
                branchNameSpan.textContent = '🔒 ' + currentText;
            } else if (!isLocked && currentText.startsWith('🔒 ')) {
                branchNameSpan.textContent = currentText.substring(2);
            }
        }
        
        // 如果是锁定状态，清除自动锁定指示器
        if (isLocked) {
            const autoLockIndicator = row.querySelector('.auto-lock-indicator');
            if (autoLockIndicator) {
                autoLockIndicator.remove();
            }
            // 清除前端定时器
            const timerKey = `auto_lock_${project}_${escapedBranch}`;
            if (window[timerKey]) {
                clearTimeout(window[timerKey]);
                delete window[timerKey];
            }
        }
    } else {
        console.warn(`未找到分支行: ${project}/${branch}`);
    }
}

function getBranchNameSpan(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const row = document.getElementById(`row-${project}-${escapedBranch}`);
    return row ? row.querySelector('.branch-name') : null;
}

function getBranchRow(project, branch) {
    const escapedProject = CSS.escape(project);
    const escapedBranch = CSS.escape(branch);
    return document.getElementById(`row-${escapedProject}-${escapedBranch}`);
}

function toggleBranchFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    toggleBranch(project, branch);
}

function toggleBranch(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const checkbox = document.getElementById(`toggle-${project}-${escapedBranch}`);
    if (!checkbox) {
        console.error('Checkbox not found:', `toggle-${project}-${escapedBranch}`);
        return;
    }
    const status = checkbox.checked ? 'lock' : 'unlock';
    const originalChecked = checkbox.checked;

    fetch(`/toggle_branch?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&status=${status}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络请求失败: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const statusSpan = document.getElementById(`status-${project}-${escapedBranch}`);
                const branchNameSpan = getBranchNameSpan(project, branch);
                // 清除分支选择复选框的选中状态和行的选中样式
                const selectCheckbox = document.getElementById(`select-${project}-${escapedBranch}`);
                const row = document.getElementById(`row-${project}-${escapedBranch}`);
                if (selectCheckbox) {
                    selectCheckbox.checked = false;
                }
                if (row) {
                    row.classList.remove('selected');
                }
                // 从选中数组中移除
                selectedBranches = selectedBranches.filter(b => b !== branch);
                if (status === 'lock') {
                    statusSpan.textContent = '已锁定';
                    statusSpan.className = 'branch-status locked';
                    if (branchNameSpan && !branchNameSpan.textContent.startsWith('🔒')) {
                        branchNameSpan.textContent = '🔒 ' + branchNameSpan.textContent;
                    }
                    // 取消之前的自动锁定定时器
                    const timerKey = `auto_lock_${project}_${escapedBranch}`;
                    if (window[timerKey]) {
                        clearTimeout(window[timerKey]);
                        delete window[timerKey];
                    }
                    // 显示锁定成功通知
                    showAlert(`分支 "${branch}" 已锁定`, 'success', '锁定分支');
                } else {
                    statusSpan.textContent = '已放开';
                    statusSpan.className = 'branch-status unlocked';
                    if (branchNameSpan && branchNameSpan.textContent.startsWith('🔒 ')) {
                        branchNameSpan.textContent = branchNameSpan.textContent.substring(2);
                    }
                    
                    // 检查是否有自动锁定设置，如果有则启动定时器
                    const row = document.getElementById(`row-${project}-${escapedBranch}`);
                    // 自动锁定由后端周期性检查器处理，前端不再启动定时器
                    // 显示放开成功通知
                    showAlert(`分支 "${branch}" 已放开`, 'success', '放开分支');
                }
            } else {
                checkbox.checked = !originalChecked;
                showAlert(`分支 "${branch}" 操作失败`, 'error', status === 'lock' ? '锁定分支' : '放开分支');
            }
        })
        .catch(error => {
            checkbox.checked = !originalChecked;
            console.error('切换失败:', error);
            showAlert(`分支 "${branch}" 操作失败: ` + error.message, 'error', status === 'lock' ? '锁定分支' : '放开分支');
        });
}

// 启动自动锁定定时器
function startAutoLockTimer(project, branch, minutes) {
    const escapedBranch = escapeBranchName(branch);
    const timerKey = `auto_lock_${project}_${escapedBranch}`;
    
    // 清除之前的定时器（如果存在）
    if (window[timerKey]) {
        clearTimeout(window[timerKey]);
    }
    
    // 设置新的定时器
    window[timerKey] = setTimeout(() => {
        // 自动锁定分支
        fetch(`/toggle_branch?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&status=lock`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 更新UI - 使用更健壮的方式查找元素
                    updateBranchLockUI(project, branch, true);
                }
            })
            .catch(error => {
                console.error('自动锁定失败:', error);
            });
        
        // 清除定时器引用
        delete window[timerKey];
    }, minutes * 60 * 1000);
}

function closeUnlockModal() {
    document.getElementById('unlock-modal').classList.remove('show');
    document.getElementById('auto-lock-enable').checked = false;
    document.getElementById('auto-lock-settings').style.display = 'none';
    const savedMinutes = localStorage.getItem('autoLockMinutes') || '5';
    document.getElementById('auto-lock-minutes').value = savedMinutes;
    const savedUnit = localStorage.getItem('autoLockUnit') || 'minutes';
    document.getElementById('auto-lock-unit').value = savedUnit;
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.remove('show');
}

function toggleTabContainer() {
    const container = document.getElementById('tab-container');
    const icon = document.getElementById('tab-toggle-icon');

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display === 'none') {
        container.style.display = 'block';
        icon.textContent = '▲';
    } else {
        container.style.display = 'none';
        icon.textContent = '▼';
    }
}

function toggleProjectsContainer() {
    const container = document.getElementById('projects-container');
    const icon = document.getElementById('projects-toggle-icon');

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display === 'none') {
        container.style.display = 'block';
        icon.textContent = '▲';
    } else {
        container.style.display = 'none';
        icon.textContent = '▼';
    }
}

function toggleLogContainer() {
    const container = document.getElementById('log-container');
    const icon = document.getElementById('log-toggle-icon');

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display === 'none') {
        container.style.display = 'block';
        icon.textContent = '▲';
        // 首次展开时加载日志（带导航按钮）
        loadLogs();
    } else {
        container.style.display = 'none';
        icon.textContent = '▼';
    }
}

function batchUnlockSelected() {
    if (selectedBranches.length === 0) {
        showAlert('请先选择分支', 'warning', '批量锁定');
        return;
    }
    if (!selectedProject) {
        showAlert('请选择项目', 'warning', '批量锁定');
        return;
    }

    // 打开自动锁定设置弹窗
    const modal = document.getElementById('unlock-modal');
    modal.classList.add('show');

    // 填充项目名称
    document.getElementById('unlock-project-name').textContent = selectedProject;

    // 填充分支列表
    const branchesBody = document.getElementById('modal-branches');
    branchesBody.innerHTML = '';
    selectedBranches.forEach((branch, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${branch}</td>
        `;
        branchesBody.appendChild(row);
    });

    // 恢复保存的设置
    const savedMinutes = localStorage.getItem('autoLockMinutes') || '5';
    const savedUnit = localStorage.getItem('autoLockUnit') || 'minutes';
    document.getElementById('auto-lock-minutes').value = savedMinutes;
    document.getElementById('auto-lock-unit').value = savedUnit;
}

function confirmUnlock() {
    const project = selectedProject;
    const enabled = document.getElementById('auto-lock-enable').checked;
    let minutes = 0;
    let displayValue = 0;
    let displayUnit = '分钟';
    let unit = 'minutes';
    if (enabled) {
        displayValue = parseInt(document.getElementById('auto-lock-minutes').value) || 0;
        unit = document.getElementById('auto-lock-unit').value;
        // 根据单位转换为分钟（用于前端定时器）
        minutes = unit === 'hours' ? displayValue * 60 : displayValue;
        displayUnit = unit === 'hours' ? '小时' : '分钟';
    }

    localStorage.setItem('autoLockMinutes', document.getElementById('auto-lock-minutes').value);
    localStorage.setItem('autoLockUnit', document.getElementById('auto-lock-unit').value);

    if (selectedBranches.length > 0) {
        // 传递原始值 displayValue，让后端根据单位进行转换
        fetch(`/batch_unlock_selected?project=${encodeURIComponent(project)}&branches=${encodeURIComponent(selectedBranches.join(','))}&auto_lock=${displayValue}&auto_lock_unit=${unit}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    closeUnlockModal();
                    selectedBranches.forEach(branch => {
                        const escapedBranch = escapeBranchName(branch);
                        const statusSpan = document.getElementById(`status-${project}-${escapedBranch}`);
                        const branchNameSpan = getBranchNameSpan(project, branch);
                        const toggleCheckbox = document.getElementById(`toggle-${project}-${escapedBranch}`);

                        if (statusSpan) {
                            statusSpan.textContent = '已放开';
                            statusSpan.className = 'branch-status unlocked';
                        }
                        if (toggleCheckbox) {
                            toggleCheckbox.checked = false;
                        }
                        if (branchNameSpan && branchNameSpan.textContent.startsWith('🔒 ')) {
                            branchNameSpan.textContent = branchNameSpan.textContent.substring(2);
                        }
                        
                        const row = document.getElementById(`row-${project}-${escapedBranch}`);
                        if (row) {
                            const oldIndicator = row.querySelector('.auto-lock-indicator');
                            if (oldIndicator) {
                                oldIndicator.remove();
                            }
                            
                            if (minutes > 0) {
                                const indicatorHtml = createAutoLockIndicator(project, branch, minutes, unit);
                                // 创建临时容器来解析HTML字符串
                                const tempContainer = document.createElement('div');
                                tempContainer.innerHTML = indicatorHtml;
                                const indicator = tempContainer.firstChild;
                                const statusSpan = row.querySelector('.branch-status');
                                if (statusSpan) {
                                    statusSpan.parentNode.insertBefore(indicator, statusSpan);
                                } else {
                                    const actionsDiv = row.querySelector('.branch-actions');
                                    if (actionsDiv) {
                                        actionsDiv.insertBefore(indicator, actionsDiv.firstChild);
                                    }
                                }
                            }
                        }
                    });
                    // 先获取数量，再清空选中状态
                    const 放开数量 = selectedBranches.length;
                    selectedBranches = [];
                    document.querySelectorAll(`.branch-checkbox[id^="select-${project}-"]`).forEach(cb => {
                        cb.checked = false;
                        // 移除行的选中样式
                        const escapedBranch = cb.id.replace(`select-${project}-`, '');
                        const row = document.getElementById(`row-${project}-${escapedBranch}`);
                        if (row) {
                            row.classList.remove('selected');
                        }
                    });
                    const selectAllCheckbox = document.getElementById(`select-all-${project}`);
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                    }
                    // 显示批量放开成功通知
                    const autoLockMsg = minutes > 0 ? `，${displayValue}${displayUnit}后自动锁定` : '';
                    showAlert(`已成功放开 ${放开数量} 个分支${autoLockMsg}`, 'success', '批量放开');
                } else {
                    showAlert(`批量放开失败: ` + (data.error || '未知错误'), 'error', '批量放开');
                }
            })
            .catch(error => {
                console.error('放开失败:', error);
                showAlert(`批量放开失败: ` + error.message, 'error', '批量放开');
            });
    } else {
        // 如果没有选中分支，直接关闭弹窗
        closeUnlockModal();
    }
}

function toggleAutoLock() {
    const enabled = document.getElementById('auto-lock-enable').checked;
    document.getElementById('auto-lock-settings').style.display = enabled ? 'block' : 'none';
}

function toggleBranchSelectFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    toggleBranchSelect(project, branch);
}

function toggleBranchSelect(project, branch) {
    const escapedBranch = escapeBranchName(branch);
    const checkbox = document.getElementById(`select-${project}-${escapedBranch}`);
    const row = document.getElementById(`row-${project}-${escapedBranch}`);

    // 直接使用 checkbox.checked 的当前值（点击后浏览器已经更新了这个值）
    if (checkbox.checked) {
        if (!selectedBranches.includes(branch)) {
            selectedBranches.push(branch);
        }
        row.classList.add('selected');
    } else {
        selectedBranches = selectedBranches.filter(b => b !== branch);
        row.classList.remove('selected');
    }
    selectedProject = project;
    refreshBranchStatuses();
}

function toggleSelectAll(project) {
    const checkboxes = document.querySelectorAll(`input[id^="select-${project}-"]`);
    const allChecked = document.getElementById(`select-all-${project}`).checked;

    checkboxes.forEach(checkbox => {
        checkbox.checked = allChecked;
        // 获取转义后的分支名称
        const escapedBranch = checkbox.id.replace(`select-${project}-`, '');
        const row = document.getElementById(`row-${project}-${escapedBranch}`);
        
        // 将转义后的名称还原为原始分支名称
        const originalBranch = unescapeBranchName(escapedBranch);

        if (allChecked) {
            if (!selectedBranches.includes(originalBranch)) {
                selectedBranches.push(originalBranch);
            }
            row.classList.add('selected');
        } else {
            selectedBranches = selectedBranches.filter(b => b !== originalBranch);
            row.classList.remove('selected');
        }
    });
    selectedProject = project;
    refreshBranchStatuses();
}

function batchLockSelected() {
    if (selectedBranches.length === 0) {
        showAlert('请先选择分支', 'warning');
        return;
    }
    if (!selectedProject) {
        showAlert('请选择项目', 'warning');
        return;
    }

    fetch(`/batch_lock_selected?project=${encodeURIComponent(selectedProject)}&branches=${encodeURIComponent(selectedBranches.join(','))}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 更新每个锁定分支的UI
                selectedBranches.forEach(branch => {
                    const escapedBranch = escapeBranchName(branch);
                    const statusSpan = document.getElementById(`status-${selectedProject}-${escapedBranch}`);
                    const branchNameSpan = getBranchNameSpan(selectedProject, branch);
                    const toggleCheckbox = document.getElementById(`toggle-${selectedProject}-${escapedBranch}`);

                    if (statusSpan) {
                        statusSpan.textContent = '已锁定';
                        statusSpan.className = 'branch-status locked';
                    }
                    if (toggleCheckbox) {
                        toggleCheckbox.checked = true;
                    }
                    if (branchNameSpan && !branchNameSpan.textContent.startsWith('🔒')) {
                        branchNameSpan.textContent = '🔒 ' + branchNameSpan.textContent;
                    }
                });
                // 先获取数量，再清空选中状态
                const 锁定数量 = selectedBranches.length;
                selectedBranches = [];
                document.querySelectorAll(`.branch-checkbox[id^="select-${selectedProject}-"]`).forEach(cb => {
                    cb.checked = false;
                    // 移除行的选中样式
                    const escapedBranch = cb.id.replace(`select-${selectedProject}-`, '');
                    const row = document.getElementById(`row-${selectedProject}-${escapedBranch}`);
                    if (row) {
                        row.classList.remove('selected');
                    }
                });
                const selectAllCheckbox = document.getElementById(`select-all-${selectedProject}`);
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                }
                // 显示批量锁定成功通知
                showAlert(`已成功锁定 ${data.success_count || 锁定数量} 个分支`, 'success', '批量锁定');
            } else {
                showAlert(`批量锁定失败: ` + (data.error || '未知错误'), 'error', '批量锁定');
            }
        })
        .catch(error => {
            console.error('锁定请求失败:', error);
            showAlert(`批量锁定失败: ` + error.message, 'error', '批量锁定');
        });
}

function batchDeleteSelected() {
    if (selectedBranches.length === 0) {
        showAlert('请先选择分支', 'warning', '批量删除');
        return;
    }
    if (!selectedProject) {
        showAlert('请选择项目', 'warning', '批量删除');
        return;
    }

    // 打开删除确认模态框
    const modal = document.getElementById('delete-modal');
    modal.classList.add('show');

    // 填充项目名称
    document.getElementById('delete-project-name').textContent = selectedProject;

    // 填充分支列表
    const branchesBody = document.getElementById('delete-branches');
    branchesBody.innerHTML = '';
    selectedBranches.forEach((branch, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${branch}</td>
        `;
        branchesBody.appendChild(row);
    });
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('show');
}

// 单个分支删除确认
function showDeleteBranchConfirmFromElement(element) {
    const project = element.dataset.project;
    const branch = element.dataset.branch;
    showDeleteBranchConfirm(project, branch);
}

function showDeleteBranchConfirm(project, branch) {
    showConfirm(`确定要删除分支 "${branch}" 吗？`, function() {
        fetch(`/del_branch?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const escapedBranch = escapeBranchName(branch);
                    const row = document.getElementById(`row-${project}-${escapedBranch}`);
                    if (row) {
                        row.remove();
                    }
                    // 从选中状态中移除已删除的分支
                    selectedBranches = selectedBranches.filter(b => b !== branch);
                    // 如果删除后没有选中的分支，清除选中项目
                    if (selectedBranches.length === 0) {
                        selectedProject = '';
                    }
                    // 更新项目分支统计数
                    const badgeElement = document.querySelector(`[data-project="${project}"] .badge`);
                    if (badgeElement) {
                        const currentCount = parseInt(badgeElement.textContent) || 0;
                        const newCount = Math.max(0, currentCount - 1);
                        badgeElement.textContent = `${newCount} 个管理分支`;
                    }
                    showAlert(`分支 "${branch}" 删除成功`, 'success', '删除分支');
                } else {
                    showAlert(`分支 "${branch}" 删除失败: ` + (data.error || '未知错误'), 'error', '删除分支');
                }
            })
            .catch(error => {
                console.error('删除失败:', error);
                showAlert(`分支 "${branch}" 删除失败，请重试`, 'error', '删除分支');
            });
    }, 'delete');
}

function confirmDelete() {
    const project = selectedProject;

    if (selectedBranches.length > 0) {
        fetch(`/batch_delete_branches?project=${encodeURIComponent(project)}&branches=${encodeURIComponent(selectedBranches.join(','))}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络请求失败');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const deleteCount = selectedBranches.length;
                    // 更新UI，移除删除的分支
                    selectedBranches.forEach(branch => {
                        const escapedBranch = escapeBranchName(branch);
                        const row = document.getElementById(`row-${project}-${escapedBranch}`);
                        if (row) {
                            row.remove();
                        }
                    });
                    // 清除选择状态
                    selectedBranches = [];
                    selectedProject = '';
                    document.querySelectorAll(`.branch-checkbox[id^="select-${project}-"]`).forEach(cb => cb.checked = false);
                    document.getElementById(`select-all-${project}`).checked = false;
                    
                    // 刷新分支状态统计
                    refreshBranchStatuses();
                    
                    // 更新项目分支统计数
                    const badgeElement = document.querySelector(`[data-project="${project}"] .badge`);
                    if (badgeElement) {
                        // 获取当前显示的数量并减1
                        const currentCount = parseInt(badgeElement.textContent) || 0;
                        const newCount = Math.max(0, currentCount - deleteCount);
                        badgeElement.textContent = `${newCount} 个管理分支`;
                    }
                    
                    // 显示删除成功通知
                    showAlert(`已成功删除 ${deleteCount} 个分支`, 'success', '批量删除');
                    
                    // 关闭模态框
                    closeDeleteModal();
                } else {
                    showAlert('删除失败: ' + (data.error || '未知错误'), 'error', '删除分支');
                }
            })
            .catch(error => {
                console.error('删除请求失败:', error);
                showAlert('删除失败，请重试', 'error', '删除项目');
            });
    } else {
        closeDeleteModal();
    }
}

function scheduleLockSelected() {
    if (selectedBranches.length === 0) {
        showAlert('请先选择分支', 'warning');
        return;
    }
    if (!selectedProject) {
        showAlert('请选择项目', 'warning');
        return;
    }

    // 获取选中分支的现有自动锁定设置
    fetch(`/get_project_branches?project=${encodeURIComponent(selectedProject)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const branches = data.branches;
                let hasAutoLock = false;
                let autoLockTime = 5;
                let autoLockUnit = 'minutes';
                
                // 检查选中分支的自动锁定设置
                selectedBranches.forEach(branch => {
                    const escapedBranch = escapeBranchName(branch);
                    const found = branches.find(b => {
                        const bName = b.name || b;
                        const escapedBName = escapeBranchName(bName);
                        return escapedBName === escapedBranch;
                    });
                    
                    if (found && found.auto_lock_time > 0) {
                        hasAutoLock = true;
                        autoLockTime = found.auto_lock_time;
                        autoLockUnit = found.auto_lock_unit || 'minutes';
                    }
                });
                
                // 打开定时锁定设置弹窗
                const modal = document.getElementById('schedule-modal');
                modal.classList.add('show');

                // 填充项目名称
                document.getElementById('schedule-project-name').textContent = selectedProject;

                // 填充分支列表
                const branchesBody = document.getElementById('schedule-branches');
                branchesBody.innerHTML = '';
                selectedBranches.forEach((branch, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${branch}</td>
                    `;
                    branchesBody.appendChild(row);
                });
                
                // 设置默认值为现有设置（如果有的话）
                document.getElementById('schedule-minutes').value = autoLockTime;
                document.getElementById('schedule-unit').value = autoLockUnit;
            }
        })
        .catch(error => {
            console.error('获取分支信息失败:', error);
            // 如果获取失败，使用默认值打开弹窗
            const modal = document.getElementById('schedule-modal');
            modal.classList.add('show');
            document.getElementById('schedule-project-name').textContent = selectedProject;
            
            const branchesBody = document.getElementById('schedule-branches');
            branchesBody.innerHTML = '';
            selectedBranches.forEach((branch, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${branch}</td>
                `;
                branchesBody.appendChild(row);
            });
        });
}

function confirmScheduleLock() {
    const project = selectedProject;
    const displayValue = parseInt(document.getElementById('schedule-minutes').value) || 0;
    const unit = document.getElementById('schedule-unit').value;
    const displayUnit = unit === 'hours' ? '小时' : '分钟';
    // 根据单位转换为分钟
    const minutes = unit === 'hours' ? displayValue * 60 : displayValue;

    if (selectedBranches.length > 0) {
        fetch(`/schedule_lock?project=${encodeURIComponent(project)}&branches=${encodeURIComponent(selectedBranches.join(','))}&minutes=${displayValue}&unit=${unit}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    closeScheduleModal();
                    showAlert(`自动锁定设置成功：${data.success_count || selectedBranches.length} 个分支将在${displayValue}${displayUnit}后自动锁定`, 'success', '设置自动锁定');
                    
                    // 设置自动锁定时间后，只显示时间指示器，不改变当前锁定状态
                    try {
                        selectedBranches.forEach(branch => {
                            const escapedBranch = escapeBranchName(branch);
                            
                            // 查找分支行
                            const row = document.getElementById(`row-${project}-${escapedBranch}`);
                            if (row) {
                                // 检查是否已有自动锁定指示器
                                let indicator = row.querySelector('.auto-lock-indicator');
                                if (displayValue > 0) {
                                    if (!indicator) {
                                        const indicatorHtml = createAutoLockIndicator(project, branch, displayValue, unit);
                                        // 创建临时容器来解析HTML字符串
                                        const tempContainer = document.createElement('div');
                                        tempContainer.innerHTML = indicatorHtml;
                                        indicator = tempContainer.firstChild;
                                        const statusSpan = row.querySelector('.branch-status');
                                        if (statusSpan) {
                                            statusSpan.parentNode.insertBefore(indicator, statusSpan);
                                        } else {
                                            const actionsDiv = row.querySelector('.branch-actions');
                                            if (actionsDiv) {
                                                actionsDiv.insertBefore(indicator, actionsDiv.firstChild);
                                            }
                                        }
                                    }
                                    // 确保indicator是有效的DOM元素
                                    if (indicator && indicator.querySelector) {
                                        const timeSpan = indicator.querySelector('.auto-lock-time');
                                        const unitSpan = indicator.querySelector('.auto-lock-unit');
                                        if (timeSpan) {
                                            timeSpan.textContent = displayValue;
                                            timeSpan.dataset.autoLockTime = displayValue;
                                        }
                                        if (unitSpan) {
                                            unitSpan.textContent = unit === 'hours' ? '小时' : '分钟';
                                        }
                                    }
                                } else {
                                    // 移除自动锁定指示器
                                    if (indicator) {
                                        indicator.remove();
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.error('更新自动锁定指示器失败:', e);
                    }
                    
                    // 清除选择状态 - 确保这部分代码总是执行
                    selectedBranches = [];
                    document.querySelectorAll(`.branch-checkbox[id^="select-${project}-"]`).forEach(cb => {
                        cb.checked = false;
                        // 移除行的选中样式
                        const escapedBranch = cb.id.replace(`select-${project}-`, '');
                        const row = document.getElementById(`row-${project}-${escapedBranch}`);
                        if (row) {
                            row.classList.remove('selected');
                        }
                    });
                    const selectAllCb = document.getElementById(`select-all-${project}`);
                    if (selectAllCb) selectAllCb.checked = false;
                } else {
                    showAlert('定时锁定设置失败', 'error', '设置自动锁定');
                }
            });
    }
}

function switchTab(tabId) {
    // 隐藏所有tab内容
    document.querySelectorAll('.tab-panel').forEach(content => {
        content.style.display = 'none';
    });

    // 移除所有tab按钮的active类
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 显示选中的tab内容
    const selectedContent = document.getElementById(`tab-${tabId}`);
    if (selectedContent) {
        selectedContent.style.display = 'block';
    }

    // 添加active类到选中的tab按钮（使用data-tab属性）
    const selectedBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}

function toggleAddMode() {
    const mode = document.getElementById('add-mode').value;
    const scanMode = document.getElementById('scan-mode');
    const manualMode = document.getElementById('manual-mode');
    const scanResults = document.getElementById('scanResults');

    if (mode === 'scan') {
        scanMode.style.display = 'flex';
        manualMode.style.display = 'none';
    } else {
        scanMode.style.display = 'none';
        manualMode.style.display = 'flex';
        // 切换到手动添加时清理扫描结果
        if (scanResults) {
            scanResults.innerHTML = '';
            scanResults.style.display = 'none';
        }
    }
}

function submitScan() {
    const basePath = document.getElementById('base-path-input').value.trim();
    scanRepos(basePath);
}

function submitManual() {
    const project = document.getElementById('project-input').value.trim();
    if (!project) {
        showAlert('请输入项目名称', 'warning', '添加项目');
        return;
    }

    fetch('/add_project', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `project=${encodeURIComponent(project)}`
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.success) {
            // 添加项目到项目列表
            addProjectToProjectsContainer(project);
            // 清空输入框
            document.getElementById('project-input').value = '';
            // 保持手动添加选项选中
            document.getElementById('add-mode').value = 'manual';
            // 更新项目统计（如果该函数存在）
            if (typeof updateProjectCount === 'function') {
                updateProjectCount();
            }
            // 显示成功提示
            showAlert(data.message || `项目 "${project}" 添加成功`, 'success', '添加项目');
        } else if (data && data.error) {
            // 显示失败提示（包含项目名称）
            const errorMsg = data.error.replace('项目', '');
            showAlert(`项目 "${project}"${errorMsg}`, 'error', '添加项目');
        }
    })
    .catch(error => {
        console.error('添加项目失败:', error);
        showAlert(`项目 "${project}" 添加失败`, 'error', '添加项目');
    });
}

function scanRepos(basePath) {
    const scanBtn = document.querySelector('#scan-mode button');
    const originalText = scanBtn.innerHTML;
    scanBtn.innerHTML = '扫描中...';
    scanBtn.disabled = true;

    fetch('/scan_repos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `base_path=${encodeURIComponent(basePath)}`
    })
    .then(response => response.json())
    .then(data => {
        scanBtn.innerHTML = originalText;
        scanBtn.disabled = false;

        if (data.error) {
            showAlert(data.error, 'error', '扫描仓库');
            return;
        }

        // 显示扫描结果
        showScanResults(data.repos);
    })
    .catch(error => {
        scanBtn.innerHTML = originalText;
        scanBtn.disabled = false;
        console.error('扫描失败:', error);
        showAlert('扫描失败', 'error', '扫描仓库');
    });
}

function showScanResults(repos) {
    const resultsDiv = document.getElementById('scanResults');

    // 获取当前已管理的项目列表（只查找有 data-project 属性的卡片）
    const managedProjects = [];
    const projectCards = document.querySelectorAll('.project-card[data-project]');
    console.log('showScanResults - 已管理项目卡片数量:', projectCards.length);
    projectCards.forEach(card => {
        const projectName = card.getAttribute('data-project');
        console.log('showScanResults - 项目卡片:', projectName);
        if (projectName) {
            managedProjects.push(projectName);
        }
    });
    console.log('showScanResults - 已管理项目列表:', managedProjects);

    if (repos.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">未扫描到任何Git仓库</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    console.log('showScanResults - 扫描到的仓库:', repos);

    // 检查是否有未管理的项目
    const hasUnmanaged = repos.some(repo => {
        const repoName = typeof repo === 'string' ? repo : (repo.name || '未知');
        return !managedProjects.includes(repoName);
    });
    console.log('showScanResults - 是否有未管理项目:', hasUnmanaged);

    // 全选按钮的状态
    const selectAllDisabled = !hasUnmanaged ? 'disabled' : '';
    const selectAllStyle = !hasUnmanaged ? 'opacity: 0.4; cursor: not-allowed;' : '';
    console.log('showScanResults - 全选按钮状态:', selectAllDisabled, selectAllStyle);
    // 初始状态下批量按钮应该是禁用的（需要先勾选项目）
    const batchBtnDisabled = 'disabled';
    const batchBtnOpacity = '0.5';
    const batchBtnCursor = 'not-allowed';

    let html = `
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #666; font-size: 14px;">扫描到 ${repos.length} 个仓库</span>
            <button id="batch-add-btn" class="btn-primary" onclick="batchAddScanned()" style="opacity: ${batchBtnOpacity}; cursor: ${batchBtnCursor};" ${batchBtnDisabled}>
                批量添加
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eee; width: 40px;">
                        <input type="checkbox" id="select-all-scanned" onchange="toggleSelectAllScanned(event)" style="width: 16px; height: 16px; ${selectAllStyle}" ${selectAllDisabled}>
                    </th>
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eee;">项目名称</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eee;">状态</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eee; width: 80px;">操作</th>
                </tr>
            </thead>
            <tbody>`;

    if (repos.length === 0) {
        html += `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">未扫描到任何Git仓库</td></tr>`;
    } else {
        repos.forEach(repo => {
                const repoName = typeof repo === 'string' ? repo : (repo.name || '未知');
                // 检查项目是否已管理
                const isManaged = managedProjects.includes(repoName);
                const statusText = isManaged ? '已管理' : '可管理';
                const statusColor = isManaged ? '#999' : '#4caf50';  // 已管理灰色，可管理绿色

                // 已管理的项目禁用勾选框和添加按钮
                const checkboxDisabled = isManaged ? 'disabled' : '';
                const checkboxStyle = isManaged ? 'opacity: 0.3; cursor: not-allowed;' : '';
                const buttonDisabled = isManaged ? 'disabled' : '';
                // 使用不同图标和颜色区分状态
                const buttonIcon = isManaged ? '✓' : '+';
                const buttonStyle = isManaged ? 
                    'background: none; border: none; color: #999; cursor: not-allowed; padding: 4px; font-size: 16px;' :  // 已管理灰色，小号√
                    'background: none; border: none; color: #4caf50; cursor: pointer; padding: 4px; font-size: 22px; font-weight: bold;';  // 可管理绿色，大号+

                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">
                            <input type="checkbox" class="scanned-checkbox" value="${repoName}" onchange="updateBatchButton()" style="width: 16px; height: 16px; ${checkboxStyle}" ${checkboxDisabled}>
                        </td>
                        <td style="padding: 10px;">${repoName}</td>
                        <td style="padding: 10px; color: ${statusColor};">${statusText}</td>
                        <td style="padding: 10px;">
                            <button ${buttonDisabled} onclick="addScannedRepo('${repoName}')" style="${buttonStyle}" title="${statusText}">
                                ${buttonIcon}
                            </button>
                        </td>
                    </tr>
                `;
            });
    }

    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    
    // 更新批量按钮和全选框状态
    // updateBatchButton();
}

function addScannedRepo(repoName) {
    fetch('/add_project', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `project=${encodeURIComponent(repoName)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 显示成功通知
            showAlert(`项目 "${repoName}" 添加成功`, 'success', '添加项目');
            
            // 添加到项目管理列表
            addProjectToProjectsContainer(repoName);
            
            // 刷新项目统计
            fetch('/stats')
                .then(response => response.json())
                .then(stats => {
                    const statsDiv = document.getElementById('stats');
                    if (statsDiv) {
                        statsDiv.innerHTML = `
                            <span style="margin-right: 20px;">项目数：<strong>${stats.project_count}</strong></span>
                            <span>分支数：<strong>${stats.branch_count}</strong></span>
                        `;
                    }
                });
            
            // 更新扫描结果中该项目的状态
            const scanResults = document.getElementById('scanResults');
            if (scanResults && scanResults.style.display !== 'none') {
                // 找到该项目的行并更新状态
                const rows = scanResults.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 1 && cells[1].textContent === repoName) {
                        // 更新状态为"已管理"
                        cells[2].textContent = '已管理';
                        cells[2].style.color = '#999';  // 已管理应该是灰色
                        
                        // 禁用勾选框
                        const checkbox = cells[0].querySelector('input[type="checkbox"]');
                        if (checkbox) {
                            checkbox.disabled = true;
                            checkbox.style.opacity = '0.3';
                            checkbox.style.cursor = 'not-allowed';
                        }
                        
                        // 更新按钮状态
                        const button = cells[3].querySelector('button');
                        if (button) {
                            button.disabled = true;
                            button.style.background = 'none';
                            button.style.border = 'none';
                            button.style.color = '#999';
                            button.style.cursor = 'not-allowed';
                            button.style.fontSize = '16px';
                            button.style.fontWeight = 'normal';
                            button.textContent = '✓';
                        }
                    }
                });
                
                // 更新批量按钮和全选框状态
                updateBatchButton();
            }
        } else {
            showAlert('添加失败: ' + (data.error || '未知错误'), 'error', '批量添加项目');
        }
    })
    .catch(error => {
        console.error('添加失败:', error);
        showAlert('添加失败', 'error', '批量添加项目');
    });
}

// 全选状态跟踪变量
let scannedSelectAllState = false;

function toggleSelectAllScanned() {
    // 手动切换状态
    scannedSelectAllState = !scannedSelectAllState;
    
    const selectAll = document.getElementById('select-all-scanned');
    selectAll.checked = scannedSelectAllState;
    
    const checkboxes = document.querySelectorAll('.scanned-checkbox:not([disabled])');
    checkboxes.forEach(checkbox => {
        checkbox.removeAttribute('onchange');
        checkbox.checked = scannedSelectAllState;
        checkbox.setAttribute('onchange', 'updateBatchButton()');
    });
    
    updateBatchButton();
}

function updateBatchButton() {
    // 获取已选中的未管理复选框
    const checkedCheckboxes = document.querySelectorAll('.scanned-checkbox:checked:not([disabled])');
    
    // 获取所有可选的复选框
    const availableCheckboxes = document.querySelectorAll('.scanned-checkbox:not([disabled])');
    
    const btn = document.getElementById('batch-add-btn');
    const selectAll = document.getElementById('select-all-scanned');
    
    // 更新批量按钮状态
    if (checkedCheckboxes.length > 0) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
    
    // 更新全选按钮状态
    if (availableCheckboxes.length === 0) {
        // 没有可选的复选框，禁用全选按钮
        selectAll.disabled = true;
        selectAll.style.opacity = '0.3';
        selectAll.style.cursor = 'not-allowed';
        selectAll.checked = false;
        scannedSelectAllState = false;
    } else {
        // 有可选的复选框，启用全选按钮
        selectAll.disabled = false;
        selectAll.style.opacity = '1';
        selectAll.style.cursor = 'pointer';
    }
}

function batchAddScanned() {
    const checkboxes = document.querySelectorAll('.scanned-checkbox:checked');
    if (checkboxes.length === 0) {
        showAlert('请先选择要添加的项目', 'warning', '批量添加项目');
        return;
    }

    const projects = Array.from(checkboxes).map(cb => cb.value);

    fetch('/batch_add_projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `projects=${encodeURIComponent(JSON.stringify(projects))}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 添加所有成功的项目到项目管理容器
            data.addedProjects.forEach(project => {
                addProjectToProjectsContainer(project);
                
                // 更新扫描结果中该项目的状态
                const scanResults = document.getElementById('scanResults');
                if (scanResults && scanResults.style.display !== 'none') {
                    const rows = scanResults.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length > 1 && cells[1].textContent === project) {
                            cells[2].textContent = '已管理';
                            cells[2].style.color = '#999';
                            
                            const checkbox = cells[0].querySelector('input[type="checkbox"]');
                            if (checkbox) {
                                checkbox.disabled = true;
                                checkbox.style.opacity = '0.3';
                                checkbox.style.cursor = 'not-allowed';
                                checkbox.checked = false;
                            }
                            
                            const button = cells[3].querySelector('button');
                            if (button) {
                                button.disabled = true;
                                button.style.background = 'none';
                                button.style.border = 'none';
                                button.style.color = '#999';
                                button.style.cursor = 'not-allowed';
                                button.style.fontSize = '16px';
                                button.style.fontWeight = 'normal';
                                button.textContent = '✓';
                            }
                        }
                    });
                }
            });
            
            // 显示批量添加结果通知
            if (data.added > 0 && data.skipped === 0) {
                showAlert(`成功添加 ${data.added} 个项目`, 'success', '批量添加项目');
            } else if (data.added > 0 && data.skipped > 0) {
                showAlert(`成功添加 ${data.added} 个项目，跳过 ${data.skipped} 个`, 'warning', '批量添加项目');
            } else if (data.skipped > 0) {
                showAlert(`添加失败，共 ${data.skipped} 个项目已存在`, 'error', '批量添加项目');
            }
            
            // 更新批量按钮和全选框状态
            updateBatchButton();
            
            // 刷新项目统计
            fetch('/stats')
                .then(response => response.json())
                .then(stats => {
                    const statsDiv = document.getElementById('stats');
                    if (statsDiv) {
                        statsDiv.innerHTML = `
                            <span style="margin-right: 20px;">项目数：<strong>${stats.project_count}</strong></span>
                            <span>分支数：<strong>${stats.branch_count}</strong></span>
                        `;
                    }
                });
        } else {
            showAlert(data.message || '批量添加失败', 'error', '批量添加项目');
        }
    })
    .catch(error => {
        console.error('批量添加失败:', error);
        showAlert('批量添加失败，请重试', 'error', '批量添加项目');
    });
}

function toggleProjectBranches(projectName) {
    const header = document.querySelector(`[data-project="${projectName}"] .project-header`);
    const icon = header?.querySelector('.project-toggle-icon');
    const projectContent = document.querySelector(`[data-project="${projectName}"] .project-content`);

    if (!projectContent) return;

    const computedStyle = window.getComputedStyle(projectContent);
    if (computedStyle.display === 'none') {
        projectContent.style.display = 'block';
        if (icon) icon.textContent = '▲';
    } else {
        projectContent.style.display = 'none';
        if (icon) icon.textContent = '▼';
    }
}

function deleteProject(projectName, btn) {
    showConfirm(`确定要删除项目 "${projectName}" 的配置吗？<br/>（不会影响源码仓库）`, function() {
        fetch(`/del_project?project=${encodeURIComponent(projectName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络请求失败: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // 移除项目卡片
                    const card = btn.closest('.project-card');
                    if (card) {
                        card.remove();
                    }
                    
                    // 更新项目统计
                    const headers = document.querySelectorAll('.project-header');
                    let projectHeader = null;
                    headers.forEach(header => {
                        const nameSpan = header.querySelector('.project-name');
                        if (nameSpan && nameSpan.textContent.includes('项目管理')) {
                            projectHeader = header;
                        }
                    });
                    if (projectHeader) {
                        const badge = projectHeader.querySelector('.badge');
                        if (badge) {
                            const currentCount = parseInt(badge.textContent) || 0;
                            const newCount = Math.max(0, currentCount - 1);
                            badge.textContent = `${newCount} 个项目`;
                        }
                    }
                    
                    // 显示删除成功提示
                    showAlert(`项目 "${projectName}" 删除成功`, 'success', '删除项目');
                    
                    // 联动更新扫描结果（如果当前显示的话）
                    const scanResults = document.getElementById('scanResults');
                    if (scanResults && scanResults.style.display !== 'none') {
                        // 找到扫描结果中对应的项目行并更新状态
                        const rows = scanResults.querySelectorAll('tr');
                        rows.forEach(row => {
                            const checkbox = row.querySelector('.scanned-checkbox');
                            if (checkbox && checkbox.value === projectName) {
                                // 启用勾选框
                                checkbox.disabled = false;
                                checkbox.style.opacity = '1';
                                checkbox.style.cursor = 'pointer';
                                
                                // 更新状态列
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 3) {
                                    cells[2].textContent = '可管理';
                                    cells[2].style.color = '#4caf50';
                                }
                                
                                // 更新添加按钮
                                const addBtn = row.querySelector('button');
                                if (addBtn) {
                                    addBtn.disabled = false;
                                    addBtn.style.background = 'none';
                                    addBtn.style.border = 'none';
                                    addBtn.style.color = '#4caf50';
                                    addBtn.style.cursor = 'pointer';
                                    addBtn.style.padding = '4px';
                                    addBtn.style.fontSize = '22px';
                                    addBtn.style.fontWeight = 'bold';
                                    addBtn.innerHTML = '+';
                                    addBtn.title = '可管理';
                                }
                            }
                        });
                        
                        // 更新批量添加按钮状态
                        updateBatchButton();
                    }
                } else {
                    showAlert('删除失败: ' + (data.error || '未知错误'), 'error', '删除项目');
                }
            })
            .catch(error => {
                console.error('删除失败:', error);
                showAlert('删除失败: ' + error.message, 'error');
            });
    }, 'delete');
}

function addProjectToProjectsContainer(projectName) {
    const container = document.getElementById('projects-container');
    if (!container) return;

    // 检查项目是否已存在
    if (document.querySelector(`[data-project="${projectName}"]`)) {
        return;
    }

    // 移除"暂无项目"提示
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    // 更新项目管理标题的 badge（使用更精确的选择器）
    const projectsContainerHeader = document.querySelector('#projects-container').parentElement.querySelector('.project-header');
    if (projectsContainerHeader) {
        const projectHeaderBadge = projectsContainerHeader.querySelector('.badge');
        const projectHeaderName = projectsContainerHeader.querySelector('.project-name');
        
        if (projectHeaderBadge) {
            // 获取当前项目数量
            const currentCount = parseInt(projectHeaderBadge.textContent) || 0;
            projectHeaderBadge.textContent = `${currentCount + 1} 个项目`;
        } else if (projectHeaderName) {
            // 如果没有 badge，创建一个
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = '1 个项目';
            projectHeaderName.appendChild(badge);
        }
    }

    // 获取项目的分支信息（包括从全局配置继承的）
    fetch(`/get_project_branches?project=${encodeURIComponent(projectName)}`)
        .then(response => response.json())
        .then(data => {
            const branches = data.branches || [];

            // 创建新项目卡片
            const projectCard = document.createElement('div');
            projectCard.className = 'project-card';
            projectCard.style.marginBottom = '16px';
            projectCard.setAttribute('data-project', projectName);

            // 构建分支列表HTML
            let branchesHtml = '';
            if (branches.length === 0) {
                branchesHtml = '<div style="text-align: center; padding: 20px; color: #999;">暂无管理分支</div>';
            } else {
                branchesHtml = branches.map(branch => {
                    // JSON 格式：{name: 'xxx', locked: true/false, auto_lock_time: 0}
                    const isLocked = branch.locked !== undefined ? branch.locked : true;
                    const branchName = branch.name !== undefined ? branch.name : branch;
                    const escapedBranchName = escapeBranchName(branchName);
                    // 添加锁定图标
                    const displayName = isLocked ? '🔒 ' + branchName : branchName;
                    // 添加自动锁定时间指示器
                    let autoLockIndicator = '';
                    const autoLockTime = branch.auto_lock_time !== undefined ? branch.auto_lock_time : 0;
                    const autoLockUnit = branch.auto_lock_unit !== undefined ? branch.auto_lock_unit : 'minutes';
                    if (autoLockTime > 0) {
                        autoLockIndicator = createAutoLockIndicator(projectName, branchName, autoLockTime, autoLockUnit);
                    }
                    return `
                        <div class="branch-row" id="row-${projectName}-${escapedBranchName}">
                            <input type="checkbox" id="select-${projectName}-${escapedBranchName}" class="branch-checkbox" onclick="event.stopPropagation(); toggleBranchSelect('${projectName}', '${branchName}')">
                            <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <span id="branch-text-${projectName}-${escapedBranchName}" class="branch-name">${displayName}</span>
                                <button onclick="startInlineEdit('${projectName}', '${branchName}')" id="edit-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-edit" title="编辑">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                        <path d="m15 5 4 4"></path>
                                    </svg>
                                </button>
                                <input type="text" id="branch-input-${projectName}-${escapedBranchName}" value="${branchName}" style="display: none; padding: 8px 12px; border: 1px solid #667eea; border-radius: 4px; width: 200px; font-size: 14px;">
                                <button onclick="saveInlineEdit('${projectName}', '${branchName}')" id="save-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-save" style="display: none;" title="保存">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                                <button onclick="cancelInlineEdit('${projectName}', '${branchName}')" id="cancel-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-cancel" style="display: none;" title="取消">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div class="branch-actions">
                                ${autoLockIndicator}
                                <span id="status-${projectName}-${escapedBranchName}" class="branch-status ${isLocked ? 'locked' : 'unlocked'}">${isLocked ? '已锁定' : '已放开'}</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="toggle-${projectName}-${escapedBranchName}" ${isLocked ? 'checked' : ''} onchange="toggleBranch('${projectName}', '${branchName}')">
                                    <span class="toggle-slider"></span>
                                </label>
                                <button onclick="showDeleteBranchConfirm('${projectName}', '${branchName}')" id="delete-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-delete" title="删除">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            projectCard.innerHTML = `
                <div class="project-header" onclick="toggleProjectBranches('${projectName}')" style="cursor: pointer;">
                    <span class="project-name">
                        <span class="project-toggle-icon">▼</span>
                        ${projectName}
                        <span class="badge">${branches.length} 个管理分支</span>
                    </span>
                    <span style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
                        <button onclick="event.stopPropagation(); refreshPage();" title="刷新配置" class="refresh-btn" style="margin-right: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                <path d="M3 3v5h5"/>
                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                                <path d="M16 16h5v5"/>
                            </svg>
                        </button>
                        <button class="delete-project-btn" onclick="deleteProject('${projectName}', this)" title="删除配置（不影响源码）">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0 1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </span>
                </div>
                ${branches.length > 0 ? `
                <div class="branches-header" style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #666;">
                        <input type="checkbox" id="select-all-${projectName}" onchange="toggleSelectAll('${projectName}')" style="width: 16px; height: 16px;">
                        全选
                    </label>
                    <button class="btn-success" onclick="batchLockSelected()">🔒 锁定</button>
                    <button class="btn-danger" onclick="batchUnlockSelected()">🔓 放开</button>
                    <button class="btn-secondary" onclick="scheduleLockSelected()" title="为选中分支设置定时自动锁定">⏰ 定时锁定</button>
                </div>
                ` : ''}
                <div class="branches-list">
                    ${branchesHtml}
                </div>
                
                <!-- 添加管理分支 -->
                <div style="margin-top: 15px;">
                    <button onclick="toggleAddBranch('${projectName}')" id="add-branch-btn-${projectName}" class="add-branch-btn" title="添加管理分支">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <form id="add-branch-form-${projectName}" style="display: none; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; background: #f8f9fa; border-radius: 6px; margin-top: 6px;" onsubmit="event.preventDefault(); submitAddBranchForm('${projectName}')">
                        <input type="text" name="branch" placeholder="分支名称（如 refs/heads/main）" required style="flex: 1; min-width: 300px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <input type="hidden" name="project" value="${projectName}">
                        <div style="display: flex; gap: 4px;">
                            <button type="submit" class="btn-primary" title="添加分支">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                            <button type="button" class="btn-cancel" onclick="toggleAddBranch('${projectName}')" title="取消">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            `;

            // 按照字母顺序插入项目卡片，与后端排序保持一致
            const projectCards = container.querySelectorAll('.project-card[data-project]');
            let insertIndex = 0;
            
            // 找到应该插入的位置（按项目名称字母顺序）
            projectCards.forEach((card, index) => {
                const existingProject = card.getAttribute('data-project');
                if (existingProject && projectName.localeCompare(existingProject) > 0) {
                    insertIndex = index + 1;
                }
            });
            
            // 获取所有直接子元素
            const children = Array.from(container.children);
            
            // 按字母顺序插入项目卡片
            if (insertIndex < children.length) {
                container.insertBefore(projectCard, children[insertIndex]);
            } else {
                container.appendChild(projectCard);
            }
            
            bindAutoLockInputEvents();
        })
        .catch(error => {
            console.error('获取项目分支失败:', error);
        });
}

function toggleAddBranch(projectName) {
    const btn = document.getElementById(`add-branch-btn-${projectName}`);
    const form = document.getElementById(`add-branch-form-${projectName}`);

    if (form.style.display === 'none') {
        btn.style.display = 'none';
        form.style.display = 'flex';
        form.querySelector('input[name="branch"]').focus();
    } else {
        btn.style.display = 'inline-flex';
        form.style.display = 'none';
        form.querySelector('input[name="branch"]').value = '';
    }
}

function createDefaultConfig() {
    fetch('/create_default_config', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('全局默认配置已创建', 'success', '创建配置');
            setTimeout(() => location.reload(), 1000);
        } else {
            showAlert(data.error || '创建失败', 'error', '创建配置');
        }
    })
    .catch(error => {
        console.error('创建失败:', error);
        showAlert('创建失败', 'error', '创建配置');
    });
}

function submitAddBranch(projectName) {
    const form = document.getElementById(`add-branch-form-${projectName}`);
    const branchInput = form.querySelector('input[name="branch"]');
    const branch = branchInput.value.trim();
    const syncAllCheckbox = form.querySelector('input[name="sync_all"]');
    const syncAll = syncAllCheckbox ? syncAllCheckbox.checked : false;
    
    if (!branch) {
        showAlert('请输入分支名称', 'warning', '添加分支');
        return;
    }

    fetch('/add_branch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `project=${encodeURIComponent(projectName)}&branch=${encodeURIComponent(branch)}&sync_all=${syncAll}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 显示成功提示
            if (syncAll && projectName === '_default') {
                showAlert(`分支 "${branch}" 添加成功，已同步到 ${data.added_count || 1} 个项目`, 'success', '添加分支');
            } else {
                showAlert(`分支 "${branch}" 添加成功`, 'success', '添加分支');
            }
            
            // 动态添加分支行到页面，保持当前Tab状态
            addBranchRowToPage(projectName, branch);
            
            // 重置表单
            branchInput.value = '';
            if (syncAllCheckbox) {
                syncAllCheckbox.checked = false;
            }
            
            // 隐藏添加表单
            toggleAddBranch(projectName);
        } else {
            if (data.error && data.error.includes('已存在')) {
                showAlert(`分支 "${branch}" 已存在`, 'error', '添加分支');
            } else {
                showAlert('添加失败: ' + (data.error || '未知错误'), 'error', '添加分支');
            }
        }
    })
    .catch(error => {
        console.error('添加失败:', error);
        showAlert('添加失败', 'error', '添加分支');
    });
}

// 项目管理表单提交函数
function submitAddBranchForm(projectName) {
    submitAddBranch(projectName);
}

// 异步添加新分支行到页面
function addBranchRowToPage(projectName, branchName) {
    const escapedBranch = escapeBranchName(branchName);
    // 转义HTML属性中的双引号
    const htmlEscapedBranch = branchName.replace(/"/g, '&quot;');
    // 转义JavaScript字符串中的特殊字符
    const jsBranchName = escapeJsString(branchName);
    const isDefaultProject = projectName === '_default';
    
    // 创建分支行 HTML
    let branchRowHTML = '';
    if (isDefaultProject) {
        // 全局默认配置分支结构
        branchRowHTML = `
            <div class="branch-row" id="row-${projectName}-${escapedBranch}">
                <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                    <span id="branch-text-${projectName}-${escapedBranch}" class="branch-name">${branchName}</span>
                    <button onclick="startInlineEditFromElement(this)" id="edit-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-edit" title="编辑">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                        </svg>
                    </button>
                    <input type="text" id="branch-input-${projectName}-${escapedBranch}" value="${branchName}" style="display: none; padding: 8px 12px; border: 1px solid #667eea; border-radius: 4px; width: 200px; font-size: 14px;">
                    <button onclick="saveInlineEditFromElement(this)" id="save-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-save" style="display: none;" title="保存">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button onclick="cancelInlineEditFromElement(this)" id="cancel-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-cancel" style="display: none;" title="取消">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button onclick="syncBranchToAllProjectsFromElement(this)" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn btn-sync" title="应用到所有项目">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7"></path>
                        </svg>
                    </button>
                    <button onclick="showDeleteBranchConfirmFromElement(this)" id="delete-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-delete" title="删除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    } else {
        // 项目分支结构
        branchRowHTML = `
            <div class="branch-row" id="row-${projectName}-${escapedBranch}">
                <input type="checkbox" id="select-${projectName}-${escapedBranch}" class="branch-checkbox" 
                       onclick="toggleBranchSelectFromElement(this)"
                       data-project="${projectName}" 
                       data-branch="${htmlEscapedBranch}">
                <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                    <span id="branch-text-${projectName}-${escapedBranch}" class="branch-name">🔒 ${branchName}</span>
                    <button onclick="startInlineEditFromElement(this)" id="edit-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-edit" title="编辑">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                        </svg>
                    </button>
                    <input type="text" id="branch-input-${projectName}-${escapedBranch}" value="${branchName}" style="display: none; padding: 8px 12px; border: 1px solid #667eea; border-radius: 4px; width: 200px; font-size: 14px;">
                    <button onclick="saveInlineEditFromElement(this)" id="save-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-save" style="display: none;" title="保存">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button onclick="cancelInlineEditFromElement(this)" id="cancel-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-cancel" style="display: none;" title="取消">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="branch-actions">
                    <span id="status-${projectName}-${escapedBranch}" class="branch-status locked">已锁定</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="toggle-${projectName}-${escapedBranch}" checked 
                               onchange="toggleBranchFromElement(this)"
                               data-project="${projectName}" 
                               data-branch="${htmlEscapedBranch}">
                        <span class="toggle-slider"></span>
                    </label>
                    <button onclick="showDeleteBranchConfirmFromElement(this)" id="delete-btn-${projectName}-${escapedBranch}" 
                            data-project="${projectName}" 
                            data-branch="${htmlEscapedBranch}"
                            class="action-btn action-btn-delete" title="删除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    // 找到正确的容器并添加新行
    const projectContainer = getProjectContainer(projectName);
    if (projectContainer) {
        // 移除暂无分支提示（支持多种选择器）
        const placeholder = projectContainer.querySelector('.no-branches-message') || 
                           projectContainer.querySelector('#no-default-branches');
        if (placeholder) {
            placeholder.remove();
        }
        
        // 添加到分支列表最后面
        projectContainer.insertAdjacentHTML('beforeend', branchRowHTML);
    }
}

// 获取项目容器（根据项目名称找到对应的分支列表容器）
function getProjectContainer(projectName) {
    const isDefaultProject = projectName === '_default';
    
    if (isDefaultProject) {
        // 找全局默认配置的分支容器
        const branchesList = document.querySelector('.branches-list');
        if (branchesList) {
            return branchesList;
        }
    } else {
        // 找项目管理中的项目容器 - 使用data-project属性进行精确匹配
        const projectCard = document.querySelector(`.project-card[data-project="${projectName}"]`);
        if (projectCard) {
            // 先尝试查找 .project-branches，找不到再试 .branches-list
            let container = projectCard.querySelector('.project-branches');
            if (!container) {
                container = projectCard.querySelector('.branches-list');
            }
            return container;
        }
        
        // 如果没找到，尝试使用项目名称查找（兼容旧版本）
        const projectCards = document.querySelectorAll('.project-card');
        for (const card of projectCards) {
            const nameSpan = card.querySelector('.project-name');
            if (nameSpan && nameSpan.textContent.trim() === projectName) {
                // 先尝试查找 .project-branches，找不到再试 .branches-list
                let container = card.querySelector('.project-branches');
                if (!container) {
                    container = card.querySelector('.branches-list');
                }
                return container;
            }
        }
    }
    return null;
}

// 当前加载的日志日期（用于增量加载）
let currentLogDate = null;
let availableLogDates = [];

function loadLogs(dateStr = null) {
    let url = '/get_logs';
    if (dateStr) {
        url += `?date=${encodeURIComponent(dateStr)}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const logs = data.logs || [];
            const container = document.getElementById('log-container');
            const currentDate = data.current_date || new Date().toISOString().split('T')[0];
            
            // 保存可用的日志日期
            availableLogDates = data.available_dates || [];
            
            // 记录当前日期
            currentLogDate = currentDate;

            let html = `
                <div id="log-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #fafafa; border-bottom: 1px solid #e0e0e0;">
                    <span style="font-size: 13px; color: #666;">📅 ${formatDate(currentDate)}</span>
                    <div id="log-nav-container"></div>
                </div>
            `;
            
            if (logs.length === 0) {
                html += `<div style="text-align: center; padding: 20px; color: #999;">暂无操作日志</div>`;
            } else {
                html += `<div id="log-list" style="max-height: 300px; overflow-y: auto; font-size: 13px; line-height: 1.6;">`;
                logs.forEach(log => {
                    html += `<div style="padding: 8px 12px; border-bottom: 1px solid #f5f5f5; color: #555;">${log}</div>`;
                });
                html += '</div>';
            }
            
            container.innerHTML = html;
            
            // 渲染日期导航按钮
            renderLogNavButtons();
        })
        .catch(error => {
            console.error('获取日志失败:', error);
        });
}

function renderLogNavButtons() {
    const container = document.getElementById('log-nav-container');
    if (!container) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 检查是否有更早的日志（任何比当前日期早的日期都算）
    const hasPrev = availableLogDates.some(d => d < currentLogDate);
    // 检查是否有更晚的日志（任何比当前日期晚的日期，且不超过今天）
    const hasNext = availableLogDates.some(d => d > currentLogDate && d <= today);
    
    // 获取前一个和后一个有日志的日期
    const prevDate = getPreviousLogDate(currentLogDate);
    const nextDate = getNextLogDate(currentLogDate);
    
    // 始终显示按钮，不可用时变灰
    const prevDisabled = !hasPrev;
    const nextDisabled = !hasNext;
    
    container.innerHTML = `
        <div style="display: flex; gap: 4px;">
            <button 
                onclick="${prevDisabled ? '' : `loadLogs('${prevDate}')`}" 
                style="padding: 4px 10px; background: ${prevDisabled ? '#f0f0f0' : '#f5f5f5'}; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color: ${prevDisabled ? '#bbb' : '#666'}; cursor: ${prevDisabled ? 'not-allowed' : 'pointer'}; font-weight: bold;"
                title="${prevDisabled ? '没有更早的日志' : '查看上一天有日志的日期'}"
                ${prevDisabled ? 'disabled' : ''}
            >
                <
            </button>
            <button 
                onclick="${nextDisabled ? '' : `loadLogs('${nextDate}')`}" 
                style="padding: 4px 10px; background: ${nextDisabled ? '#f0f0f0' : '#f5f5f5'}; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color: ${nextDisabled ? '#bbb' : '#666'}; cursor: ${nextDisabled ? 'not-allowed' : 'pointer'}; font-weight: bold;"
                title="${nextDisabled ? '没有更晚的日志' : '查看下一天有日志的日期'}"
                ${nextDisabled ? 'disabled' : ''}
            >
                >
            </button>
        </div>
    `;
}

function getPreviousLogDate(currentDate) {
    // 找到比当前日期早的最近的有日志的日期
    const earlierDates = availableLogDates.filter(d => d < currentDate);
    if (earlierDates.length === 0) return null;
    return earlierDates.sort().reverse()[0];
}

function getNextLogDate(currentDate) {
    // 找到比当前日期晚的最近的有日志的日期（不超过今天）
    const today = new Date().toISOString().split('T')[0];
    const laterDates = availableLogDates.filter(d => d > currentDate && d <= today);
    if (laterDates.length === 0) return null;
    return laterDates.sort()[0];
}

function getPreviousDate(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

function getNextDate(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
}

function getPreviousDate(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
        return '今天';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
        return '昨天';
    } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

function refreshLogs() {
    loadLogs();
}

// 将全局配置的分支应用到所有项目
function syncBranchToAllProjectsFromElement(element) {
    const branch = element.dataset.branch;
    syncBranchToAllProjects(branch);
}

function syncBranchToAllProjects(branchName) {
    // 转义分支名中的特殊字符，避免破坏HTML结构
    const escapedBranchName = branchName.replace(/"/g, '&quot;');
    showConfirm(`确定要将分支<br><strong>"${escapedBranchName}"</strong><br>应用到所有项目吗？`, function() {
        fetch(`/sync_branch_to_all?branch=${encodeURIComponent(branchName)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert(`分支 "${branchName}" 已成功应用到所有项目`, 'success', '同步成功');
                    // 只刷新项目管理面板中的项目分支列表，不刷新整个页面
                    refreshProjectsBranches();
                } else {
                    showAlert(`同步分支 "${branchName}" 失败: ` + (data.error || '未知错误'), 'error', '同步分支到所有项目');
                }
            })
            .catch(error => {
                console.error('同步失败:', error);
                showAlert(`同步分支 "${branchName}" 失败: ` + error.message, 'error', '同步分支到所有项目');
            });
    }, 'warning');
}

// 刷新项目管理面板中的项目分支列表
function refreshProjectsBranches() {
    // 获取所有项目卡片
    const projectCards = document.querySelectorAll('.project-card[data-project]');
    projectCards.forEach(card => {
        const projectName = card.getAttribute('data-project');
        if (projectName) {
            // 刷新每个项目的分支列表
            refreshProjectBranches(projectName);
        }
    });
}

// 刷新单个项目的分支列表
function refreshProjectBranches(projectName) {
    fetch(`/get_project_branches?project=${encodeURIComponent(projectName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateProjectBranches(projectName, data.branches);
            }
        })
        .catch(error => {
            console.error('刷新分支失败:', error);
        });
}

// 更新单个项目的分支列表UI
function updateProjectBranches(projectName, branches) {
    const projectCard = document.querySelector(`.project-card[data-project="${projectName}"]`);
    if (!projectCard) return;
    
    const branchesList = projectCard.querySelector('.branches-list');
    if (!branchesList) return;
    
    // 更新徽章数量
    const badge = projectCard.querySelector('.badge');
    if (badge) {
        badge.textContent = `${branches.length} 个管理分支`;
    }
    
    // 清除现有分支行
    const existingRows = branchesList.querySelectorAll('.branch-row');
    existingRows.forEach(row => row.remove());
    
    // 移除暂无分支提示
    const placeholder = branchesList.querySelector('.no-branches-message') || 
                       branchesList.querySelector('div[style*="text-align: center"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    // 添加新的分支行
    branches.forEach(branch => {
        const branchName = branch.name || branch;
        const isLocked = branch.locked !== undefined ? branch.locked : !branchName.startsWith('#');
        const escapedBranchName = branchName.replace(/\//g, '__slash__').replace(/\\/g, '__backslash__').replace(/"/g, '__quote__').replace(/'/g, '__singlequote__');
        const jsBranchName = escapeJsString(branchName);
        
        const rowHtml = `
            <div class="branch-row" id="row-${projectName}-${escapedBranchName}">
                <input type="checkbox" id="select-${projectName}-${escapedBranchName}" class="branch-checkbox" onclick="event.stopPropagation(); toggleBranchSelect('${projectName}', '${jsBranchName}')">
                <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                    <span id="branch-text-${projectName}-${escapedBranchName}" class="branch-name">${isLocked ? '🔒 ' : ''}${branchName}</span>
                    <button onclick="startInlineEdit('${projectName}', '${jsBranchName}')" id="edit-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-edit" title="编辑">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                        </svg>
                    </button>
                    <input type="text" id="branch-input-${projectName}-${escapedBranchName}" value="${branchName}" style="display: none; padding: 8px 12px; border: 1px solid #667eea; border-radius: 4px; width: 200px; font-size: 14px;">
                    <button onclick="saveInlineEdit('${projectName}', '${jsBranchName}')" id="save-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-save" style="display: none;" title="保存">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button onclick="cancelInlineEdit('${projectName}', '${jsBranchName}')" id="cancel-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-cancel" style="display: none;" title="取消">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="branch-actions">
                    <span id="status-${projectName}-${escapedBranchName}" class="branch-status ${isLocked ? 'locked' : 'unlocked'}">${isLocked ? '已锁定' : '已放开'}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="toggle-${projectName}-${escapedBranchName}" ${isLocked ? 'checked' : ''} onchange="toggleBranch('${projectName}', '${jsBranchName}')">
                        <span class="toggle-slider"></span>
                    </label>
                    <button onclick="showDeleteBranchConfirm('${projectName}', '${jsBranchName}')" id="delete-btn-${projectName}-${escapedBranchName}" class="action-btn action-btn-delete" title="删除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        branchesList.insertAdjacentHTML('beforeend', rowHtml);
    });
}

/* ============ 后台任务面板 ============ */

let bgTaskPanelOpen = false;
let bgTaskContentCollapsed = false;
let bgTaskTimer = null;
let currentTasks = [];
let isDragging = false;
let startY = 0;
let startPanelTop = 0;

function toggleBgTaskPanel() {
    const panel = document.getElementById('bg-task-panel');
    
    if (bgTaskPanelOpen) {
        panel.classList.add('collapsed');
        bgTaskPanelOpen = false;
        stopBgTaskTimer();
    } else {
        panel.classList.remove('collapsed');
        bgTaskPanelOpen = true;
        loadBgTasks();
        renderBgTasks();
        startBgTaskTimer();
    }
}

function toggleBgTaskContent() {
    const content = document.getElementById('bg-task-content');
    const collapseBtn = document.querySelector('.bg-task-collapse-btn');
    
    if (bgTaskContentCollapsed) {
        content.style.maxHeight = '440px';
        content.style.padding = '';
        collapseBtn.textContent = '▼';
        bgTaskContentCollapsed = false;
    } else {
        content.style.maxHeight = '0';
        content.style.padding = '0';
        collapseBtn.textContent = '▲';
        bgTaskContentCollapsed = true;
    }
}

function initBgTaskDrag() {
    const toggleBtn = document.getElementById('bg-task-toggle-btn');
    const panel = document.getElementById('bg-task-panel');
    const header = document.querySelector('.bg-task-header');
    
    function startDrag(e) {
        isDragging = true;
        startY = e.clientY;
        const panelStyle = window.getComputedStyle(panel);
        startPanelTop = parseInt(panelStyle.top) || 200;
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    toggleBtn.addEventListener('mousedown', startDrag);
    if (header) {
        header.addEventListener('mousedown', startDrag);
    }
    
    function handleDrag(e) {
        if (!isDragging) return;
        
        const deltaY = e.clientY - startY;
        let newTop = startPanelTop + deltaY;
        
        const maxTop = window.innerHeight - 100;
        newTop = Math.max(50, Math.min(newTop, maxTop));
        
        panel.style.top = newTop + 'px';
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

function startBgTaskTimer() {
    if (bgTaskTimer) clearInterval(bgTaskTimer);
    bgTaskTimer = setInterval(() => {
        updateBgTasksCountdown();
    }, 1000);
}

function stopBgTaskTimer() {
    if (bgTaskTimer) {
        clearInterval(bgTaskTimer);
        bgTaskTimer = null;
    }
}

function loadBgTasks() {
    fetch('/get_auto_lock_tasks', {
        credentials: 'include'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(text => {
            try {
                const data = JSON.parse(text);
                if (data.success) {
                    currentTasks = data.tasks;
                    updateBgTaskCount();  // 始终更新计数
                    if (bgTaskPanelOpen) {
                        renderBgTasks();  // 只在展开时渲染列表
                    }
                }
            } catch (e) {
                console.error('解析JSON失败:', e);
                console.log('响应内容:', text);
            }
        })
        .catch(error => {
            console.error('加载后台任务失败:', error);
        });
}

function renderBgTasks() {
    const listContainer = document.getElementById('bg-task-list');
    
    if (currentTasks.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #999; font-size: 13px;">暂无任务</div>';
        return;
    }
    
    listContainer.innerHTML = currentTasks.map(task => {
        let timeStr = '--:--';
        let showCountdown = false;
        
        if (task.status === '倒计时中' && task.remaining_seconds > 0) {
            const totalSeconds = Math.floor(task.remaining_seconds);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) {
                timeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            showCountdown = true;
        }
        
        if (!showCountdown) {
            return '';
        }
        
        return `
            <div class="bg-task-item">
                <div class="bg-task-branch-info">${escapeHtml(task.branch)} <span class="bg-task-project-badge">[${escapeHtml(task.project)}]</span></div>
                <div class="bg-task-countdown">
                    <span class="bg-task-countdown-text">将在</span>
                    <span class="bg-task-countdown-time">${timeStr}</span>
                    <span class="bg-task-countdown-text">后被自动锁定</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateBgTasksCountdown() {
    let hasActiveTasks = false;
    
    for (let i = 0; i < currentTasks.length; i++) {
        if (currentTasks[i].status === '倒计时中' && currentTasks[i].remaining_seconds > 0) {
            currentTasks[i].remaining_seconds -= 1;
            hasActiveTasks = true;
        }
    }
    
    if (hasActiveTasks || currentTasks.length > 0) {
        if (bgTaskPanelOpen) {
            renderBgTasks();  // 只在展开时渲染
        }
        updateBgTaskCount();  // 始终更新计数
    }
}

function updateBgTaskCount() {
    const countSpan = document.getElementById('bg-task-count');
    countSpan.textContent = currentTasks.length;
}

// 页面加载完成后，定期更新后台任务状态
let bgTaskRefreshTimer = null;
function startBgTaskRefresh() {
    if (bgTaskRefreshTimer) clearInterval(bgTaskRefreshTimer);
    bgTaskRefreshTimer = setInterval(() => {
        loadBgTasks();  // 始终加载数据以更新计数
    }, 10000);  // 每10秒刷新一次
}

// 初始化后台任务面板
document.addEventListener('DOMContentLoaded', function() {
    loadBgTasks();  // 页面加载时先获取一次数据
    startBgTaskRefresh();
    initBgTaskDrag();  // 初始化拖动功能
    
    // 阻止面板内容区域滚动穿透
    const bgTaskContent = document.getElementById('bg-task-content');
    if (bgTaskContent) {
        bgTaskContent.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });
    }
});
