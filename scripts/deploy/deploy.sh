#!/bin/bash

# SociallyHub Deployment Script
# This script automates the deployment process for SociallyHub

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-staging}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/your-org}"
IMAGE_NAME="${IMAGE_NAME:-sociallyhub}"
NAMESPACE="${NAMESPACE:-sociallyhub}"
KUBECONFIG="${KUBECONFIG:-}"

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

# Show usage information
usage() {
    echo "Usage: $0 [staging|production] [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-build     Skip Docker image build"
    echo "  --skip-push      Skip Docker image push"
    echo "  --skip-deploy    Skip Kubernetes deployment"
    echo "  --rollback       Rollback to previous version"
    echo "  --dry-run        Show what would be done without executing"
    echo "  --help           Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DOCKER_REGISTRY  Docker registry URL (default: ghcr.io/your-org)"
    echo "  IMAGE_NAME       Docker image name (default: sociallyhub)"
    echo "  NAMESPACE        Kubernetes namespace (default: sociallyhub)"
    echo "  KUBECONFIG       Path to kubeconfig file"
    exit 1
}

# Parse command line arguments
parse_args() {
    SKIP_BUILD=false
    SKIP_PUSH=false
    SKIP_DEPLOY=false
    ROLLBACK=false
    DRY_RUN=false
    
    while [[ $# -gt 1 ]]; do
        case $2 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-push)
                SKIP_PUSH=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    local tools=("docker" "kubectl" "helm")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed or not in PATH"
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    # Check Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    # Validate environment
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        error "Environment must be 'staging' or 'production'"
    fi
    
    log "Prerequisites check passed"
}

# Get Git information
get_git_info() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        GIT_COMMIT=$(git rev-parse --short HEAD)
        GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
        GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
        GIT_DIRTY=$(git diff --quiet || echo "-dirty")
        
        # Use tag if available, otherwise use commit
        if [ -n "$GIT_TAG" ]; then
            VERSION="$GIT_TAG"
        else
            VERSION="$GIT_COMMIT$GIT_DIRTY"
        fi
        
        info "Git Info - Branch: $GIT_BRANCH, Commit: $GIT_COMMIT, Version: $VERSION"
    else
        warn "Not a git repository, using timestamp as version"
        VERSION=$(date +"%Y%m%d-%H%M%S")
    fi
}

# Build Docker image
build_image() {
    if [ "$SKIP_BUILD" = true ]; then
        info "Skipping Docker image build"
        return
    fi
    
    log "Building Docker image..."
    
    local dockerfile="Dockerfile.prod"
    if [ "$ENVIRONMENT" = "staging" ]; then
        dockerfile="Dockerfile"
    fi
    
    local image_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
    local latest_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$ENVIRONMENT-latest"
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would build: docker build -f $dockerfile -t $image_tag -t $latest_tag ."
        return
    fi
    
    # Build with buildx for multi-platform support
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --file "$dockerfile" \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --build-arg NODE_ENV=production \
        --build-arg BUILD_VERSION="$VERSION" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        .
    
    log "Docker image built successfully: $image_tag"
}

# Push Docker image
push_image() {
    if [ "$SKIP_PUSH" = true ]; then
        info "Skipping Docker image push"
        return
    fi
    
    log "Pushing Docker image to registry..."
    
    local image_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
    local latest_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$ENVIRONMENT-latest"
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would push: $image_tag and $latest_tag"
        return
    fi
    
    docker push "$image_tag"
    docker push "$latest_tag"
    
    log "Docker image pushed successfully"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    if [ "$SKIP_DEPLOY" = true ]; then
        info "Skipping Kubernetes deployment"
        return
    fi
    
    log "Deploying to Kubernetes ($ENVIRONMENT)..."
    
    local image_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would deploy $image_tag to $NAMESPACE namespace"
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    local k8s_dir="k8s"
    if [ "$ENVIRONMENT" = "staging" ]; then
        k8s_dir="k8s/staging"
    fi
    
    # Update image in deployment
    kubectl set image deployment/sociallyhub-deployment \
        sociallyhub="$image_tag" \
        -n "$NAMESPACE"
    
    # Wait for rollout to complete
    kubectl rollout status deployment/sociallyhub-deployment -n "$NAMESPACE" --timeout=600s
    
    log "Kubernetes deployment completed successfully"
}

# Deploy with Helm (alternative)
deploy_with_helm() {
    log "Deploying with Helm..."
    
    local image_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
    local chart_dir="helm/sociallyhub"
    local values_file="helm/values-$ENVIRONMENT.yaml"
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would deploy with Helm: $image_tag"
        return
    fi
    
    # Check if chart exists
    if [ ! -d "$chart_dir" ]; then
        error "Helm chart directory not found: $chart_dir"
    fi
    
    # Deploy or upgrade
    helm upgrade --install sociallyhub "$chart_dir" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "$values_file" \
        --set image.repository="$DOCKER_REGISTRY/$IMAGE_NAME" \
        --set image.tag="$VERSION" \
        --set environment="$ENVIRONMENT" \
        --wait \
        --timeout=10m
    
    log "Helm deployment completed successfully"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would rollback deployment"
        return
    fi
    
    kubectl rollout undo deployment/sociallyhub-deployment -n "$NAMESPACE"
    kubectl rollout status deployment/sociallyhub-deployment -n "$NAMESPACE" --timeout=600s
    
    log "Rollback completed successfully"
}

# Run post-deployment tests
run_tests() {
    log "Running post-deployment tests..."
    
    if [ "$DRY_RUN" = true ]; then
        info "[DRY RUN] Would run post-deployment tests"
        return
    fi
    
    # Wait for deployment to be ready
    sleep 30
    
    # Get service URL
    local service_url
    if kubectl get service sociallyhub-service -n "$NAMESPACE" &> /dev/null; then
        service_url=$(kubectl get service sociallyhub-service -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
        if [ -z "$service_url" ]; then
            service_url="localhost"
            kubectl port-forward service/sociallyhub-service 8080:80 -n "$NAMESPACE" &
            PORT_FORWARD_PID=$!
            trap "kill $PORT_FORWARD_PID" EXIT
            service_url="localhost:8080"
        fi
    fi
    
    # Health check
    local health_url="http://$service_url/api/health"
    info "Testing health endpoint: $health_url"
    
    for i in {1..10}; do
        if curl -f -s "$health_url" > /dev/null; then
            log "Health check passed"
            break
        else
            warn "Health check failed, attempt $i/10"
            if [ $i -eq 10 ]; then
                error "Health check failed after 10 attempts"
            fi
            sleep 10
        fi
    done
    
    log "Post-deployment tests completed successfully"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${WEBHOOK_URL:-}" ]; then
        local color="good"
        if [ "$status" != "SUCCESS" ]; then
            color="danger"
        fi
        
        curl -X POST "$WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{
                 \"text\": \"SociallyHub Deployment $status\",
                 \"attachments\": [{
                     \"color\": \"$color\",
                     \"fields\": [{
                         \"title\": \"Environment\",
                         \"value\": \"$ENVIRONMENT\",
                         \"short\": true
                     }, {
                         \"title\": \"Version\",
                         \"value\": \"$VERSION\",
                         \"short\": true
                     }, {
                         \"title\": \"Git Branch\",
                         \"value\": \"${GIT_BRANCH:-unknown}\",
                         \"short\": true
                     }, {
                         \"title\": \"Git Commit\",
                         \"value\": \"${GIT_COMMIT:-unknown}\",
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
    log "Starting SociallyHub deployment to $ENVIRONMENT..."
    
    parse_args "$@"
    
    if [ "$ROLLBACK" = true ]; then
        rollback_deployment
        send_notification "ROLLBACK" "Deployment rolled back successfully"
        return
    fi
    
    check_prerequisites
    get_git_info
    build_image
    push_image
    deploy_to_kubernetes
    run_tests
    
    log "SociallyHub deployment to $ENVIRONMENT completed successfully!"
    send_notification "SUCCESS" "Deployment completed successfully. Version: $VERSION"
}

# Handle errors and cleanup
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code"
        send_notification "FAILED" "Deployment failed with exit code $exit_code"
    fi
    
    # Kill port-forward if running
    if [ -n "${PORT_FORWARD_PID:-}" ]; then
        kill "$PORT_FORWARD_PID" 2>/dev/null || true
    fi
    
    exit $exit_code
}

trap cleanup EXIT

# Show help if no arguments
if [ $# -eq 0 ]; then
    usage
fi

main "$@"