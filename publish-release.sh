#!/bin/bash

# RexCloud GitHub Release Publisher
# Creates or updates a GitHub release using the GitHub CLI

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 RexCloud GitHub Release Publisher"
echo "====================================="
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
  echo ""
  echo "Install it with:"
  echo "  macOS:   brew install gh"
  echo "  Linux:   See https://github.com/cli/cli#installation"
  echo "  Windows: See https://github.com/cli/cli#installation"
  echo ""
  exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
  echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
  echo ""
  read -p "Authenticate now? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh auth login
  else
    echo -e "${RED}Cannot continue without authentication${NC}"
    exit 1
  fi
fi

# Get tag
if [ -n "$1" ]; then
  TAG="$1"
else
  # Use latest tag
  TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
  if [ -z "$TAG" ]; then
    echo -e "${RED}❌ No tag specified and no tags found in repository${NC}"
    echo "Usage: $0 <tag>"
    exit 1
  fi
fi

echo -e "${BLUE}📌 Release tag: ${TAG}${NC}"

# Check if tag exists
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo -e "${RED}❌ Tag ${TAG} does not exist${NC}"
  exit 1
fi

# Check if tag is on remote
if ! git ls-remote --tags origin | grep -q "refs/tags/${TAG}"; then
  echo -e "${YELLOW}⚠️  Tag ${TAG} not found on remote${NC}"
  read -p "Push tag to remote now? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin "$TAG"
    echo -e "${GREEN}✅ Tag pushed to remote${NC}"
  else
    echo -e "${RED}Cannot create release without remote tag${NC}"
    exit 1
  fi
fi

# Generate release notes
NOTES_FILE="RELEASE_NOTES_${TAG}.md"

if [ ! -f "$NOTES_FILE" ]; then
  echo -e "${BLUE}📝 Generating release notes...${NC}"
  if [ -f "generate-release-notes.sh" ]; then
    chmod +x generate-release-notes.sh
    ./generate-release-notes.sh "$TAG"
  else
    echo -e "${RED}❌ generate-release-notes.sh not found${NC}"
    exit 1
  fi
fi

# Check if release already exists
EXISTING_RELEASE=$(gh release view "$TAG" 2>/dev/null || echo "")

if [ -n "$EXISTING_RELEASE" ]; then
  echo -e "${YELLOW}⚠️  Release ${TAG} already exists${NC}"
  read -p "Update existing release? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh release edit "$TAG" --notes-file "$NOTES_FILE"
    echo -e "${GREEN}✅ Release updated!${NC}"
  else
    echo -e "${YELLOW}Release not updated${NC}"
  fi
else
  # Ask for release type
  echo ""
  echo "Release options:"
  echo "  1) Regular release (default)"
  echo "  2) Pre-release"
  echo "  3) Draft"
  read -p "Select option (1-3): " -n 1 -r RELEASE_TYPE
  echo
  
  RELEASE_ARGS="--notes-file $NOTES_FILE --title \"Release ${TAG}\""
  
  case $RELEASE_TYPE in
    2)
      RELEASE_ARGS="$RELEASE_ARGS --prerelease"
      echo -e "${BLUE}Creating pre-release...${NC}"
      ;;
    3)
      RELEASE_ARGS="$RELEASE_ARGS --draft"
      echo -e "${BLUE}Creating draft release...${NC}"
      ;;
    *)
      echo -e "${BLUE}Creating regular release...${NC}"
      ;;
  esac
  
  # Create release
  eval gh release create "$TAG" $RELEASE_ARGS
  
  echo -e "${GREEN}✅ GitHub release created!${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Release ${TAG} published to GitHub!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get release URL
RELEASE_URL=$(gh release view "$TAG" --json url -q .url 2>/dev/null || echo "")
if [ -n "$RELEASE_URL" ]; then
  echo "🔗 View release: ${RELEASE_URL}"
  echo ""
fi

echo "Next steps:"
echo "  1. Verify release notes on GitHub"
echo "  2. Add release assets if needed: gh release upload ${TAG} <files>"
echo "  3. Announce the release"
echo ""
