#!/bin/bash
# Production Deployment Script for Gray
# This script rebuilds and restarts the Next.js frontend

set -e  # Exit on error

echo "🚀 Deploying Gray Frontend to Production"
echo "========================================"
echo ""

# Change to project directory
cd /home/ubuntu/gray

echo "📦 Installing/updating dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

echo "🔨 Building Next.js for production..."
echo "   Using .env.production for environment variables"
NODE_ENV=production npm run build
echo "✅ Build complete"
echo ""

echo "🔄 Restarting Next.js server..."
# Try PM2 first
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "gray-frontend"; then
        pm2 restart gray-frontend
        echo "✅ Restarted via PM2"
    else
        echo "⚠️  PM2 process 'gray-frontend' not found"
        echo "   Start it with: pm2 start npm --name 'gray-frontend' -- start"
    fi
# Try systemd
elif systemctl list-units --type=service | grep -q "gray-frontend"; then
    sudo systemctl restart gray-frontend
    echo "✅ Restarted via systemd"
else
    echo "⚠️  Could not find running service"
    echo "   Please restart manually with: NODE_ENV=production npm start"
fi
echo ""

echo "✅ Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Test login at: https://gray.alignment.id/login"
echo "   2. Check logs: pm2 logs gray-frontend (or journalctl -u gray-frontend -f)"
echo "   3. Verify API URL in browser console"
echo ""
echo "🐛 Troubleshooting:"
echo "   - If CORS errors persist, restart backend: pm2 restart gray-backend"
echo "   - Clear browser cache and hard reload (Ctrl+Shift+R)"
echo "   - Check .env.production has NEXT_PUBLIC_API_URL=https://api-gray.alignment.id"
