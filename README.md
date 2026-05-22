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

## 技术栈

- **后端**：Flask 2.0+
- **前端**：原生 JavaScript + Bootstrap
- **数据存储**：JSON 文件
- **Git 钩子**：pre-receive 钩子脚本

## 项目结构

```
git-ctl-webui/
├── app.py                    # Flask 主应用
├── config/                   # 配置目录
│   ├── config.json           # 系统配置（会话超时、登录凭证、端口等）
│   └── projects/              # 项目配置目录
│       ├── _default.json     # 全局默认配置
│       ├── _default.txt      # 全局默认配置（txt格式，供钩子使用）
│       └── {project}.json/txt # 各项目配置
├── hooks/                    # Git 钩子脚本
│   └── pre-receive           # 分支保护钩子
├── log/                      # 日志目录
│   └── operations.log        # 操作日志
├── templates/                # Jinja2 模板
│   └── index.html            # 主页面
├── static/                   # 静态资源
│   └── app.js                # 前端 JavaScript
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

应用默认运行在 `http://localhost:5000`（端口可在 config.json 中配置）

### 4. 登录

- 用户名：`admin`（可在 config.json 中修改）
- 密码：`admin`（可在 config.json 中修改）

## 配置说明

### 系统配置 (config/config.json)

```json
{
    "session_timeout_minutes": 5,
    "username": "admin",
    "password": "admin",
    "port": 5000
}
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| session_timeout_minutes | 会话超时时间（分钟） | 5 |
| username | 登录用户名 | admin |
| password | 登录密码 | admin |
| port | Web 服务端口 | 5000 |

### 项目配置 (config/projects/{project}.json)

```json
{
    "branches": [
        {
            "name": "refs/heads/main",
            "locked": true,
            "auto_lock_time": 30,
            "auto_lock_unit": "minutes"
        }
    ]
}
```

| 参数 | 说明 |
|------|------|
| name | 分支名称（完整引用格式） |
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
| /check_session | GET | 检查会话状态 |
| /add_project | POST | 添加项目 |
| /del_project | GET | 删除项目 |
| /scan_repos | POST | 扫描仓库 |
| /get_project_branches | GET | 获取项目分支 |
| /add_branch | POST | 添加分支 |
| /del_branch | GET | 删除分支 |
| /toggle_branch | GET | 切换分支锁定状态 |
| /sync_branch_to_all | GET | 同步分支到所有项目 |
| /stats | GET | 获取统计信息 |
| /update_settings | POST | 更新系统设置 |

## 使用说明

### 添加项目

1. 在"项目管理"选项卡中输入项目名称
2. 或点击"扫描仓库"按钮批量发现 Git 仓库

### 管理分支

1. 选择项目后，点击"添加分支"按钮
2. 输入分支名称（如 `refs/heads/main`）
3. 使用锁定/放开按钮控制分支保护状态

### 自动锁定

1. 在分支编辑界面设置"自动锁定时间"
2. 放开分支后，系统会在指定时间后自动锁定

### 全局配置

1. 选择"全局配置"项目
2. 配置默认分支保护策略
3. 使用"应用到所有项目"按钮同步配置

## 安全特性

- 会话超时自动退出
- 所有操作记录日志
- 分支保护钩子验证

## 许可证

MIT License