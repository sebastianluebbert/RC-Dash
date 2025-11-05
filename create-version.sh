#!/bin/bash

# RexCloud Auto-Versioning Script
# Automatically creates version tags based on conventional commits
# 
# Commit types:
# - feat: = minor version bump (0.x.0)
# - fix: = patch version bump (0.0.x)
# - BREAKING CHANGE: = major version bump (x.0.0)
# - docs:, style:, refactor:, etc. = no version bump

set -e

echo "🏷️  RexCloud Auto-Versioning"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current version tag
CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT_VERSION=${CURRENT_TAG#v}

echo -e "${BLUE}📌 Current version: ${CURRENT_TAG}${NC}"
echo ""

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Get commits since last tag
if [ "$CURRENT_TAG" != "v0.0.0" ]; then
  COMMITS=$(git log ${CURRENT_TAG}..HEAD --oneline)
else
  COMMITS=$(git log --oneline)
fi

if [ -z "$COMMITS" ]; then
  echo -e "${YELLOW}⚠️  No new commits since ${CURRENT_TAG}${NC}"
  exit 0
fi

echo "📋 Analyzing commits since ${CURRENT_TAG}:"
echo "$COMMITS"
echo ""

# Determine version bump
BUMP_TYPE="none"
HAS_BREAKING=false
HAS_FEATURE=false
HAS_FIX=false

while IFS= read -r commit; do
  commit_msg=$(echo "$commit" | cut -d' ' -f2-)
  
  # Check for breaking changes
  if echo "$commit_msg" | grep -qiE "^(feat|fix|chore|refactor)(\(.+\))?!:" || \
     git log --format=%B -n 1 $(echo "$commit" | cut -d' ' -f1) | grep -q "BREAKING CHANGE:"; then
    HAS_BREAKING=true
    echo "  🔴 BREAKING: $commit_msg"
  # Check for features
  elif echo "$commit_msg" | grep -qE "^feat(\(.+\))?:"; then
    HAS_FEATURE=true
    echo "  🟢 FEATURE: $commit_msg"
  # Check for fixes
  elif echo "$commit_msg" | grep -qE "^fix(\(.+\))?:"; then
    HAS_FIX=true
    echo "  🟡 FIX: $commit_msg"
  else
    echo "  ⚪ OTHER: $commit_msg"
  fi
done <<< "$COMMITS"

echo ""

# Calculate new version
NEW_MAJOR=$MAJOR
NEW_MINOR=$MINOR
NEW_PATCH=$PATCH

if [ "$HAS_BREAKING" = true ]; then
  BUMP_TYPE="major"
  NEW_MAJOR=$((MAJOR + 1))
  NEW_MINOR=0
  NEW_PATCH=0
elif [ "$HAS_FEATURE" = true ]; then
  BUMP_TYPE="minor"
  NEW_MINOR=$((MINOR + 1))
  NEW_PATCH=0
elif [ "$HAS_FIX" = true ]; then
  BUMP_TYPE="patch"
  NEW_PATCH=$((PATCH + 1))
fi

if [ "$BUMP_TYPE" = "none" ]; then
  echo -e "${YELLOW}⚠️  No version-relevant commits found (only docs, style, refactor, etc.)${NC}"
  echo "   No version tag will be created."
  exit 0
fi

NEW_VERSION="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"
NEW_TAG="v${NEW_VERSION}"

echo -e "${GREEN}🎯 Version bump: ${BUMP_TYPE}${NC}"
echo -e "${GREEN}📦 New version: ${NEW_TAG}${NC}"
echo ""

# Generate release notes
RELEASE_NOTES_FILE="/tmp/rexcloud-release-notes-${NEW_VERSION}.txt"
cat > "$RELEASE_NOTES_FILE" << EOF
Release ${NEW_TAG}

EOF

# Categorize commits for release notes
if [ "$HAS_BREAKING" = true ]; then
  echo "### ⚠️ BREAKING CHANGES" >> "$RELEASE_NOTES_FILE"
  echo "" >> "$RELEASE_NOTES_FILE"
  while IFS= read -r commit; do
    commit_msg=$(echo "$commit" | cut -d' ' -f2-)
    if echo "$commit_msg" | grep -qiE "^(feat|fix|chore|refactor)(\(.+\))?!:" || \
       git log --format=%B -n 1 $(echo "$commit" | cut -d' ' -f1) | grep -q "BREAKING CHANGE:"; then
      echo "- $commit_msg" >> "$RELEASE_NOTES_FILE"
    fi
  done <<< "$COMMITS"
  echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ "$HAS_FEATURE" = true ]; then
  echo "### ✨ New Features" >> "$RELEASE_NOTES_FILE"
  echo "" >> "$RELEASE_NOTES_FILE"
  while IFS= read -r commit; do
    commit_msg=$(echo "$commit" | cut -d' ' -f2-)
    if echo "$commit_msg" | grep -qE "^feat(\(.+\))?:"; then
      echo "- $commit_msg" >> "$RELEASE_NOTES_FILE"
    fi
  done <<< "$COMMITS"
  echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ "$HAS_FIX" = true ]; then
  echo "### 🐛 Bug Fixes" >> "$RELEASE_NOTES_FILE"
  echo "" >> "$RELEASE_NOTES_FILE"
  while IFS= read -r commit; do
    commit_msg=$(echo "$commit" | cut -d' ' -f2-)
    if echo "$commit_msg" | grep -qE "^fix(\(.+\))?:"; then
      echo "- $commit_msg" >> "$RELEASE_NOTES_FILE"
    fi
  done <<< "$COMMITS"
  echo "" >> "$RELEASE_NOTES_FILE"
fi

# Show release notes
echo "📝 Release Notes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$RELEASE_NOTES_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask for confirmation
read -p "Create tag ${NEW_TAG} and push to remote? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️  Tag creation cancelled${NC}"
  rm -f "$RELEASE_NOTES_FILE"
  exit 0
fi

# Create annotated tag with release notes
git tag -a "$NEW_TAG" -F "$RELEASE_NOTES_FILE"

echo -e "${GREEN}✅ Tag ${NEW_TAG} created${NC}"
echo ""

# Push tag to remote
read -p "Push tag to remote? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin "$NEW_TAG"
  echo -e "${GREEN}✅ Tag pushed to remote${NC}"
else
  echo -e "${YELLOW}⚠️  Tag created locally but not pushed${NC}"
  echo "   Push manually with: git push origin ${NEW_TAG}"
fi

# Cleanup
rm -f "$RELEASE_NOTES_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Version ${NEW_TAG} created successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate GitHub-formatted release notes
read -p "Generate GitHub release notes? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ -f "generate-release-notes.sh" ]; then
    chmod +x generate-release-notes.sh
    ./generate-release-notes.sh "$NEW_TAG"
  else
    echo -e "${YELLOW}⚠️  generate-release-notes.sh not found${NC}"
    echo "   Create it from the repository or download it manually"
  fi
fi

echo ""

# Update CHANGELOG.md
read -p "Update CHANGELOG.md? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  if [ -f "update-changelog.sh" ]; then
    chmod +x update-changelog.sh
    ./update-changelog.sh
    
    # Stage CHANGELOG.md if updated
    if [ -f "CHANGELOG.md" ] && ! git diff --quiet CHANGELOG.md 2>/dev/null; then
      git add CHANGELOG.md
      git commit -m "docs: update CHANGELOG.md for ${NEW_TAG}"
      echo -e "${GREEN}✅ CHANGELOG.md committed${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  update-changelog.sh not found${NC}"
  fi
fi

echo ""
echo "Next steps:"
echo "  1. Review the version tag: git show ${NEW_TAG}"
echo "  2. Review CHANGELOG.md"
echo "  3. Create a GitHub release with: ./generate-release-notes.sh ${NEW_TAG}"
echo "  4. Deploy the new version"
echo ""
