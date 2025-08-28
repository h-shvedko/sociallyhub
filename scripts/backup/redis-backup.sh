#!/bin/bash

# Redis Backup Script for SociallyHub
# This script creates automated backups of the Redis database

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/redis}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Timestamp for backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="redis_${TIMESTAMP}.rdb"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
    exit 1
}

# Check if required tools are available
check_requirements() {
    log "Checking requirements..."
    
    if ! command -v redis-cli &> /dev/null; then
        error "redis-cli is not installed or not in PATH"
    fi
    
    if [ -n "$S3_BUCKET" ] && ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed but S3_BUCKET is specified"
    fi
    
    log "Requirements check passed"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Test Redis connection
test_connection() {
    log "Testing Redis connection..."
    
    local auth_arg=""
    if [ -n "$REDIS_PASSWORD" ]; then
        auth_arg="-a $REDIS_PASSWORD"
    fi
    
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg ping &> /dev/null; then
        error "Cannot connect to Redis server at $REDIS_HOST:$REDIS_PORT"
    fi
    
    log "Redis connection successful"
}

# Create Redis backup
create_backup() {
    log "Creating Redis backup: $BACKUP_FILENAME"
    
    local auth_arg=""
    if [ -n "$REDIS_PASSWORD" ]; then
        auth_arg="-a $REDIS_PASSWORD"
    fi
    
    # Trigger a BGSAVE to create a snapshot
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg BGSAVE | grep -q "Background saving started"; then
        log "Background save initiated"
        
        # Wait for BGSAVE to complete
        while redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg LASTSAVE | xargs -I {} test $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg LASTSAVE) -eq {}; do
            log "Waiting for background save to complete..."
            sleep 2
        done
        
        log "Background save completed"
        
        # Copy the RDB file
        # Note: This assumes Redis is running in a container and we can access the dump file
        # In production, you might need to adjust this based on your Redis configuration
        
        # Alternative approach: Use redis-dump or similar tools
        # For now, we'll use a simple approach with redis-cli
        
        # Get all keys and their values (this is a simple backup approach)
        log "Extracting Redis data..."
        
        # Create a simple backup format
        {
            echo "# Redis backup created on $(date)"
            echo "# Host: $REDIS_HOST:$REDIS_PORT"
            echo "# Database count: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg INFO keyspace | grep -c '^db')"
            echo ""
            
            # Iterate through all databases
            for db in $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg INFO keyspace | grep '^db' | cut -d: -f1 | sed 's/db//'); do
                echo "# Database $db"
                redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg -n $db --rdb - 2>/dev/null || echo "# Failed to backup database $db"
            done
        } > "$BACKUP_PATH"
        
        log "Backup created successfully: $BACKUP_PATH"
        
        # Get backup file size
        BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        log "Backup size: $BACKUP_SIZE"
        
    else
        error "Failed to initiate Redis backup"
    fi
}

# Alternative method using redis-dump if available
create_backup_with_redis_dump() {
    if command -v redis-dump &> /dev/null; then
        log "Creating Redis backup using redis-dump..."
        
        local auth_arg=""
        if [ -n "$REDIS_PASSWORD" ]; then
            auth_arg="-a $REDIS_PASSWORD"
        fi
        
        if redis-dump -h "$REDIS_HOST" -p "$REDIS_PORT" $auth_arg > "$BACKUP_PATH"; then
            log "Backup created successfully using redis-dump: $BACKUP_PATH"
        else
            error "Failed to create Redis backup using redis-dump"
        fi
    else
        warn "redis-dump not available, using alternative method"
        create_backup
    fi
}

# Upload to S3 if configured
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3 bucket: $S3_BUCKET"
        
        if aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/redis/$BACKUP_FILENAME"; then
            log "Backup uploaded to S3 successfully"
        else
            warn "Failed to upload backup to S3"
        fi
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Clean local backups
    find "$BACKUP_DIR" -name "redis_*.rdb" -mtime +$RETENTION_DAYS -delete
    
    # Clean S3 backups if configured
    if [ -n "$S3_BUCKET" ]; then
        aws s3 ls "s3://$S3_BUCKET/redis/" --recursive | \
        while read -r line; do
            DATE=$(echo "$line" | awk '{print $1}')
            FILE=$(echo "$line" | awk '{print $4}')
            
            if [ -n "$DATE" ] && [ -n "$FILE" ]; then
                DATE_EPOCH=$(date -d "$DATE" +%s 2>/dev/null || echo "0")
                NOW_EPOCH=$(date +%s)
                DAYS_OLD=$(( (NOW_EPOCH - DATE_EPOCH) / 86400 ))
                
                if [ $DAYS_OLD -gt $RETENTION_DAYS ]; then
                    log "Deleting old S3 backup: $FILE (${DAYS_OLD} days old)"
                    aws s3 rm "s3://$S3_BUCKET/$FILE"
                fi
            fi
        done
    fi
    
    log "Cleanup completed"
}

# Send notification (if configured)
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${WEBHOOK_URL:-}" ]; then
        curl -X POST "$WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{
                 \"text\": \"Redis Backup $status\",
                 \"attachments\": [{
                     \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "danger")\",
                     \"fields\": [{
                         \"title\": \"Redis Instance\",
                         \"value\": \"$REDIS_HOST:$REDIS_PORT\",
                         \"short\": true
                     }, {
                         \"title\": \"Backup File\",
                         \"value\": \"$BACKUP_FILENAME\",
                         \"short\": true
                     }, {
                         \"title\": \"Message\",
                         \"value\": \"$message\",
                         \"short\": false
                     }]
                 }]
             }" 2>/dev/null || warn "Failed to send notification"
    fi
}

# Main execution
main() {
    log "Starting Redis backup for SociallyHub..."
    
    # Trap to handle cleanup on exit
    trap 'error "Backup script interrupted"' INT TERM
    
    check_requirements
    create_backup_dir
    test_connection
    create_backup_with_redis_dump
    upload_to_s3
    cleanup_old_backups
    
    log "Redis backup completed successfully!"
    send_notification "SUCCESS" "Redis backup completed successfully. File: $BACKUP_FILENAME"
}

# Handle errors
set +e
main "$@"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    send_notification "FAILED" "Redis backup failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi