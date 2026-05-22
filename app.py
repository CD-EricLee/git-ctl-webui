#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import threading
import time
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, render_template, request, redirect, url_for, session
from datetime import timedelta

app = Flask(__name__, template_folder='templates')
app.secret_key = 'git-ctl-secret-key'

# 添加自定义过滤器：转义JavaScript字符串（用于HTML onclick属性）
@app.template_filter('escapejs')
def escapejs_filter(s):
    if not s:
        return ''
    # 在HTML onclick属性中，需要转义：
    # 1. 反斜杠（必须在最前面）
    # 2. HTML双引号（避免破坏HTML属性）
    # 3. JavaScript单引号（避免破坏JavaScript字符串）
    return s.replace('\\', '\\\\').replace('"', '&quot;').replace("'", "\'")

# 配置日志：限制单个日志文件大小为10MB，保留3个历史日志
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'log', 'app.log')
if not os.path.exists(os.path.dirname(LOG_FILE)):
    os.makedirs(os.path.dirname(LOG_FILE))
file_handler = RotatingFileHandler(LOG_FILE, maxBytes=10*1024*1024, backupCount=3, encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s'))
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Git分支管理系统启动')

# 配置目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, 'config')
PROJECTS_CONFIG_DIR = os.path.join(CONFIG_DIR, 'projects')
LOG_DIR = os.path.join(BASE_DIR, 'log')
os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(PROJECTS_CONFIG_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# 全局默认配置文件名
DEFAULT_CONFIG_NAME = "_default"

# 应用配置文件路径（session_timeout 等设置）
APP_CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

# 默认会话超时时间（分钟）
DEFAULT_SESSION_TIMEOUT = 5

def load_config():
    if os.path.exists(APP_CONFIG_FILE):
        try:
            with open(APP_CONFIG_FILE, 'r') as f:
                config = json.load(f)
                return config
        except:
            pass
    return {"session_timeout_minutes": DEFAULT_SESSION_TIMEOUT}

def get_auth_credentials():
    config = load_config()
    return config.get("username", "admin"), config.get("password", "^>#%")

def save_config(config):
    with open(APP_CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

# 获取客户端IP地址
def get_client_ip():
    # 按优先级检查各种代理头
    ip_headers = [
        'X-Forwarded-For',
        'X-Real-IP',
        'X-Forwarded',
        'X-Cluster-Client-IP',
        'Proxy-Client-IP',
        'WL-Proxy-Client-IP',
        'HTTP_CLIENT_IP',
        'HTTP_X_FORWARDED_FOR'
    ]
    
    for header in ip_headers:
        ip = request.headers.get(header)
        if ip:
            # X-Forwarded-For 可能包含多个IP，取第一个
            if header == 'X-Forwarded-For':
                ip = ip.split(',')[0].strip()
            return ip
    
    # 如果没有代理头，直接使用 remote_addr
    return request.remote_addr

# 记录操作日志
def get_log_file(date_str=None):
    """获取日志文件路径（按天保存）"""
    if not date_str:
        date_str = time.strftime("%Y-%m-%d", time.localtime())
    return os.path.join(LOG_DIR, f"operations_{date_str}.log")

def log_operation(action, details="", ip=None):
    """记录操作日志（写入当天的日志文件）"""
    # 如果没有提供IP，尝试从请求上下文获取
    if ip is None:
        try:
            ip = get_client_ip()
        except RuntimeError:
            # 在请求上下文外运行时，使用默认标识
            ip = "SYSTEM"
    
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    log_entry = f"[{timestamp}] IP:{ip} - {action}"
    if details:
        log_entry += f" - {details}"
    log_entry += "\n"
    
    log_file = get_log_file()
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(log_entry)

def get_operations_log(date_str=None, limit=50):
    """获取操作日志（支持按日期获取）"""
    logs = []
    if not date_str:
        date_str = time.strftime("%Y-%m-%d", time.localtime())
    
    log_file = get_log_file(date_str)
    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            # 反转获取最新的记录
            for line in reversed(lines[-limit:]):
                line = line.strip()
                if line:
                    logs.append(line)
    return logs

def get_operations_log_range(start_date, end_date):
    """获取指定日期范围内的日志"""
    logs = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        day_logs = get_operations_log(date_str)
        logs.extend(day_logs)
        current_date += timedelta(days=1)
    return sorted(logs, reverse=True)

def get_available_log_dates():
    """获取有日志的所有日期（按日期倒序）"""
    dates = set()
    if os.path.exists(LOG_DIR):
        for item in os.listdir(LOG_DIR):
            if item.startswith("operations_") and item.endswith(".log"):
                date_str = item[11:-4]  # 提取日期部分
                try:
                    # 验证日期格式
                    time.strptime(date_str, "%Y-%m-%d")
                    dates.add(date_str)
                except:
                    pass
    return sorted(dates, reverse=True)

# 加载配置并设置session超时时间
config = load_config()
app.permanent_session_lifetime = timedelta(minutes=config.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT))

# 登录凭证（生产环境应使用更安全的方式存储）
USERNAME = "admin"
PASSWORD = "^>#%"

def get_project_config(project):
    return os.path.join(PROJECTS_CONFIG_DIR, f"{project}.json")

def get_project_config_txt(project):
    """获取项目配置文件路径（txt 格式，供钩子脚本使用）"""
    return os.path.join(PROJECTS_CONFIG_DIR, f"{project}.txt")

def normalize_branch_name(branch_name):
    """标准化分支名称：与前端 escapeBranchName 保持一致"""
    if branch_name:
        return branch_name.replace('/', '_').replace('\\', '_').replace('"', '_').replace("'", '_')
    return branch_name

def get_projects():
    projects = []
    seen_projects = set()
    if os.path.exists(PROJECTS_CONFIG_DIR):
        for item in os.listdir(PROJECTS_CONFIG_DIR):
            # 支持 .json 和 .txt 格式（用于迁移）
            if item.endswith(".json"):
                project_name = item[:-5]
                if project_name != DEFAULT_CONFIG_NAME and project_name not in seen_projects:
                    projects.append(project_name)
                    seen_projects.add(project_name)
            elif item.endswith(".txt"):
                project_name = item[:-4]
                # 排除全局默认配置和已处理的 json 文件
                if project_name != DEFAULT_CONFIG_NAME and project_name not in seen_projects:
                    projects.append(project_name)
                    seen_projects.add(project_name)
    return sorted(projects)

def read_branches(project):
    """读取项目分支配置（JSON 格式）"""
    config_file = get_project_config(project)
    txt_config_file = get_project_config_txt(project)

    # 尝试读取 JSON 格式
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                branches = data.get('branches', [])
                # 确保所有分支都有完整的字段
                normalized_branches = []
                for b in branches:
                    # 如果分支是字符串格式，转换为字典格式
                    if isinstance(b, str):
                        branch_name = b
                        locked = True
                        auto_lock_time = 0
                        auto_lock_unit = 'minutes'

                        # 解析注释标记
                        if branch_name.startswith('# '):
                            locked = False
                            branch_name = branch_name[2:]
                        elif branch_name.startswith('#'):
                            locked = False
                            branch_name = branch_name[1:]

                        # 解析自动锁定时间
                        if '|' in branch_name:
                            parts = branch_name.split('|', 1)
                            branch_name = parts[0]
                            if parts[1].isdigit():
                                auto_lock_time = int(parts[1])

                        # 创建新的字典
                        normalized_branches.append({
                            'name': branch_name,
                            'locked': locked,
                            'auto_lock_time': auto_lock_time,
                            'auto_lock_unit': auto_lock_unit,
                            'unlock_time': 0
                        })
                    else:
                        # 确保字典格式的分支有完整字段
                        if 'auto_lock_unit' not in b:
                            b['auto_lock_unit'] = 'minutes'
                        if 'auto_lock_time' not in b:
                            b['auto_lock_time'] = 0
                        if 'locked' not in b:
                            b['locked'] = True
                        if 'name' not in b:
                            b['name'] = ''
                        if 'unlock_time' not in b:
                            b['unlock_time'] = 0
                        normalized_branches.append(b)

                # 如果是全局配置，直接返回
                if project == DEFAULT_CONFIG_NAME:
                    return normalized_branches, {}

                # 只有当项目配置文件不存在时才继承全局配置
                # 一旦项目有了自己的配置，就不再自动继承全局配置的分支
                # 全局配置仅在新建项目时使用
                
                return normalized_branches, {}
        except Exception as e:
            print(f"读取配置文件失败: {e}")
            pass
    
    # 如果 JSON 文件不存在，尝试读取旧的 txt 格式并迁移
    if os.path.exists(txt_config_file):
        branches = []
        with open(txt_config_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    branch_name = line
                    locked = True
                    auto_lock_time = 0
                    auto_lock_unit = 'minutes'  # 默认单位
                    
                    # 解析注释标记
                    if line.startswith('# '):
                        locked = False
                        branch_name = line[2:]
                    
                    # 解析自动锁定时间
                    if '|' in branch_name:
                        parts = branch_name.split('|', 1)
                        branch_name = parts[0]
                        if parts[1].isdigit():
                            auto_lock_time = int(parts[1])
                    
                    branches.append({
                        'name': branch_name,
                        'locked': locked,
                        'auto_lock_time': auto_lock_time,
                        'auto_lock_unit': auto_lock_unit,
                        'unlock_time': 0
                    })
        
        # 迁移到 JSON 格式
        write_branches(project, branches)
        return branches, {}
    
    # 如果都不存在，检查是否有全局配置，如果有就复制到项目配置
    if project != DEFAULT_CONFIG_NAME:
        default_config_file = get_project_config(DEFAULT_CONFIG_NAME)
        if os.path.exists(default_config_file):
            default_branches, _ = read_branches(DEFAULT_CONFIG_NAME)
            if default_branches:
                # 复制全局配置到项目配置
                branches_to_write = [b.copy() for b in default_branches]
                write_branches(project, branches_to_write)
                return branches_to_write, {}
    
    # 如果都不存在，返回空列表
    return [], {}

def write_branches(project, branches):
    """写入项目分支配置（JSON 格式）"""
    config_file = get_project_config(project)
    txt_config_file = get_project_config_txt(project)
    
    # 确保所有分支都有完整的字段
    for b in branches:
        if 'auto_lock_unit' not in b:
            b['auto_lock_unit'] = 'minutes'
        if 'auto_lock_time' not in b:
            b['auto_lock_time'] = 0
        if 'locked' not in b:
            b['locked'] = True
        if 'name' not in b:
            b['name'] = ''
    
    # 写入 JSON 文件（用户界面使用）
    data = {
        'branches': branches
    }
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # 同时写入 txt 文件（供钩子脚本使用）
    with open(txt_config_file, 'w', encoding='utf-8') as f:
        for b in branches:
            branch_name = b.get('name', '')
            if not branch_name:
                continue
            # 直接使用分支名称，不添加 refs/heads/ 前缀
            if b.get('locked', True):
                f.write(branch_name + '\n')
            else:
                f.write('# ' + branch_name + '\n')

# ========== 辅助函数（JSON 格式）==========

def get_branch_by_name(branches, branch_name):
    """根据名称查找分支"""
    for branch in branches:
        if branch['name'] == branch_name:
            return branch
    return None

def set_branch_locked(branch, locked):
    """设置分支锁定状态"""
    branch['locked'] = locked
    return branch

def set_branch_auto_lock_time(branch, auto_lock_time):
    """设置分支自动锁定时间"""
    branch['auto_lock_time'] = auto_lock_time
    return branch

def is_locked(branch):
    """判断分支是否被锁定"""
    return branch.get('locked', True)

def get_branch_name(branch):
    """获取分支名称"""
    if isinstance(branch, dict):
        return branch.get('name', '')
    return branch  # 兼容旧格式

# 从 pre-receive 钩子中提取管理分支
def extract_protected_branches(base_path, project_name):
    # 检查普通仓库
    pre_receive_normal = os.path.join(base_path, project_name, ".git", "hooks", "pre-receive")
    # 检查裸仓库
    pre_receive_bare = os.path.join(base_path, project_name, "hooks", "pre-receive")
    
    pre_receive_path = pre_receive_normal if os.path.exists(pre_receive_normal) else pre_receive_bare
    
    if not os.path.exists(pre_receive_path):
        return []

    branches = []
    try:
        with open(pre_receive_path, "r") as f:
            content = f.read()

            if 'PROTECTED_BRANCHES=' in content:
                import re
                match = re.search(r'PROTECTED_BRANCHES=["\']([^"\']+)["\']', content, re.MULTILINE)
                if match:
                    branch_content = match.group(1)
                    for line in branch_content.split('\n'):
                        line = line.strip()
                        if line and line.startswith('refs/'):
                            branches.append(line)

            if not branches and CONFIG_DIR in content:
                existing_config = get_project_config(project_name)
                if os.path.exists(existing_config):
                    with open(existing_config, "r", encoding='utf-8') as cf:
                        data = json.load(cf)
                        for branch in data.get('branches', []):
                            if isinstance(branch, dict):
                                branches.append(branch['name'])
                            elif isinstance(branch, str):
                                branches.append(branch)
    except Exception:
        pass

    return branches

def create_project(project, base_path=None, overwrite=False):
    config_file = get_project_config(project)
    
    # 冗余检查：如果项目已存在且不允许覆盖，返回False表示跳过
    if os.path.exists(config_file) and not overwrite:
        return False
    
    branches = []
    if base_path:
        branches = extract_protected_branches(base_path, project)
    
    # 如果没有从仓库提取到分支，添加全局配置的分支
    if not branches:
        default_config_file = get_project_config(DEFAULT_CONFIG_NAME)
        if os.path.exists(default_config_file):
            default_branches, _ = read_branches(DEFAULT_CONFIG_NAME)
            branches = [b.copy() for b in default_branches]
    
    # 转换为JSON格式的分支数据
    json_branches = []
    for branch in branches:
        if isinstance(branch, dict):
            json_branches.append(branch)
        else:
            # 旧格式转换为新格式
            branch_name = branch
            locked = True
            if branch.startswith('# '):
                locked = False
                branch_name = branch[2:]
            elif branch.startswith('#'):
                locked = False
                branch_name = branch[1:]
            
            # 解析自动锁定时间
            auto_lock_time = 0
            if '|' in branch_name:
                parts = branch_name.split('|', 1)
                branch_name = parts[0]
                if parts[1].isdigit():
                    auto_lock_time = int(parts[1])
            
            json_branches.append({
                'name': branch_name,
                'locked': locked,
                'auto_lock_time': auto_lock_time
            })
    
    write_branches(project, json_branches)
    return True

def delete_project(project):
    config_file = get_project_config(project)
    txt_config_file = get_project_config_txt(project)
    
    if os.path.exists(config_file):
        os.remove(config_file)
    if os.path.exists(txt_config_file):
        os.remove(txt_config_file)
    return True

def scan_git_repos(base_path):
    repos = []
    if not os.path.exists(base_path):
        return repos

    for item in os.listdir(base_path):
        item_path = os.path.join(base_path, item)
        if os.path.isdir(item_path):
            # 检查裸仓库（hooks 直接在仓库目录下）
            pre_receive_bare = os.path.join(item_path, "hooks", "pre-receive")
            # 检查普通仓库（hooks 在 .git 目录下）
            pre_receive_normal = os.path.join(item_path, ".git", "hooks", "pre-receive")
            
            if os.path.exists(pre_receive_bare):
                repos.append(item)
            elif os.path.exists(pre_receive_normal):
                repos.append(item)
        elif item.endswith('.json') and not item.startswith('_'):
            # 如果是配置目录（包含 .json 文件），提取项目名
            repos.append(item[:-5])  # 去掉 .json 后缀
    return sorted(repos)

def check_auth():
    return session.get('logged_in', False)

# 全局定时器 - 用于周期性检测自动锁定
auto_lock_checker = None

def check_and_execute_auto_lock():
    """周期性检查并执行自动锁定"""
    current_time = time.time()
    print(f"\n[自动锁定检查器] 检查时间: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_time))}")
    
    all_projects = get_projects()
    total_locked = 0
    has_any_auto_lock_project = False
    
    for project in all_projects:
        branches, _ = read_branches(project)
        has_changes = False
        new_branches = []
        project_locked = 0
        project_has_auto_lock = False
        
        # 先检查是否有自动锁定的分支
        for b in branches:
            if b.get('auto_lock_time', 0) > 0:
                project_has_auto_lock = True
                break
        
        # 如果没有自动锁定的分支，跳过该项目
        if not project_has_auto_lock:
            continue
        
        has_any_auto_lock_project = True
        print(f"  [项目] {project}")
        
        for b in branches:
            auto_lock_time = b.get('auto_lock_time', 0)
            auto_lock_unit = b.get('auto_lock_unit', 'minutes')
            is_locked = b.get('locked', True)
            unlock_time = b.get('unlock_time', 0)
            
            # 计算自动锁定时间点（放开时间 + 自动锁定时长）
            if auto_lock_time > 0 and not is_locked and unlock_time > 0:
                # 转换为秒
                lock_duration_seconds = auto_lock_time * 60 if auto_lock_unit == 'minutes' else auto_lock_time * 60 * 60
                lock_time = unlock_time + lock_duration_seconds
                
                # 计算剩余时间
                remaining_seconds = lock_time - current_time
                remaining_str = ""
                if remaining_seconds <= 0:
                    remaining_str = "已到期"
                elif remaining_seconds < 60:
                    remaining_str = f"剩余 {int(remaining_seconds)} 秒"
                elif remaining_seconds < 3600:
                    remaining_str = f"剩余 {int(remaining_seconds / 60)} 分钟"
                else:
                    remaining_str = f"剩余 {int(remaining_seconds / 3600)} 小时"
                
                print(f"    [分支] {b['name']} - {auto_lock_time}{'小时' if auto_lock_unit == 'hours' else '分钟'}后锁定, {remaining_str}")
                
                # 如果已经到达自动锁定时间
                if current_time >= lock_time:
                    b['locked'] = True
                    b['unlock_time'] = 0     # 清除放开时间（保留自动锁定配置）
                    has_changes = True
                    project_locked += 1
                    total_locked += 1
                    print(f"      → 已锁定!")
                    log_operation("自动锁定分支", f"项目: {project}, 分支: {b['name']}")
            elif auto_lock_time > 0 and unlock_time == 0:
                pass  # 已锁定或等待放开的分支，不打印日志
            
            new_branches.append(b)
        
        if has_changes:
            write_branches(project, new_branches)
    
    if has_any_auto_lock_project:
        print(f"[自动锁定检查器] 完成，本次锁定 {total_locked} 个分支")
    else:
        print(f"[自动锁定检查器] 完成，无自动锁定配置")

def start_auto_lock_checker():
    """启动自动锁定检查器"""
    global auto_lock_checker
    
    if auto_lock_checker:
        auto_lock_checker.cancel()
    
    # 每隔5秒检查一次（可配置）
    auto_lock_checker = threading.Timer(5, run_auto_lock_checker_loop)
    auto_lock_checker.start()

def run_auto_lock_checker_loop():
    """自动锁定检查器主循环"""
    try:
        check_and_execute_auto_lock()
    except Exception as e:
        print(f"自动锁定检查器执行异常: {e}")
    
    # 继续下一次检查
    global auto_lock_checker
    auto_lock_checker = threading.Timer(5, run_auto_lock_checker_loop)
    auto_lock_checker.start()

def stop_auto_lock_checker():
    """停止自动锁定检查器"""
    global auto_lock_checker
    if auto_lock_checker:
        auto_lock_checker.cancel()
        auto_lock_checker = None

def cancel_auto_lock(project):
    """手动锁定时取消定时任务（保留配置，只清除unlock_time）"""
    pass

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        config_username, config_password = get_auth_credentials()
        if username == config_username and password == config_password:
            session['logged_in'] = True
            session.permanent = True  # 启用持久化session，支持超时
            session['last_activity'] = time.time()  # 记录登录时间
            log_operation("用户登录", f"用户名: {username}")
            return redirect(url_for('index'))
        else:
            error = "用户名或密码错误"
    return render_template('login.html', error=error)

@app.route("/logout")
def logout():
    log_operation("用户登出")
    session['logged_in'] = False
    return redirect(url_for('login'))

@app.route("/get_logs")
def get_logs():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    
    # 支持按日期获取日志
    date_str = request.args.get("date", "").strip()
    logs = get_operations_log(date_str)
    
    # 获取可用的日志日期
    available_dates = get_available_log_dates()
    today = time.strftime("%Y-%m-%d", time.localtime())
    
    return json.dumps({
        "success": True, 
        "logs": logs,
        "available_dates": available_dates,
        "current_date": date_str if date_str else today
    })

@app.route("/")
def index():
    if not check_auth():
        return redirect(url_for('login'))
    
    # 检查会话超时
    current_config = load_config()
    session_timeout_minutes = current_config.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT)
    last_activity = session.get('last_activity', 0)
    current_time = time.time()
    
    if current_time - last_activity > session_timeout_minutes * 60:
        log_operation("会话超时自动退出")
        session['logged_in'] = False
        return redirect(url_for('login'))
    
    # 更新最后活动时间
    session['last_activity'] = current_time

    projects = get_projects()
    scanned_repos = session.pop('scanned_repos', None)

    # 检查全局默认配置是否存在
    has_default_config = os.path.exists(get_project_config(DEFAULT_CONFIG_NAME))

    project_branches = {}
    project_auto_lock = {}
    branch_count = 0
    
    # 读取全局默认配置（如果存在）
    if has_default_config:
        default_branches, default_auto_lock = read_branches(DEFAULT_CONFIG_NAME)
        project_branches[DEFAULT_CONFIG_NAME] = default_branches
        project_auto_lock[DEFAULT_CONFIG_NAME] = default_auto_lock
        branch_count += len(default_branches)
    
    # 读取各个项目的配置
    for project in projects:
        branches, auto_lock_times = read_branches(project)
        project_branches[project] = branches
        project_auto_lock[project] = auto_lock_times
        branch_count += len(branches)

    # 获取当前会话超时设置
    session_timeout = current_config.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT)
    
    # 获取操作日志
    logs = get_operations_log()

    return render_template('index.html',
                          projects=projects,
                          project_branches=project_branches,
                          project_auto_lock=project_auto_lock,
                          project_count=len(projects),
                          branch_count=branch_count,
                          scanned_repos=scanned_repos,
                          session_timeout=session_timeout,
                          DEFAULT_CONFIG_NAME=DEFAULT_CONFIG_NAME,
                          has_default_config=has_default_config,
                          logs=logs)

@app.route("/update_settings", methods=["POST"])
def update_settings():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    session_timeout = request.form.get("session_timeout", "").strip()
    new_username = request.form.get("username", "").strip()
    new_password = request.form.get("password", "").strip()

    config = load_config()
    config_changed = False

    if session_timeout and session_timeout.isdigit():
        timeout_minutes = int(session_timeout)
        if timeout_minutes > 0 and timeout_minutes <= 1440:
            config["session_timeout_minutes"] = timeout_minutes
            app.permanent_session_lifetime = timedelta(minutes=timeout_minutes)
            config_changed = True
        else:
            return json.dumps({"success": False, "error": "超时时间必须在 1-1440 分钟之间"})

    if new_username:
        if len(new_username) < 2:
            return json.dumps({"success": False, "error": "用户名至少2个字符"})
        config["username"] = new_username
        config_changed = True

    if new_password:
        if len(new_password) < 4:
            return json.dumps({"success": False, "error": "密码至少4个字符"})
        config["password"] = new_password
        config_changed = True

    if config_changed:
        save_config(config)
        return json.dumps({"success": True})

    return json.dumps({"success": False, "error": "没有需要更新的配置"})

# 默认测试仓库路径
DEFAULT_TEST_REPO_PATH = os.path.join(BASE_DIR, 'test-repos')

@app.route("/scan_repos", methods=["POST"])
def scan_repos():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    base_path = request.form.get("base_path", "").strip()
    
    # 如果没有提供路径，使用默认测试路径
    if not base_path:
        base_path = DEFAULT_TEST_REPO_PATH
        # 如果测试路径不存在，创建它
        if not os.path.exists(base_path):
            os.makedirs(base_path, exist_ok=True)
    
    repos = scan_git_repos(base_path)
    session['scanned_repos'] = repos
    session['scan_base_path'] = base_path
    return json.dumps({"success": True, "repos": repos, "count": len(repos)})

@app.route("/add_single_project")
def add_single_project():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    project = request.args.get("project", "").strip()
    base_path = session.get('scan_base_path', '')
    if project:
        create_project(project, base_path)
        log_operation("添加项目", f"项目: {project}")
        return json.dumps({"success": True})
    return json.dumps({"success": False, "error": "项目名称为空"})

@app.route("/batch_add_projects", methods=["POST"])
def batch_add_projects():
    if not check_auth():
        return json.dumps({"success": False, "message": "未授权访问"})
    
    try:
        projects_data = request.form.get("projects", "[]")
        projects = json.loads(projects_data)
        
        added = 0
        skipped = 0
        added_projects = []
        
        for project in projects:
            if create_project(project.strip()):
                added += 1
                added_projects.append(project.strip())
            else:
                skipped += 1
        
        if added > 0:
            log_operation("批量添加项目", f"添加: {added} 个, 跳过: {skipped} 个, 项目: {', '.join(added_projects)}")
        
        return json.dumps({"success": True, "added": added, "skipped": skipped, "addedProjects": added_projects})
    except Exception as e:
        print(f"批量添加项目失败: {e}")
        return json.dumps({"success": False, "message": str(e)})

@app.route("/add_project", methods=["POST"])
def add_project():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    project = request.form.get("project", "").strip()
    if not project:
        return json.dumps({"success": False, "error": "项目名称不能为空"})
    
    # 检查项目是否已存在
    config_file = get_project_config(project)
    if os.path.exists(config_file):
        return json.dumps({"success": False, "error": "项目已存在"})
    
    # 检查项目名是否包含特殊字符
    if '/' in project or '\\' in project or '..' in project:
        return json.dumps({"success": False, "error": "项目名称包含非法字符"})
    
    create_project(project)
    log_operation("创建项目", f"项目: {project}")
    return json.dumps({"success": True, "message": f"项目 \"{project}\" 创建成功"})

@app.route("/get_project_branches")
def get_project_branches():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    project = request.args.get("project", "").strip()
    if project:
        branches, _ = read_branches(project)
        return json.dumps({"success": True, "branches": branches})
    return json.dumps({"success": False, "error": "项目名称为空"})

@app.route("/create_default_config", methods=["GET", "POST"])
def create_default_config():
    if not check_auth():
        if request.method == 'POST':
            return json.dumps({"success": False, "error": "未登录"})
        else:
            return redirect(url_for('login'))
    
    default_config_file = get_project_config(DEFAULT_CONFIG_NAME)
    if not os.path.exists(default_config_file):
        write_branches(DEFAULT_CONFIG_NAME, [])
    
    if request.method == 'POST':
        return json.dumps({"success": True})
    else:
        return redirect(url_for('index'))

@app.route("/del_project")
def del_project():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    project = request.args.get("project", "").strip()
    if project:
        delete_project(project)
        log_operation("删除项目", f"项目: {project}")
        return json.dumps({"success": True})
    return json.dumps({"success": False, "error": "项目名称为空"})

@app.route("/stats")
def stats():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    
    projects = get_projects()
    project_count = len(projects)
    
    branch_count = 0
    for project in projects:
        branches, _ = read_branches(project)
        branch_count += len(branches)
    
    return json.dumps({
        "success": True,
        "project_count": project_count,
        "branch_count": branch_count
    })

@app.route("/add_branch", methods=["POST"])
def add_branch():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    project = request.form.get("project", "").strip()
    branch = request.form.get("branch", "").strip()
    sync_all = request.form.get("sync_all", "").strip().lower() == "true"
    
    if project and branch:
        branches, _ = read_branches(project)
        # 检查分支是否已存在
        branch_names = [b['name'] if isinstance(b, dict) else get_branch_name(b) for b in branches]
        branch_name = get_branch_name(branch)
        added_count = 0
        
        if branch_name not in branch_names:
            # 以JSON字典格式添加新分支
            branches.append({
                'name': branch_name,
                'locked': True,
                'auto_lock_time': 0,
                'auto_lock_unit': 'minutes'
            })
            write_branches(project, branches)
            added_count = 1
            log_msg = f"项目: {project}, 分支: {branch}"
            
            # 如果是全局配置且勾选了同步到所有项目，则添加到其他所有项目
            if sync_all and project == DEFAULT_CONFIG_NAME:
                all_projects = get_projects()
                for p in all_projects:
                    if p == DEFAULT_CONFIG_NAME:
                        continue  # 跳过全局配置
                    p_branches, _ = read_branches(p)
                    p_branch_names = [b['name'] if isinstance(b, dict) else get_branch_name(b) for b in p_branches]
                    if branch_name not in p_branch_names:
                        p_branches.append({
                            'name': branch_name,
                            'locked': True,
                            'auto_lock_time': 0,
                            'auto_lock_unit': 'minutes'
                        })
                        write_branches(p, p_branches)
                        added_count += 1
                log_msg += f"（同步到 {added_count - 1} 个项目）"
            
            log_operation("添加分支", log_msg)
            return json.dumps({"success": True, "added_count": added_count})
        else:
            return json.dumps({"success": False, "error": "分支已存在"})
    return json.dumps({"success": False, "error": "参数错误"})

@app.route("/rename_branch")
def rename_branch():
    if not check_auth():
        return json.dumps({"success": False})
    
    project = request.args.get("project", "").strip()
    old_branch = request.args.get("old_branch", "").strip()
    new_branch = request.args.get("new_branch", "").strip()
    
    if project and old_branch and new_branch:
        branches, auto_lock_times = read_branches(project)
        
        # 检查新分支名是否与其他分支重复
        for branch in branches:
            branch_name = branch.get('name') if isinstance(branch, dict) else branch
            if branch_name == new_branch and branch_name != old_branch:
                return json.dumps({"success": False, "error": "分支名已存在"})
        
        # 找到并替换旧分支名为新分支名
        new_branches = []
        for branch in branches:
            if isinstance(branch, dict):
                # JSON 格式：修改 name 字段
                if branch.get('name') == old_branch:
                    new_branches.append({
                        'name': new_branch,
                        'locked': branch.get('locked', True),
                        'auto_lock_time': branch.get('auto_lock_time', 0),
                        'auto_lock_unit': branch.get('auto_lock_unit', 'minutes')
                    })
                else:
                    new_branches.append(branch)
            else:
                # 字符串格式：直接替换
                if branch == old_branch:
                    new_branches.append(new_branch)
                else:
                    new_branches.append(branch)
        write_branches(project, new_branches)
        log_operation("重命名分支", f"项目: {project}, 从: {old_branch}, 到: {new_branch}")
        return json.dumps({"success": True})
    
    return json.dumps({"success": False})

@app.route("/del_branch")
def del_branch():
    if not check_auth():
        return redirect(url_for('login'))
    project = request.args.get("project", "").strip()
    branch = request.args.get("branch", "").strip()
    if project and branch:
        # 读取项目配置
        config_file = get_project_config(project)
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    branches = data.get('branches', [])
                    # 直接比较原始分支名称，不进行额外转换
                    # 找到匹配的分支并删除
                    new_branches = []
                    for b in branches:
                        b_name = b['name'] if isinstance(b, dict) else b
                        if b_name != branch:
                            new_branches.append(b)
                    if len(new_branches) < len(branches):
                        write_branches(project, new_branches)
                        log_operation("删除分支", f"项目: {project}, 分支: {branch}")
                        return json.dumps({"success": True, "message": "分支删除成功"})
                    else:
                        return json.dumps({"success": False, "error": "分支不存在"})
            except Exception as e:
                print(f"删除分支失败: {e}")
                return json.dumps({"success": False, "error": str(e)})
    return json.dumps({"success": False, "error": "参数错误"})

@app.route("/toggle_branch")
def toggle_branch():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()
    branch_name = request.args.get("branch", "").strip()
    status = request.args.get("status", "").strip()

    if not project or not branch_name:
        return json.dumps({"success": False, "error": "参数错误"})

    # 读取项目原始配置
    config_file = get_project_config(project)
    if not os.path.exists(config_file):
        return json.dumps({"success": False, "error": "项目配置不存在"})

    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            branches = data.get('branches', [])
            # 标准化分支列表
            normalized_branches = []
            for b in branches:
                if isinstance(b, str):
                    # 字符串格式转换为字典格式
                    b_name = b
                    locked = True
                    if b.startswith('# '):
                        locked = False
                        b_name = b[2:]
                    elif b.startswith('#'):
                        locked = False
                        b_name = b[1:]
                    normalized_branches.append({
                        'name': b_name,
                        'locked': locked,
                        'auto_lock_time': 0,
                        'auto_lock_unit': 'minutes',
                        'unlock_time': 0
                    })
                else:
                    normalized_branches.append(b)

            action = ""
            current_time = time.time()
            # 查找并修改分支状态
            for b in normalized_branches:
                if b['name'] == branch_name:
                    if status == 'lock':
                        # 锁定：设置 locked=True
                        cancel_auto_lock(project)
                        b['locked'] = True
                        b['unlock_time'] = 0  # 清除放开时间
                        action = "锁定分支"
                    elif status == 'unlock':
                        # 放开：设置 locked=False
                        b['locked'] = False
                        b['unlock_time'] = current_time  # 记录放开时间
                        action = "放开分支"
                    break

            write_branches(project, normalized_branches)
            log_operation(action, f"项目: {project}, 分支: {branch_name}")
            return json.dumps({"success": True})
    except Exception as e:
        print(f"切换分支状态失败: {e}")
        return json.dumps({"success": False, "error": str(e)})

@app.route("/batch_toggle")
def batch_toggle():
    if not check_auth():
        return json.dumps({"success": False})

    project = request.args.get("project", "").strip()
    status = request.args.get("status", "").strip()
    auto_lock_minutes = int(request.args.get("auto_lock", "0"))

    if not project:
        return json.dumps({"success": False})

    # 读取项目配置
    config_file = get_project_config(project)
    if not os.path.exists(config_file):
        return json.dumps({"success": False})

    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            branches = data.get('branches', [])
            # 标准化分支列表
            normalized_branches = []
            for b in branches:
                if isinstance(b, str):
                    # 字符串格式转换为字典格式
                    b_name = b
                    locked = True
                    if b.startswith('# '):
                        locked = False
                        b_name = b[2:]
                    elif b.startswith('#'):
                        locked = False
                        b_name = b[1:]
                    normalized_branches.append({
                        'name': b_name,
                        'locked': locked,
                        'auto_lock_time': 0,
                        'auto_lock_unit': 'minutes',
                        'unlock_time': 0
                    })
                else:
                    normalized_branches.append(b)

            if status == 'lock':
                # 批量锁定时取消定时任务（保留自动锁定配置）
                cancel_auto_lock(project)
                for b in normalized_branches:
                    b['locked'] = True
            elif status == 'unlock':
                # 批量放开
                for b in normalized_branches:
                    b['locked'] = False
                    if auto_lock_minutes > 0:
                        b['auto_lock_time'] = auto_lock_minutes
                # 如果设置了自动锁定时间
                if auto_lock_minutes > 0:
                    schedule_auto_lock(project, auto_lock_minutes)

            write_branches(project, normalized_branches)
            
            action = "批量锁定分支" if status == 'lock' else "批量放开分支"
            log_operation(action, f"项目: {project}, 自动锁定: {auto_lock_minutes}分钟")
            
            return json.dumps({"success": True})
    except Exception as e:
        print(f"批量操作失败: {e}")
        return json.dumps({"success": False})

@app.route("/batch_delete_branches")
def batch_delete_branches():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()
    branches_str = request.args.get("branches", "").strip()

    if not project or not branches_str:
        return json.dumps({"success": False, "error": "参数错误"})

    selected_branches = branches_str.split(',')
    # 标准化选中的分支名称
    selected_branches_normalized = [normalize_branch_name(b) for b in selected_branches]

    # 读取项目配置
    config_file = get_project_config(project)
    if not os.path.exists(config_file):
        return json.dumps({"success": False, "error": "项目配置不存在"})

    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            branches = data.get('branches', [])
            # 标准化分支列表
            normalized_branches = []
            for b in branches:
                if isinstance(b, str):
                    # 字符串格式转换为字典格式
                    b_name = b
                    locked = True
                    if b.startswith('# '):
                        locked = False
                        b_name = b[2:]
                    elif b.startswith('#'):
                        locked = False
                        b_name = b[1:]
                    normalized_branches.append({
                        'name': b_name,
                        'locked': locked,
                        'auto_lock_time': 0,
                        'auto_lock_unit': 'minutes',
                        'unlock_time': 0
                    })
                else:
                    normalized_branches.append(b)

            # 过滤掉选中的分支
            remaining_branches = []
            deleted_count = 0
            for b in normalized_branches:
                branch_name = normalize_branch_name(b['name'])
                if branch_name not in selected_branches_normalized:
                    remaining_branches.append(b)
                else:
                    deleted_count += 1

            if deleted_count > 0:
                write_branches(project, remaining_branches)
                log_operation("批量删除分支", f"项目: {project}, 删除 {deleted_count} 个分支: {', '.join(selected_branches)}")

            return json.dumps({"success": True, "deleted_count": deleted_count})
    except Exception as e:
        print(f"批量删除分支失败: {e}")
        return json.dumps({"success": False, "error": str(e)})

@app.route("/batch_lock_selected")
def batch_lock_selected():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()
    branches_str = request.args.get("branches", "").strip()

    if not project or not branches_str:
        return json.dumps({"success": False, "error": "参数错误"})

    # 手动锁定时取消定时任务
    cancel_auto_lock(project)

    selected_branches = branches_str.split(',')
    # 标准化选中的分支名称
    selected_branches_normalized = [normalize_branch_name(b) for b in selected_branches]

    # 读取项目原始配置
    config_file = get_project_config(project)
    if not os.path.exists(config_file):
        return json.dumps({"success": False, "error": "项目配置不存在"})

    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            branches = data.get('branches', [])
            # 标准化分支列表
            normalized_branches = []
            for b in branches:
                if isinstance(b, str):
                    # 字符串格式转换为字典格式
                    b_name = b
                    locked = True
                    if b.startswith('# '):
                        locked = False
                        b_name = b[2:]
                    elif b.startswith('#'):
                        locked = False
                        b_name = b[1:]
                    normalized_branches.append({
                        'name': b_name,
                        'locked': locked,
                        'auto_lock_time': 0,
                        'auto_lock_unit': 'minutes',
                        'unlock_time': 0
                    })
                else:
                    normalized_branches.append(b)

            # 将选中的分支设置为锁定状态
            for b in normalized_branches:
                branch_name = normalize_branch_name(b['name'])
                if branch_name in selected_branches_normalized:
                    b['locked'] = True
                    b['auto_lock_time'] = 0

            write_branches(project, normalized_branches)
            
            log_operation("批量锁定选中分支", f"项目: {project}, 分支: {branches_str}")
            
            return json.dumps({"success": True, "success_count": len(selected_branches)})
    except Exception as e:
        print(f"批量锁定选中分支失败: {e}")
        return json.dumps({"success": False, "error": str(e)})

@app.route("/check_session")
def check_session():
    if not check_auth():
        return json.dumps({"valid": False, "error": "未登录"})

    current_config = load_config()
    session_timeout_minutes = current_config.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT)
    last_activity = session.get('last_activity', 0)
    current_time = time.time()
    elapsed = current_time - last_activity
    remaining_seconds = int((session_timeout_minutes * 60) - elapsed)

    if remaining_seconds <= 0:
        log_operation("会话超时自动退出")
        session['logged_in'] = False
        return json.dumps({"valid": False, "error": "会话已过期"})

    session['last_activity'] = current_time

    return json.dumps({
        "valid": True,
        "remaining_seconds": remaining_seconds,
        "timeout_minutes": session_timeout_minutes
    })

@app.route("/get_branch_status")
def get_branch_status():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()

    if project:
        branches, _ = read_branches(project)
        branch_status = {}
        for b in branches:
            branch_status[b['name']] = {
                'locked': b.get('locked', True),
                'auto_lock_time': b.get('auto_lock_time', 0),
                'auto_lock_unit': b.get('auto_lock_unit', 'minutes')
            }
        return json.dumps({"success": True, "project": project, "branches": branch_status})
    else:
        all_projects = get_projects()
        all_status = {}
        
        for project_name in all_projects:
            branches, _ = read_branches(project_name)
            branch_status = {}
            for b in branches:
                branch_status[b['name']] = {
                    'locked': b.get('locked', True),
                    'auto_lock_time': b.get('auto_lock_time', 0),
                    'auto_lock_unit': b.get('auto_lock_unit', 'minutes')
                }
            all_status[project_name] = branch_status
        
        return json.dumps({"success": True, "projects": all_status})

@app.route("/batch_unlock_selected")
def batch_unlock_selected():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()
    branches_str = request.args.get("branches", "").strip()
    auto_lock_value = int(request.args.get("auto_lock", "0"))
    auto_lock_unit = request.args.get("auto_lock_unit", "minutes")

    if not project or not branches_str:
        return json.dumps({"success": False, "error": "参数错误"})

    selected_branches = branches_str.split(',')
    # 标准化选中的分支名称
    selected_branches_normalized = [normalize_branch_name(b) for b in selected_branches]
    
    branches, _ = read_branches(project)
    
    # 记录当前时间（放开时间）
    current_time = time.time()

    # 将选中的分支设置为放开状态
    for b in branches:
        branch_name = normalize_branch_name(b['name'])
        if branch_name in selected_branches_normalized:
            b['locked'] = False
            b['auto_lock_time'] = auto_lock_value
            b['auto_lock_unit'] = auto_lock_unit
            # 记录放开时间（用于计算自动锁定时间点）
            b['unlock_time'] = current_time

    write_branches(project, branches)
    
    log_operation("批量放开选中分支", f"项目: {project}, 分支: {branches_str}, 自动锁定: {auto_lock_value}{auto_lock_unit}")
    
    return json.dumps({"success": True})

@app.route("/schedule_lock")
def schedule_lock():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    project = request.args.get("project", "").strip()
    branches_str = request.args.get("branches", "").strip()
    minutes_value = int(request.args.get("minutes", "0"))
    unit = request.args.get("unit", "minutes")

    if not project or not branches_str:
        return json.dumps({"success": False, "error": "参数错误"})

    selected_branches = branches_str.split(',')
    # 标准化选中的分支名称
    selected_branches_normalized = [normalize_branch_name(b) for b in selected_branches]
    
    branches, _ = read_branches(project)
    
    # 记录当前时间（如果分支已放开，作为放开时间）
    current_time = time.time()

    # 为选中的分支设置自动锁定时间
    for b in branches:
        branch_name = normalize_branch_name(b['name'])
        if branch_name in selected_branches_normalized:
            b['auto_lock_time'] = minutes_value
            b['auto_lock_unit'] = unit
            # 如果分支已放开，记录当前时间作为放开时间
            if not b.get('locked', True) and b.get('unlock_time', 0) == 0:
                b['unlock_time'] = current_time

    write_branches(project, branches)

    log_operation("设置自动锁定", f"项目: {project}, 分支: {selected_branches}, 时间: {minutes_value}{unit}")
    return json.dumps({"success": True, "success_count": len(selected_branches)})

@app.route("/sync_branch_to_all")
def sync_branch_to_all():
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})

    branch_name = request.args.get("branch", "").strip()
    
    if not branch_name:
        return json.dumps({"success": False, "error": "分支名称为空"})

    # 从全局配置获取该分支的完整信息
    default_branches, _ = read_branches(DEFAULT_CONFIG_NAME)
    branch_info = None
    for b in default_branches:
        if b['name'] == branch_name:
            branch_info = b
            break
    
    if not branch_info:
        return json.dumps({"success": False, "error": "全局配置中不存在该分支"})

    # 获取所有项目
    all_projects = get_projects()
    added_count = 0
    added_projects = []

    # 将分支添加到所有项目
    for project in all_projects:
        if project == DEFAULT_CONFIG_NAME:
            continue  # 跳过全局配置
        
        branches, _ = read_branches(project)
        branch_names = [b['name'] for b in branches]
        
        if branch_name not in branch_names:
            # 添加分支（保持与全局配置相同的锁定状态和自动锁定时间）
            branches.append({
                'name': branch_name,
                'locked': branch_info.get('locked', True),
                'auto_lock_time': branch_info.get('auto_lock_time', 0),
                'auto_lock_unit': branch_info.get('auto_lock_unit', 'minutes')
            })
            write_branches(project, branches)
            added_count += 1
            added_projects.append(project)

    log_operation("同步分支到所有项目", f"分支: {branch_name}, 同步到 {added_count} 个项目: {', '.join(added_projects) if added_projects else '无'}")
    return json.dumps({"success": True, "count": added_count})

@app.route("/set_auto_lock", methods=["POST"])
def set_auto_lock():
    """设置单个分支的自动锁定时间"""
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    
    project = request.form.get("project", "").strip()
    branch = request.form.get("branch", "").strip()
    minutes = request.form.get("minutes", "0").strip()
    unit = request.form.get("unit", "minutes").strip()
    
    if not project or not branch:
        return json.dumps({"success": False, "error": "项目和分支名称不能为空"})
    
    try:
        auto_lock_time = int(minutes)
        if auto_lock_time < 0:
            auto_lock_time = 0
    except ValueError:
        return json.dumps({"success": False, "error": "自动锁定时间必须是有效的整数"})
    
    branches, _ = read_branches(project)
    found = False
    for b in branches:
        if b['name'] == branch:
            b['auto_lock_time'] = auto_lock_time
            b['auto_lock_unit'] = unit
            found = True
            break
    
    if not found:
        return json.dumps({"success": False, "error": "分支不存在"})
    
    write_branches(project, branches)
    
    unit_str = "小时" if unit == "hours" else "分钟"
    log_operation("设置自动锁定时间", f"项目: {project}, 分支: {branch}, 时间: {auto_lock_time}{unit_str}")
    return json.dumps({"success": True, "auto_lock_time": auto_lock_time, "auto_lock_unit": unit})

@app.route("/get_auto_lock_tasks")
def get_auto_lock_tasks():
    """获取所有自动锁定任务的状态"""
    if not check_auth():
        return json.dumps({"success": False, "error": "未登录"})
    
    all_projects = get_projects()
    tasks = []
    current_time = time.time()
    
    for project in all_projects:
        branches, _ = read_branches(project)
        for b in branches:
            auto_lock_time = b.get('auto_lock_time', 0)
            is_locked = b.get('locked', True)
            
            # 只统计：放开了分支并且设置了自动锁定的
            if auto_lock_time > 0 and not is_locked:
                auto_lock_unit = b.get('auto_lock_unit', 'minutes')
                unlock_time = b.get('unlock_time', 0)
                
                task = {
                    'project': project,
                    'branch': b['name'],
                    'auto_lock_time': auto_lock_time,
                    'auto_lock_unit': auto_lock_unit,
                    'is_locked': is_locked,
                    'unlock_time': unlock_time,
                    'status': '',
                    'remaining_seconds': 0
                }
                
                if unlock_time > 0:
                    lock_duration_seconds = auto_lock_time * 60 if auto_lock_unit == 'minutes' else auto_lock_time * 60 * 60
                    lock_time = unlock_time + lock_duration_seconds
                    remaining_seconds = max(0, lock_time - current_time)
                    task['status'] = '倒计时中'
                    task['remaining_seconds'] = remaining_seconds
                else:
                    task['status'] = '等待放开'
                
                tasks.append(task)
    
    return json.dumps({"success": True, "tasks": tasks})

import signal
import sys

def signal_handler(sig, frame):
    """处理程序退出信号"""
    print("\n正在关闭服务器...")
    stop_auto_lock_checker()
    sys.exit(0)

if __name__ == "__main__":
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    
    config = load_config()
    port = config.get("port", 5000)
    
    # 启动自动锁定检查器（程序启动后一直运行，周期性检查）
    start_auto_lock_checker()
    print("自动锁定检查器已启动，每5秒检查一次")
    
    try:
        app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
    except Exception as e:
        print(f"服务器启动失败: {e}")
        stop_auto_lock_checker()
        sys.exit(1)
