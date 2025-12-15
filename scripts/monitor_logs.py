#!/usr/bin/env python3
"""
Backend Log Monitor - Watches logs and sends Discord notifications on errors.

Monitors:
- Docker container logs (gray-backend-1)
- Log files (logs/error.log, backend.log)
- Detects ERROR, CRITICAL, Exception, Traceback patterns

Notifications:
- Sends to Discord webhook when errors detected
- Includes error details, timestamp, and context
- De-duplicates to avoid spam (same error within 5 minutes)

Usage:
    python scripts/monitor_logs.py [--daemon]
"""
import os
import sys
import time
import json
import hashlib
import subprocess
import requests
from datetime import datetime, timedelta
from collections import deque
from pathlib import Path

# Configuration
DISCORD_WEBHOOK_URL = os.getenv(
    'DISCORD_WEBHOOK_URL',
    'https://discord.com/api/webhooks/1450059573409873950/RvYql3tRU5pkyJjsAsN2Vwe8oK9kHMtuhnflBaZReTsA_HMJgxNc1zrva5GnrulWqptR'
)
DISCORD_USER_ID = os.getenv('DISCORD_USER_ID', '853296501882093598')
CHECK_INTERVAL = 10  # seconds
DEDUP_WINDOW = 300  # 5 minutes
MAX_ERROR_LENGTH = 1500  # Discord message length limit

# Error detection patterns
ERROR_PATTERNS = [
    'ERROR',
    'CRITICAL',
    'Exception',
    'Traceback',
    'Failed to',
    'ModuleNotFoundError',
    'ImportError',
    'RuntimeError',
    'ValueError',
    'KeyError',
    'AttributeError',
]

# Recent errors cache (for deduplication)
recent_errors = deque(maxlen=100)


def get_error_hash(error_text: str) -> str:
    """Generate hash for error deduplication."""
    # Normalize error (remove timestamps, line numbers)
    normalized = error_text.lower()
    for pattern in [r'\d{4}-\d{2}-\d{2}', r'line \d+', r'at 0x[\da-f]+']:
        import re
        normalized = re.sub(pattern, '', normalized)
    return hashlib.md5(normalized.encode()).hexdigest()


def should_notify(error_hash: str) -> bool:
    """Check if we should notify about this error (deduplication)."""
    cutoff_time = datetime.now() - timedelta(seconds=DEDUP_WINDOW)
    
    # Clean old errors
    while recent_errors and recent_errors[0][0] < cutoff_time:
        recent_errors.popleft()
    
    # Check if this error was recently seen
    for timestamp, hash_val in recent_errors:
        if hash_val == error_hash:
            return False
    
    # Add to recent errors
    recent_errors.append((datetime.now(), error_hash))
    return True


def send_discord_notification(error_text: str, source: str):
    """Send error notification to Discord."""
    error_hash = get_error_hash(error_text)
    
    if not should_notify(error_hash):
        print(f"[DEDUP] Skipping duplicate error from {source}")
        return
    
    # Truncate if too long
    if len(error_text) > MAX_ERROR_LENGTH:
        error_text = error_text[:MAX_ERROR_LENGTH] + "\n... (truncated)"
    
    # Format message
    message = (
        f"<@{DISCORD_USER_ID}> 🔥 **Runtime Error Detected**\n"
        f"**Source**: {source}\n"
        f"**Time**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"```\n{error_text}\n```"
    )
    
    try:
        response = requests.post(
            DISCORD_WEBHOOK_URL,
            json={"content": message},
            timeout=10
        )
        if response.status_code in (200, 204):
            print(f"[NOTIFY] Sent notification for error from {source}")
        else:
            print(f"[ERROR] Discord notification failed: {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Failed to send Discord notification: {e}")


def extract_error_context(lines: list, error_line_idx: int) -> str:
    """Extract error with surrounding context."""
    start_idx = max(0, error_line_idx - 2)
    end_idx = min(len(lines), error_line_idx + 5)
    
    context = lines[start_idx:end_idx]
    return '\n'.join(context)


def check_docker_logs():
    """Check Docker container logs for errors."""
    try:
        # Get backend container logs (last 50 lines)
        result = subprocess.run(
            ['docker', 'logs', '--tail', '50', 'gray-backend-1'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            # Try alternative container name
            result = subprocess.run(
                ['docker', 'logs', '--tail', '50', 'gray_backend_1'],
                capture_output=True,
                text=True,
                timeout=10
            )
        
        logs = result.stdout + result.stderr
        lines = logs.split('\n')
        
        # Look for error patterns
        for i, line in enumerate(lines):
            if any(pattern in line for pattern in ERROR_PATTERNS):
                # Skip SQLite migration warnings (non-critical)
                if 'SQLite migration failed' in line and 'no such table' in line:
                    continue
                
                error_context = extract_error_context(lines, i)
                send_discord_notification(error_context, 'Docker Container (gray-backend-1)')
                break  # Only send one notification per check
                
    except subprocess.TimeoutExpired:
        print("[WARN] Docker logs command timed out")
    except FileNotFoundError:
        print("[WARN] Docker not available")
    except Exception as e:
        print(f"[ERROR] Failed to check Docker logs: {e}")


def check_log_file(filepath: Path, last_position: int) -> int:
    """Check log file for new errors, return new position."""
    if not filepath.exists():
        return 0
    
    try:
        with open(filepath, 'r') as f:
            # Seek to last position
            f.seek(last_position)
            new_lines = f.readlines()
            new_position = f.tell()
            
            # Look for errors in new lines
            for i, line in enumerate(new_lines):
                if any(pattern in line for pattern in ERROR_PATTERNS):
                    # Skip known non-critical errors
                    if 'SQLite migration failed' in line:
                        continue
                    
                    error_context = extract_error_context(new_lines, i)
                    send_discord_notification(
                        error_context,
                        f'Log File ({filepath.name})'
                    )
                    break
            
            return new_position
    except Exception as e:
        print(f"[ERROR] Failed to read {filepath}: {e}")
        return last_position


def monitor_logs(daemon_mode=False):
    """Main monitoring loop."""
    print(f"[INFO] Starting log monitor (daemon={daemon_mode})")
    print(f"[INFO] Discord webhook configured: {bool(DISCORD_WEBHOOK_URL)}")
    print(f"[INFO] Monitoring interval: {CHECK_INTERVAL}s")
    print(f"[INFO] Deduplication window: {DEDUP_WINDOW}s")
    
    # Track file positions
    file_positions = {}
    log_files = [
        Path('/home/ubuntu/gray/logs/error.log'),
        Path('/home/ubuntu/gray/backend.log'),
        Path('/home/ubuntu/gray/logs/app.log'),
    ]
    
    # Initialize positions
    for log_file in log_files:
        if log_file.exists():
            file_positions[log_file] = log_file.stat().st_size
        else:
            file_positions[log_file] = 0
    
    iteration = 0
    while True:
        iteration += 1
        print(f"\n[CHECK {iteration}] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Check Docker logs
        check_docker_logs()
        
        # Check log files
        for log_file in log_files:
            if log_file.exists():
                file_positions[log_file] = check_log_file(
                    log_file,
                    file_positions[log_file]
                )
        
        if not daemon_mode:
            print(f"[INFO] Check complete. Next check in {CHECK_INTERVAL}s")
        
        time.sleep(CHECK_INTERVAL)


if __name__ == '__main__':
    daemon_mode = '--daemon' in sys.argv or '-d' in sys.argv
    
    try:
        monitor_logs(daemon_mode=daemon_mode)
    except KeyboardInterrupt:
        print("\n[INFO] Log monitor stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n[FATAL] Log monitor crashed: {e}")
        sys.exit(1)
