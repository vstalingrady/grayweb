#!/bin/bash
# Setup log monitoring service on production server

set -euo pipefail

echo "Setting up Gray log monitoring service..."

# Copy service file
sudo cp /home/ubuntu/gray/scripts/gray-log-monitor.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable gray-log-monitor.service

# Start service
sudo systemctl start gray-log-monitor.service

# Check status
sudo systemctl status gray-log-monitor.service --no-pager

echo ""
echo "✅ Log monitor service installed and started!"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status gray-log-monitor   # Check status"
echo "  sudo systemctl stop gray-log-monitor     # Stop service"
echo "  sudo systemctl start gray-log-monitor    # Start service"
echo "  sudo journalctl -u gray-log-monitor -f   # View logs"
