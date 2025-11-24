#!/bin/bash
# Daily User Backup to Supabase
# Runs at 3 AM daily to sync local users to remote Supabase

cd /home/ubuntu/gray
/home/ubuntu/gray/.venv/bin/python /home/ubuntu/gray/scripts/sync_users_daily.py >> /home/ubuntu/gray/logs/user_sync.log 2>&1
