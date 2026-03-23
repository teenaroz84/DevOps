#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# deploy.sh — Build & deploy the DevOps dashboard to AWS
# ──────────────────────────────────────────────────────────
#
# Prerequisites:
#   1. AWS CLI configured:  aws configure
#   2. AWS SAM CLI installed:  brew install aws-sam-cli
#   3. An S3 bucket for SAM artifacts (created below if needed)
#
# Usage:
#   ./deploy.sh              # Deploy backend (SAM) + frontend (S3)
#   ./deploy.sh --backend    # Deploy only Lambda + API Gateway
#   ./deploy.sh --frontend   # Deploy only React app to S3
# ──────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ─────────────────────────────────────────
STACK_NAME="devops-dashboard"
REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-prod}"
S3_BUCKET_PREFIX="devops-dashboard"
FRONTEND_BUCKET="${S3_BUCKET_PREFIX}-frontend-${REGION}"
SAM_BUCKET="${S3_BUCKET_PREFIX}-sam-${REGION}"

# ── Colors ────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

# ── Parse args ────────────────────────────────────────────
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true

if [[ "${1:-}" == "--backend" ]]; then
  DEPLOY_FRONTEND=false
elif [[ "${1:-}" == "--frontend" ]]; then
  DEPLOY_BACKEND=false
fi

# ─────────────────────────────────────────────────────────
# STEP 1: Deploy Backend (SAM → Lambda + API Gateway)
# ─────────────────────────────────────────────────────────
deploy_backend() {
  info "Building SAM application..."
  sam build --template-file template.yaml

  info "Creating SAM deployment bucket if needed..."
  aws s3 mb "s3://${SAM_BUCKET}" --region "${REGION}" 2>/dev/null || true

  info "Deploying SAM stack '${STACK_NAME}' to ${REGION}..."
  sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name "${STACK_NAME}" \
    --s3-bucket "${SAM_BUCKET}" \
    --region "${REGION}" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides "StageName=${STAGE}" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

  # Grab the API URL from stack outputs
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text)

  log "Backend deployed! API URL: ${API_URL}"
  echo "${API_URL}" > .api-url
}

# ─────────────────────────────────────────────────────────
# STEP 2: Deploy Frontend (React → S3)
# ─────────────────────────────────────────────────────────
deploy_frontend() {
  # Read API URL from backend deploy or from saved file
  if [[ -z "${API_URL:-}" && -f .api-url ]]; then
    API_URL=$(cat .api-url)
  fi

  if [[ -z "${API_URL:-}" ]]; then
    warn "API_URL not set. Run with --backend first, or set API_URL env var."
    warn "Example: API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod ./deploy.sh --frontend"
    exit 1
  fi

  info "Building React app with API_URL=${API_URL}..."
  cd client
  VITE_API_BASE_URL="${API_URL}" npm run build
  cd ..

  info "Creating frontend S3 bucket if needed..."
  aws s3 mb "s3://${FRONTEND_BUCKET}" --region "${REGION}" 2>/dev/null || true

  info "Uploading build to s3://${FRONTEND_BUCKET}..."
  aws s3 sync client/dist/ "s3://${FRONTEND_BUCKET}" --delete

  info "Configuring static website hosting..."
  aws s3 website "s3://${FRONTEND_BUCKET}" \
    --index-document index.html \
    --error-document index.html

  # Set bucket policy for public read
  aws s3api put-bucket-policy --bucket "${FRONTEND_BUCKET}" --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"PublicReadGetObject\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${FRONTEND_BUCKET}/*\"
    }]
  }"

  FRONTEND_URL="http://${FRONTEND_BUCKET}.s3-website-${REGION}.amazonaws.com"
  log "Frontend deployed! URL: ${FRONTEND_URL}"
}

# ── Run ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  DevOps Dashboard — AWS Deployment"
echo "  Stack: ${STACK_NAME}  |  Region: ${REGION}  |  Stage: ${STAGE}"
echo "═══════════════════════════════════════════════"
echo ""

if [[ "${DEPLOY_BACKEND}" == true ]]; then
  deploy_backend
fi

if [[ "${DEPLOY_FRONTEND}" == true ]]; then
  deploy_frontend
fi

echo ""
log "Deployment complete!"
if [[ "${DEPLOY_BACKEND}" == true ]]; then
  echo "  API:      ${API_URL:-see .api-url}"
fi
if [[ "${DEPLOY_FRONTEND}" == true ]]; then
  echo "  Frontend: ${FRONTEND_URL:-check S3 console}"
fi
echo ""
