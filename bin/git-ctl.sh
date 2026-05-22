#!/bin/bash

# Git 分支管理系统服务管理脚本
# 支持命令: start, stop, restart, status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

APP_NAME="git-ctl-webui"
PID_FILE="/var/run/${APP_NAME}.pid"
LOG_FILE="$PROJECT_DIR/log/app.log"
APP_FILE="$PROJECT_DIR/app.py"

# 检查 Python3 是否安装
check_python() {
    if ! command -v python3 &> /dev/null; then
        echo "错误: 未找到 python3，请先安装 Python3"
        exit 1
    fi
}

# 检查 Flask 是否安装
check_flask() {
    if ! python3 -c "import flask" 2>/dev/null; then
        echo "错误: 未安装 Flask，请运行: pip3 install flask"
        exit 1
    fi
}

# 检查配置文件
check_config() {
    if [ ! -f "$PROJECT_DIR/config/config.json" ]; then
        echo "警告: 未找到配置文件 config/config.json，将使用默认配置"
    fi
}

# 创建日志目录
create_log_dir() {
    mkdir -p "$PROJECT_DIR/log"
}

# 获取端口
get_port() {
    if [ -f "$PROJECT_DIR/config/config.json" ]; then
        PORT=$(python3 -c "import json; print(json.load(open('config/config.json')).get('port', 5000))" 2>/dev/null || echo "5000")
    else
        PORT=5000
    fi
    echo "$PORT"
}

# 检查进程是否运行
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# 启动服务
do_start() {
    check_python
    check_flask
    check_config
    create_log_dir

    if is_running; then
        PID=$(cat "$PID_FILE")
        echo "服务已经运行中 (PID: $PID)"
        return 0
    fi

    echo "正在启动 $APP_NAME..."
    
    # 后台启动应用
    nohup python3 "$APP_FILE" > "$LOG_FILE" 2>&1 &
    PID=$!
    
    # 保存 PID
    echo "$PID" > "$PID_FILE"
    
    # 等待启动
    sleep 2
    
    if is_running; then
        PORT=$(get_port)
        echo "服务启动成功 (PID: $PID, 端口: $PORT)"
        echo "日志文件: $LOG_FILE"
    else
        echo "服务启动失败，请查看日志: $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# 停止服务
do_stop() {
    if ! is_running; then
        echo "服务未运行"
        return 0
    fi

    PID=$(cat "$PID_FILE")
    echo "正在停止 $APP_NAME (PID: $PID)..."
    
    kill "$PID"
    
    # 等待进程结束
    for i in {1..10}; do
        if ! kill -0 "$PID" 2>/dev/null; then
            break
        fi
        sleep 1
    done
    
    if ! kill -0 "$PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "服务停止成功"
    else
        echo "警告: 强制终止进程"
        kill -9 "$PID"
        rm -f "$PID_FILE"
    fi
}

# 重启服务
do_restart() {
    do_stop
    do_start
}

# 查看状态
do_status() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        PORT=$(get_port)
        echo "$APP_NAME 运行中"
        echo "  PID: $PID"
        echo "  端口: $PORT"
        echo "  日志: $LOG_FILE"
    else
        echo "$APP_NAME 未运行"
    fi
}

# 显示帮助
do_help() {
    echo "使用方法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start    - 启动服务（后台运行）"
    echo "  stop     - 停止服务"
    echo "  restart  - 重启服务"
    echo "  status   - 查看服务状态"
    echo "  help     - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start"
    echo "  $0 stop"
    echo "  $0 restart"
    echo "  $0 status"
}

# 主函数
case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_restart
        ;;
    status)
        do_status
        ;;
    help|*)
        do_help
        ;;
esac