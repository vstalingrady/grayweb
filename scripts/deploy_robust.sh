#!/bin/bash
# =============================================================================
# Robust Deploy Script with Auto-Rollback and Health Checks
# =============================================================================
# Usage: ./scripts/deploy_robust.sh [branch]
#
# Features:
# - Pre-deploy health check backup
# - Health check after deployment
# - Automatic rollback if health check fails
# - Email notification on failure (if configured)
# - Deployment log with timestamps
#
# Environment Variables:
# - REPO_DIR: Repository directory (default: /home/ubuntu/gray)
# - ALERT_EMAIL: Email address for failure notifications (optional)
# - SMTP_SERVER: SMTP server for sending emails (optional, requires mailx)
# - MAX_HEALTH_RETRIES: Max retries for health check (default: 5)
# - HEALTH_CHECK_DELAY: Delay between health checks in seconds (default: 10)
# =============================================================================

set -euo pipefail

# Configuration
REPO_DIR="${REPO_DIR:-/home/ubuntu/gray}"
BRANCH="${1:-main}"
DEPLOY_LOG="${REPO_DIR}/logs/deploy_$(date +%Y%m%d_%H%M%S).log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
DISCORD_USER_ID="${DISCORD_USER_ID:-853296501882093598}"
DISCORD_NOTIFY_SUCCESS_PING="${DISCORD_NOTIFY_SUCCESS_PING:-false}"
MAX_HEALTH_RETRIES="${MAX_HEALTH_RETRIES:-5}"
HEALTH_CHECK_DELAY="${HEALTH_CHECK_DELAY:-10}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$(dirname "$DEPLOY_LOG")"

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message" | tee -a "$DEPLOY_LOG"
}

log_info() { log "INFO" "$*"; }
log_warn() { log "WARN" "${YELLOW}$*${NC}"; }
log_error() { log "ERROR" "${RED}$*${NC}"; }
log_success() { log "SUCCESS" "${GREEN}$*${NC}"; }

load_discord_env() {
    if [[ -z "${DISCORD_WEBHOOK_URL:-}" && -f "${REPO_DIR}/.env" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "${REPO_DIR}/.env"
        set +a
    fi
}

# Send notification on failure
send_failure_notification() {
    local subject="$1"
    local body="$2"
    
    local sent_notification=false
    
    # Try Discord webhook first (preferred)
    if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
        log_info "Sending Discord notification..."
        
        # Format message with user ping if configured
        local discord_message="🚨 **Deployment Failed**\n**$subject**"
        if [[ -n "${DISCORD_USER_ID:-}" ]]; then
            discord_message="<@${DISCORD_USER_ID}> $discord_message"
        fi
        discord_message="$discord_message\n\`\`\`$body\`\`\`"
        
        if curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"content\":$(echo "$discord_message" | jq -Rs .)}" 2>/dev/null; then
            log_success "Discord notification sent!"
            sent_notification=true
        else
            log_warn "Discord notification failed"
        fi
    fi
    
    # Try email if configured
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        log_info "Sending email notification to $ALERT_EMAIL"
        
        if command -v mail &>/dev/null; then
            if echo "$body" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null; then
                sent_notification=true
            fi
        elif command -v sendmail &>/dev/null; then
            if {
                echo "Subject: $subject"
                echo "To: $ALERT_EMAIL"
                echo ""
                echo "$body"
            } | sendmail "$ALERT_EMAIL" 2>/dev/null; then
                sent_notification=true
            fi
        fi
    fi
    
    if [[ "$sent_notification" == false ]]; then
        log_warn "No notification method available or all failed. Check logs at: $DEPLOY_LOG"
    fi
}

send_success_notification() {
    local body="$1"

    if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
        return 0
    fi

    log_info "Sending Discord success notification..."

    local mention_prefix=""
    if [[ "${DISCORD_NOTIFY_SUCCESS_PING}" == "true" && -n "${DISCORD_USER_ID:-}" ]]; then
        mention_prefix="<@${DISCORD_USER_ID}> "
    fi

    local discord_message="${mention_prefix}✅ **Deployment Successful**\n\`\`\`$body\`\`\`"

    if curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"content\":$(echo "$discord_message" | jq -Rs .)}" 2>/dev/null; then
        log_success "Discord success notification sent!"
    else
        log_warn "Discord success notification failed"
    fi
}

# Health check function
check_health() {
    local url="$1"
    local name="$2"
    local max_retries="${3:-$MAX_HEALTH_RETRIES}"
    local retry_delay="${4:-$HEALTH_CHECK_DELAY}"
    
    log_info "Checking health of $name at $url..."
    
    for ((i=1; i<=max_retries; i++)); do
        if curl -sf "$url" -o /dev/null --max-time 10 2>/dev/null; then
            log_success "$name is healthy!"
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log_warn "$name health check failed (attempt $i/$max_retries). Retrying in ${retry_delay}s..."
            sleep "$retry_delay"
        fi
    done
    
    log_error "$name health check failed after $max_retries attempts!"
    return 1
}

# Get current commit hash
get_current_commit() {
    git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "unknown"
}

# Store rollback point
store_rollback_point() {
    local commit_hash=$(get_current_commit)
    echo "$commit_hash" > "$REPO_DIR/.last_working_deploy"
    log_info "Stored rollback point: $commit_hash"
}

# Get rollback point
get_rollback_point() {
    if [[ -f "$REPO_DIR/.last_working_deploy" ]]; then
        cat "$REPO_DIR/.last_working_deploy"
    else
        echo ""
    fi
}

# Rollback to previous working deployment
rollback() {
    local rollback_commit=$(get_rollback_point)
    
    if [[ -z "$rollback_commit" ]]; then
        log_error "No rollback point found! Manual intervention required."
        return 1
    fi
    
    log_warn "🔄 Rolling back to commit: $rollback_commit"
    
    cd "$REPO_DIR"
    load_discord_env
    git checkout "$rollback_commit"
    
    # Rebuild and restart with previous version
    if $COMPOSE_CMD -f docker-compose.yml up -d --build --remove-orphans 2>&1 | tee -a "$DEPLOY_LOG"; then
        log_success "Rollback completed!"
        
        # Verify rollback worked
        sleep 15
        if check_health "$BACKEND_URL/health" "Backend (rollback)" 3 5; then
            log_success "✅ Rollback verified - system is healthy"
            return 0
        else
            log_error "Rollback verification failed! Manual intervention required."
            return 1
        fi
    else
        log_error "Rollback failed! Manual intervention required."
        return 1
    fi
}

# Main deployment function
main() {
    log_info "=========================================="
    log_info "Starting robust deployment"
    log_info "Branch: $BRANCH"
    log_info "Repo: $REPO_DIR"
    log_info "Timestamp: $(date)"
    log_info "=========================================="
    
    # Validate repository
    if [[ ! -d "$REPO_DIR/.git" ]]; then
        log_error "Repository not found at $REPO_DIR"
        exit 1
    fi
    
    cd "$REPO_DIR"
    
    # Check Docker availability
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Determine docker compose command
    if docker compose version &>/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        log_error "Neither 'docker compose' nor 'docker-compose' is available"
        exit 1
    fi
    
    export COMPOSE_CMD
    
    # Store current commit for potential rollback identification
    local previous_commit=$(get_current_commit)
    log_info "Previous commit: $previous_commit"
    
    # Pre-deploy health check (to establish baseline)
    log_info "Running pre-deploy health check..."
    local was_healthy=false
    if check_health "$BACKEND_URL/health" "Backend (pre-deploy)" 2 3; then
        was_healthy=true
        store_rollback_point
    else
        log_warn "System was not healthy before deploy. Proceeding anyway..."
    fi
    
    # Fetch and checkout
    log_info "Fetching latest code..."
    git fetch origin "$BRANCH" 2>&1 | tee -a "$DEPLOY_LOG"
    git checkout "$BRANCH" 2>&1 | tee -a "$DEPLOY_LOG"
    git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$DEPLOY_LOG"
    
    local new_commit=$(get_current_commit)
    log_info "New commit: $new_commit"
    
    if [[ "$previous_commit" == "$new_commit" ]]; then
        log_info "No changes detected. Skipping rebuild."
        exit 0
    fi
    
    # Build and deploy
    log_info "Building and restarting services..."
    if ! $COMPOSE_CMD -f docker-compose.yml up -d --build --remove-orphans 2>&1 | tee -a "$DEPLOY_LOG"; then
        log_error "Docker build failed!"
        
        if [[ "$was_healthy" == true ]]; then
            log_warn "Attempting rollback..."
            rollback
        fi
        
        local error_body="Docker build failed during deployment.
Branch: $BRANCH
Previous Commit: $previous_commit
Target Commit: $new_commit
Log: $DEPLOY_LOG

Last 50 lines of deploy log:
$(tail -50 "$DEPLOY_LOG")"
        
        send_failure_notification "🚨 Gray Deploy FAILED: Docker Build Error" "$error_body"
        exit 1
    fi
    
    # Wait for services to start
    log_info "Waiting ${HEALTH_CHECK_DELAY}s for services to initialize..."
    sleep "$HEALTH_CHECK_DELAY"
    
    # Post-deploy health check
    log_info "Running post-deploy health check..."
    local deploy_failed=false
    
    if ! check_health "$BACKEND_URL/health" "Backend" "$MAX_HEALTH_RETRIES" "$HEALTH_CHECK_DELAY"; then
        deploy_failed=true
        log_error "Backend health check failed!"
    fi
    
    # Optional frontend check
    if ! check_health "$FRONTEND_URL" "Frontend" 3 5 2>/dev/null; then
        log_warn "Frontend health check failed (non-critical)"
    fi
    
    # Handle deployment failure
    if [[ "$deploy_failed" == true ]]; then
        log_error "🚨 Deployment failed health checks!"
        
        # Collect diagnostic info
        local container_logs=""
        container_logs=$(docker logs gray-backend-1 --tail 100 2>/dev/null || docker logs gray_backend_1 --tail 100 2>/dev/null || echo "Could not retrieve backend logs")
        
        local error_body="Deployment completed but health checks failed.
Branch: $BRANCH
Previous Commit: $previous_commit  
Target Commit: $new_commit
Deploy Log: $DEPLOY_LOG

=== Container Status ===
$(docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'Could not get container status')

=== Backend Logs (last 100 lines) ===
$container_logs"
        
        send_failure_notification "🚨 Gray Deploy FAILED: Health Check Error" "$error_body"
        
        # Attempt rollback if we had a healthy state before
        if [[ "$was_healthy" == true ]]; then
            log_warn "System was healthy before. Attempting automatic rollback..."
            if rollback; then
                send_failure_notification "✅ Gray Deploy Rollback SUCCESS" "Rolled back to commit: $(get_rollback_point)"
            else
                send_failure_notification "🚨 Gray Rollback FAILED" "Manual intervention required! Check: $DEPLOY_LOG"
            fi
        else
            log_warn "No healthy baseline to rollback to. Manual intervention required."
        fi
        
        exit 1
    fi
    
    # Success!
    log_success "=========================================="
    log_success "✅ Deployment successful!"
    log_success "Commit: $new_commit"
    log_success "=========================================="
    
    # Update rollback point to new successful deployment
    store_rollback_point

    local success_body="Branch: $BRANCH
Commit: $new_commit
Previous: $previous_commit
Host: $(hostname)
Log: $DEPLOY_LOG"
    send_success_notification "$success_body"
    
    # Cleanup old images
    log_info "Cleaning up old images..."
    docker image prune -f 2>&1 | tee -a "$DEPLOY_LOG" || true
    
    # Show running containers
    log_info "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1 | tee -a "$DEPLOY_LOG"
    
    log_success "Deploy completed at $(date)"
}

# Run main function
main "$@"
