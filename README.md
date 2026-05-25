# Git 分支保护管理工具

基于 Flask 的 Git 分支保护 Web 管理界面，用于管理多个项目的分支保护策略。

## 功能特性

- **项目管理**：添加、删除项目，支持手动添加和批量扫描仓库
- **分支保护**：锁定/放开分支，禁止向受保护分支直接推送
- **自动锁定**：设置分支自动锁定时间，放开后自动恢复锁定
- **全局配置**：统一管理默认分支配置，应用到所有项目
- **会话管理**：自动超时检测，安全退出登录
- **状态同步**：定期刷新分支状态，实时显示最新锁定状态
- **历史通知**：操作记录历史管理，支持查看和清除通知历史
- **后台任务**：自动锁定检查器，定时检查并执行自动锁定任务
- **批量操作**：批量添加项目、批量切换锁定状态、批量删除分支
- **定时锁定**：支持定时锁定任务管理
- **分支重命名**：支持修改分支名称

## 技术栈

- **后端**：Flask 2.0+
- **前端**：原生 JavaScript + Bootstrap
- **数据存储**：JSON 文件
- **Git 钩子**：pre-receive 钩子脚本

## 项目结构

```
git-ctl-webui/
├── app.py                    # Flask 主应用
├── bin/                      # 管理脚本
│   ├── git-ctl.sh            # 启动/停止管理脚本
│   ├── git-ctl-webui.service # systemd 服务配置
│   ├── install-service.sh    # 服务安装脚本
│   ├── chmod.sh              # 权限设置脚本
│   └── README.md             # 脚本说明
├── config/                   # 配置目录
│   ├── config.json           # 系统配置（会话超时、登录凭证、端口等）
│   └── projects/              # 项目配置目录
│       ├── _default.json     # 全局默认配置
│       ├── _default.txt      # 全局默认配置（txt格式，供钩子使用）
│       └── {project}.json/txt # 各项目配置
├── hooks/                    # Git 钩子脚本
│   └── pre-receive           # 分支保护钩子
├── log/                      # 日志目录
│   ├── app.log               # 应用日志
│   └── operations_*.log      # 操作日志（按日期）
├── templates/                # Jinja2 模板
│   ├── index.html            # 主页面
│   ├── index-1.html          # 备用模板
│   └── login.html            # 登录页面
├── static/                   # 静态资源
│   ├── app.js                # 前端 JavaScript
│   └── style.css             # 样式文件
└── test-repos/               # 测试仓库目录
```

## 快速开始

### 1. 环境准备（CentOS 7）

```bash
# 安装 Python3 和 pip
yum install -y python36 python36-pip

# 升级 pip
pip3 install --upgrade pip
```

### 2. 安装依赖

```bash
pip3 install flask
```

### 3. 启动应用

#### 使用管理脚本（推荐）

```bash
# 启动服务（后台运行）
bash bin/git-ctl.sh start

# 停止服务
bash bin/git-ctl.sh stop

# 重启服务
bash bin/git-ctl.sh restart

# 查看状态
bash bin/git-ctl.sh status
```

**详细说明**：
- 服务后台运行，不占用终端
- 日志输出到 `log/app.log`（可通过 logrotate 管理日志大小）
- PID 文件存放在 `/var/run/git-ctl-webui.pid`

### 日志管理

使用 logrotate 管理日志文件大小：

```bash
# 安装 logrotate（如果没有）
yum install -y logrotate

# 配置 logrotate
cp logrotate.conf /etc/logrotate.d/git-ctl-webui

# 测试配置
logrotate -d /etc/logrotate.d/git-ctl-webui

# 手动执行一次
logrotate -f /etc/logrotate.d/git-ctl-webui
```

**logrotate 配置说明** (`logrotate.conf`)：
- `daily`：每天轮转一次
- `rotate 7`：保留7个历史日志
- `compress`：压缩历史日志
- `delaycompress`：延迟压缩，等下一次轮转时压缩
- `copytruncate`：复制原文件后清空，不中断服务写入

应用默认运行在 `http://localhost:50000`（端口可在 config.json 中配置）

### 4. 登录

- 用户名：`admin`（可在 config.json 中修改）
- 密码：`admin`（可在 config.json 中修改）

## 配置说明

### 系统配置 (config/config.json)

```json
{
    "session_timeout_minutes": 10,
    "username": "admin",
    "password": "admin",
    "port": 50000
}
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| session_timeout_minutes | 会话超时时间（分钟） | 10 |
| username | 登录用户名 | admin |
| password | 登录密码 | admin |
| port | Web 服务端口 | 50000 |

### 项目配置 (config/projects/{project}.json)

```json
{
    "branches": [
        {
            "name": "main",
            "locked": true,
            "auto_lock_time": 30,
            "auto_lock_unit": "minutes"
        }
    ]
}
```

| 参数 | 说明 |
|------|------|
| name | 分支名称（直接保存用户输入的名称，不自动添加前缀） |
| locked | 是否锁定（true=锁定，false=放开） |
| auto_lock_time | 自动锁定时间（0=不自动锁定） |
| auto_lock_unit | 时间单位（minutes/hours） |

## Git 钩子配置

将 `hooks/pre-receive` 脚本复制到 Git 仓库的 `hooks/` 目录：

```bash
cp hooks/pre-receive /path/to/git/repo/hooks/pre-receive
chmod +x /path/to/git/repo/hooks/pre-receive
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| GIT_CTL_CONFIG_DIR | 配置目录路径 | /opt/git-ctl-webui/config |

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /login | POST | 用户登录 |
| /logout | GET | 用户登出 |
| /check_session | GET | 检查会话状态 |
| /get_logs | GET | 获取操作日志 |
| /add_project | POST | 添加项目 |
| /add_single_project | GET | 添加单个项目 |
| /batch_add_projects | POST | 批量添加项目 |
| /del_project | GET | 删除项目 |
| /scan_repos | POST | 扫描仓库 |
| /get_project_branches | GET | 获取项目分支 |
| /add_branch | POST | 添加分支 |
| /del_branch | GET | 删除分支 |
| /rename_branch | GET | 重命名分支 |
| /toggle_branch | GET | 切换分支锁定状态 |
| /batch_toggle | GET | 批量切换锁定状态 |
| /batch_delete_branches | POST | 批量删除分支 |
| /batch_lock_selected | POST | 批量锁定选中分支 |
| /batch_unlock_selected | POST | 批量解锁选中分支 |
| /sync_branch_to_all | GET | 同步分支到所有项目 |
| /stats | GET | 获取统计信息 |
| /update_settings | POST | 更新系统设置 |
| /create_default_config | GET/POST | 创建默认配置 |
| /get_branch_status | GET | 获取分支状态 |
| /schedule_lock | POST | 定时锁定任务 |
| /set_auto_lock | POST | 设置自动锁定 |
| /get_auto_lock_tasks | GET | 获取自动锁定任务列表 |

## 使用说明

### 添加项目

1. 在"项目管理"选项卡中输入项目名称
2. 或点击"扫描仓库"按钮批量发现 Git 仓库
3. 支持批量添加选中的项目

### 管理分支

1. 选择项目后，点击"添加分支"按钮
2. 输入分支名称（直接输入，如 `main`，不需要 `refs/heads/` 前缀）
3. 使用锁定/放开按钮控制分支保护状态
4. 支持编辑、删除、重命名分支

### 自动锁定

1. 在分支编辑界面设置"自动锁定时间"
2. 放开分支后，系统会在指定时间后自动锁定
3. 支持管理定时锁定任务

### 全局配置

1. 选择"全局配置"项目
2. 配置默认分支保护策略
3. 使用"应用到所有项目"按钮同步配置

### 批量操作

1. 勾选多个分支
2. 使用批量操作按钮进行批量锁定、解锁或删除

## 安全特性

- 会话超时自动退出
- 所有操作记录日志
- 分支保护钩子验证

## 许可证

MIT License