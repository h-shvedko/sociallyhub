#!/bin/bash

# SociallyHub Rollback Script
# This script handles rollback scenarios for failed deployments

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-sociallyhub}"
ENVIRONMENT="${1:-staging}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
    exit 1
}

# Show usage
usage() {
    echo "Usage: $0 [staging|production] [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --revision N     Rollback to specific revision"
    echo "  --list           List available revisions"
    echo "  --dry-run        Show what would be done"
    echo "  --help           Show this help message"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    # Check if deployment exists
    if ! kubectl get deployment sociallyhub-deployment -n "$NAMESPACE" &> /dev/null; then
        error "Deployment 'sociallyhub-deployment' not found in namespace '$NAMESPACE'"
    fi
    
    log "Prerequisites check passed"
}

# List available revisions
list_revisions() {
    log "Available revisions for sociallyhub-deployment:"
    
    kubectl rollout history deployment/sociallyhub-deployment -n "$NAMESPACE"
}

# Get current deployment status
get_deployment_status() {
    log "Current deployment status:"
    
    kubectl get deployment sociallyhub-deployment -n "$NAMESPACE" -o wide
    kubectl get pods -l app=sociallyhub -n "$NAMESPACE"
    
    # Check rollout status
    if kubectl rollout status deployment/sociallyhub-deployment -n "$NAMESPACE" --timeout=0s; then
        info "Deployment is currently stable"
    else
        warn "Deployment is not stable"
    fi
}

# Perform rollback
perform_rollback() {
    local revision=$1
    local dry_run=${2:-false}
    
    if [ "$dry_run" = true ]; then
        info "[DRY RUN] Would rollback deployment to revision: $revision"
        return
    fi
    
    log "Rolling back deployment to revision: $revision"
    
    # Perform rollback
    if [ -n "$revision" ]; then
        kubectl rollout undo deployment/sociallyhub-deployment --to-revision="$revision" -n "$NAMESPACE"
    else
        kubectl rollout undo deployment/sociallyhub-deployment -n "$NAMESPACE"
    fi
    
    # Wait for rollback to complete
    log "Waiting for rollback to complete..."
    kubectl rollout status deployment/sociallyhub-deployment -n "$NAMESPACE" --timeout=600s
    
    log "Rollback completed successfully"
}

# Verify rollback
verify_rollback() {
    log "Verifying rollback..."
    
    # Check pod status
    local ready_pods=$(kubectl get pods -l app=sociallyhub -n "$NAMESPACE" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o True | wc -l)
    local total_pods=$(kubectl get pods -l app=sociallyhub -n "$NAMESPACE" --no-headers | wc -l)
    
    info "Ready pods: $ready_pods/$total_pods"
    
    if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
        log "All pods are ready"
    else
        error "Not all pods are ready after rollback"
    fi
    
    # Health check
    log "Performing health check..."
    
    # Port forward to test locally
    kubectl port-forward service/sociallyhub-service 8080:80 -n "$NAMESPACE" &
    PORT_FORWARD_PID=$!
    sleep 5
    
    for i in {1..10}; do
        if curl -f -s "http://localhost:8080/api/health" > /dev/null; then
            log "Health check passed"
            break
        else
            warn "Health check failed, attempt $i/10"
            if [ $i -eq 10 ]; then
                error "Health check failed after rollback"
            fi
            sleep 10
        fi
    done
    
    # Clean up port forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    log "Rollback verification completed successfully"
}

# Send rollback notification
send_notification() {
    local status=$1
    local revision=$2
    local message=$3
    
    if [ -n "${WEBHOOK_URL:-}" ]; then
        local color="warning"
        if [ "$status" = "SUCCESS" ]; then
            color="good"
        elif [ "$status" = "FAILED" ]; then
            color="danger"
        fi
        
        curl -X POST "$WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{
                 \"text\": \"SociallyHub Rollback $status\",
                 \"attachments\": [{
                     \"color\": \"$color\",
                     \"fields\": [{
                         \"title\": \"Environment\",
                         \"value\": \"$ENVIRONMENT\",
                         \"short\": true
                     }, {
                         \"title\": \"Namespace\",
                         \"value\": \"$NAMESPACE\",
                         \"short\": true
                     }, {
                         \"title\": \"Revision\",
                         \"value\": \"${revision:-previous}\",
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

# Emergency rollback (skip health checks)
emergency_rollback() {
    local revision=$1
    
    warn "Performing EMERGENCY rollback (skipping verification)"
    
    if [ -n "$revision" ]; then
        kubectl rollout undo deployment/sociallyhub-deployment --to-revision="$revision" -n "$NAMESPACE"
    else
        kubectl rollout undo deployment/sociallyhub-deployment -n "$NAMESPACE"
    fi
    
    log "Emergency rollback initiated"
    send_notification "EMERGENCY" "$revision" "Emergency rollback initiated due to critical failure"
}

# Main execution
main() {
    local revision=""
    local list_only=false
    local dry_run=false
    local emergency=false
    
    # Parse arguments
    while [[ $# -gt 1 ]]; do
        case $2 in
            --revision)
                revision="$3"
                shift 2
                ;;
            --list)
                list_only=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --emergency)
                emergency=true
                shift
                ;;
            --help)
                usage
                ;;
            *)
                error "Unknown option: $2"
                ;;
        esac
        shift
    done
    
    log "Starting SociallyHub rollback process for $ENVIRONMENT..."
    
    check_prerequisites
    
    if [ "$list_only" = true ]; then
        list_revisions
        return
    fi
    
    get_deployment_status
    
    if [ "$emergency" = true ]; then
        emergency_rollback "$revision"
        return
    fi
    
    perform_rollback "$revision" "$dry_run"
    
    if [ "$dry_run" = false ]; then
        verify_rollback
        send_notification "SUCCESS" "$revision" "Rollback completed successfully"
    fi
    
    log "Rollback process completed successfully"
}

# Handle cleanup
cleanup() {
    local exit_code=$?
    
    # Kill port forward if running
    if [ -n "${PORT_FORWARD_PID:-}" ]; then
        kill "$PORT_FORWARD_PID" 2>/dev/null || true
    fi
    
    if [ $exit_code -ne 0 ]; then
        send_notification "FAILED" "" "Rollback process failed with exit code $exit_code"
    fi
    
    exit $exit_code
}

trap cleanup EXIT

# Show help if no arguments
if [ $# -eq 0 ]; then
    usage
fi

main "$@"