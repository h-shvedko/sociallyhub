#!/bin/bash

# PostgreSQL Backup Script for SociallyHub
# This script creates automated backups of the PostgreSQL database

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-sociallyhub}"
POSTGRES_DB="${POSTGRES_DB:-sociallyhub}"

# Timestamp for backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="sociallyhub_${TIMESTAMP}.sql.gz"
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
    
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump is not installed or not in PATH"
    fi
    
    if ! command -v gzip &> /dev/null; then
        error "gzip is not installed or not in PATH"
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

# Test database connection
test_connection() {
    log "Testing database connection..."
    
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" &> /dev/null; then
        error "Cannot connect to PostgreSQL server at $POSTGRES_HOST:$POSTGRES_PORT"
    fi
    
    log "Database connection successful"
}

# Create database backup
create_backup() {
    log "Creating database backup: $BACKUP_FILENAME"
    
    # Set password from environment if available
    export PGPASSWORD="${POSTGRES_PASSWORD:-}"
    
    # Create backup with compression
    if pg_dump -h "$POSTGRES_HOST" \
               -p "$POSTGRES_PORT" \
               -U "$POSTGRES_USER" \
               -d "$POSTGRES_DB" \
               --verbose \
               --no-owner \
               --no-privileges \
               --format=custom | gzip > "$BACKUP_PATH"; then
        
        log "Backup created successfully: $BACKUP_PATH"
        
        # Get backup file size
        BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        log "Backup size: $BACKUP_SIZE"
        
    else
        error "Failed to create database backup"
    fi
    
    unset PGPASSWORD
}

# Upload to S3 if configured
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3 bucket: $S3_BUCKET"
        
        if aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/postgres/$BACKUP_FILENAME"; then
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
    find "$BACKUP_DIR" -name "sociallyhub_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # Clean S3 backups if configured
    if [ -n "$S3_BUCKET" ]; then
        # List and delete old S3 objects
        aws s3 ls "s3://$S3_BUCKET/postgres/" --recursive | \
        while read -r line; do
            # Extract date and filename from S3 ls output
            DATE=$(echo "$line" | awk '{print $1}')
            FILE=$(echo "$line" | awk '{print $4}')
            
            if [ -n "$DATE" ] && [ -n "$FILE" ]; then
                # Calculate days difference
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
                 \"text\": \"PostgreSQL Backup $status\",
                 \"attachments\": [{
                     \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "danger")\",
                     \"fields\": [{
                         \"title\": \"Database\",
                         \"value\": \"$POSTGRES_DB@$POSTGRES_HOST\",
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
    log "Starting PostgreSQL backup for SociallyHub..."
    
    # Trap to handle cleanup on exit
    trap 'error "Backup script interrupted"' INT TERM
    
    check_requirements
    create_backup_dir
    test_connection
    create_backup
    upload_to_s3
    cleanup_old_backups
    
    log "PostgreSQL backup completed successfully!"
    send_notification "SUCCESS" "Database backup completed successfully. File: $BACKUP_FILENAME"
}

# Handle errors
set +e
main "$@"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    send_notification "FAILED" "Database backup failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi