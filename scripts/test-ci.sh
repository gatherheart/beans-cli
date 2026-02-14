#!/bin/bash
#
# Run tests in a CI-like Docker environment
#
# This uses the same base image as GitHub Actions (ubuntu + node 20)
# to catch CI-specific issues before pushing.
#
# Usage:
#   ./scripts/test-ci.sh           # Run all tests
#   ./scripts/test-ci.sh e2e       # Run only E2E tests
#   ./scripts/test-ci.sh unit      # Run only unit tests
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker image - use Ubuntu with Node 20 to match GitHub Actions
# catthehacker/ubuntu:act-latest is commonly used with 'act' tool
# but node:20-bookworm is close enough and simpler
DOCKER_IMAGE="ubuntu:22.04"

# Test type (default: all)
TEST_TYPE="${1:-all}"

echo -e "${YELLOW}Running tests in CI-like Docker environment...${NC}"
echo -e "Project root: $PROJECT_ROOT"
echo -e "Test type: $TEST_TYPE"
echo ""

# Build the test command based on type
case "$TEST_TYPE" in
  e2e)
    TEST_CMD="npm run test:e2e"
    ;;
  unit)
    TEST_CMD="npm test"
    ;;
  all)
    TEST_CMD="npm test && npm run test:e2e"
    ;;
  *)
    echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
    echo "Usage: $0 [e2e|unit|all]"
    exit 1
    ;;
esac

# Run Docker container with CI environment (mimics GitHub Actions ubuntu-latest)
docker run --rm \
  -v "$PROJECT_ROOT:/app" \
  -w /app \
  -e CI=true \
  -e FORCE_COLOR=0 \
  "$DOCKER_IMAGE" \
  bash -c "
    echo '=== Setting up Node.js 20 (like GitHub Actions) ==='
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates > /dev/null
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
    apt-get install -y -qq nodejs > /dev/null
    echo \"Node version: \$(node --version)\"
    echo \"npm version: \$(npm --version)\"

    echo ''
    echo '=== Installing dependencies ==='
    npm ci

    echo ''
    echo '=== Building project ==='
    npm run build

    echo ''
    echo '=== Running tests ==='
    $TEST_CMD
  "

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
else
  echo -e "${RED}Tests failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
