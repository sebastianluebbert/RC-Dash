#!/bin/bash

# RexCloud CHANGELOG.md Generator
# Automatically generates and updates CHANGELOG.md from git tags

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📝 RexCloud CHANGELOG.md Generator"
echo "==================================="
echo ""

# Configuration
CHANGELOG_FILE="CHANGELOG.md"
REPO_URL="https://github.com/yourusername/RC-Dash"

# Get all tags sorted by version
TAGS=$(git tag -l --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+' || echo "")

if [ -z "$TAGS" ]; then
  echo -e "${YELLOW}⚠️  No version tags found${NC}"
  echo "Create a version tag first with: ./create-version.sh"
  exit 0
fi

# Create temporary file
TEMP_FILE=$(mktemp)

# Write header
cat > "$TEMP_FILE" << 'EOF'
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF

# Process each tag
PREVIOUS_TAG=""
TAG_COUNT=0

while IFS= read -r tag; do
  TAG_COUNT=$((TAG_COUNT + 1))
  VERSION=${tag#v}
  
  echo -e "${BLUE}Processing ${tag}...${NC}"
  
  # Get tag date
  TAG_DATE=$(git log -1 --format=%ai "$tag" | cut -d' ' -f1)
  
  # Get commit range
  if [ -z "$PREVIOUS_TAG" ]; then
    # First tag - get all commits up to this tag
    COMMIT_RANGE=$(git rev-list --max-parents=0 HEAD)..${tag}
  else
    COMMIT_RANGE=${PREVIOUS_TAG}..${tag}
  fi
  
  # Get commits in range
  COMMITS=$(git log "$COMMIT_RANGE" --oneline --no-merges 2>/dev/null || echo "")
  
  if [ -z "$COMMITS" ]; then
    PREVIOUS_TAG="$tag"
    continue
  fi
  
  # Initialize category arrays
  declare -a breaking_changes=()
  declare -a added=()
  declare -a changed=()
  declare -a deprecated=()
  declare -a removed=()
  declare -a fixed=()
  declare -a security=()
  
  # Categorize commits
  while IFS= read -r commit; do
    commit_hash=$(echo "$commit" | cut -d' ' -f1)
    commit_msg=$(echo "$commit" | cut -d' ' -f2-)
    commit_full=$(git log --format=%B -n 1 "$commit_hash")
    
    # Clean message for display
    clean_msg=$(echo "$commit_msg" | sed -E 's/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|security)(\(.+\))?!?:\s*//')
    
    # Extract scope
    scope=""
    if echo "$commit_msg" | grep -qE '^\w+\(.+\):'; then
      scope=$(echo "$commit_msg" | sed -E 's/^\w+\((.+)\):.*/\1/')
      clean_msg="**${scope}**: ${clean_msg}"
    fi
    
    # Categorize
    if echo "$commit_msg" | grep -qiE "^(feat|fix|chore|refactor)(\(.+\))?!:" || \
       echo "$commit_full" | grep -q "BREAKING CHANGE:"; then
      breaking_changes+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qE "^feat(\(.+\))?:"; then
      added+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qE "^fix(\(.+\))?:"; then
      fixed+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qiE "^security(\(.+\))?:"; then
      security+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qE "^(refactor|perf)(\(.+\))?:"; then
      changed+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qiE "deprecated"; then
      deprecated+=("- ${clean_msg}")
    elif echo "$commit_msg" | grep -qiE "^(remove|delete)"; then
      removed+=("- ${clean_msg}")
    else
      # Default to "Changed" for other commits
      changed+=("- ${clean_msg}")
    fi
  done <<< "$COMMITS"
  
  # Write version section
  echo "" >> "$TEMP_FILE"
  echo "## [${VERSION}] - ${TAG_DATE}" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  
  # Write categories (only if they have content)
  if [ ${#breaking_changes[@]} -gt 0 ]; then
    echo "### ⚠️ BREAKING CHANGES" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${breaking_changes[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#added[@]} -gt 0 ]; then
    echo "### Added" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${added[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#changed[@]} -gt 0 ]; then
    echo "### Changed" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${changed[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#deprecated[@]} -gt 0 ]; then
    echo "### Deprecated" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${deprecated[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#removed[@]} -gt 0 ]; then
    echo "### Removed" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${removed[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#fixed[@]} -gt 0 ]; then
    echo "### Fixed" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${fixed[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  if [ ${#security[@]} -gt 0 ]; then
    echo "### Security" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    printf '%s\n' "${security[@]}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
  fi
  
  PREVIOUS_TAG="$tag"
  
  # Limit to last 20 versions to keep file manageable
  if [ $TAG_COUNT -ge 20 ]; then
    echo -e "${YELLOW}⚠️  Limited to last 20 versions${NC}"
    break
  fi
done <<< "$TAGS"

# Add footer with version links
echo "" >> "$TEMP_FILE"
echo "---" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "## Version Links" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Generate version comparison links
FIRST_TAG=""
PREV_TAG=""
while IFS= read -r tag; do
  VERSION=${tag#v}
  if [ -z "$FIRST_TAG" ]; then
    FIRST_TAG="$tag"
    echo "[${VERSION}]: ${REPO_URL}/releases/tag/${tag}" >> "$TEMP_FILE"
  elif [ -n "$PREV_TAG" ]; then
    echo "[${VERSION}]: ${REPO_URL}/compare/${tag}...${PREV_TAG}" >> "$TEMP_FILE"
  fi
  PREV_TAG="$tag"
done <<< "$TAGS"

# Backup old changelog if exists
if [ -f "$CHANGELOG_FILE" ]; then
  BACKUP_FILE="${CHANGELOG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$CHANGELOG_FILE" "$BACKUP_FILE"
  echo -e "${BLUE}📦 Backed up old changelog to ${BACKUP_FILE}${NC}"
fi

# Move temp file to final location
mv "$TEMP_FILE" "$CHANGELOG_FILE"

echo ""
echo -e "${GREEN}✅ CHANGELOG.md generated successfully!${NC}"
echo ""
echo "📊 Statistics:"
echo "  - Total versions: $(echo "$TAGS" | wc -l)"
echo "  - Processed: $TAG_COUNT versions"
echo ""
echo "📄 File: $CHANGELOG_FILE"
echo ""

# Show preview
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
head -n 50 "$CHANGELOG_FILE"
echo ""
if [ $(wc -l < "$CHANGELOG_FILE") -gt 50 ]; then
  echo "... (file continues)"
  echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if there are uncommitted changes
if git diff --quiet "$CHANGELOG_FILE" 2>/dev/null; then
  echo -e "${GREEN}No changes to commit${NC}"
else
  echo -e "${YELLOW}💡 Don't forget to commit the updated CHANGELOG.md:${NC}"
  echo "   git add CHANGELOG.md"
  echo "   git commit -m \"docs: update CHANGELOG.md\""
fi

echo ""
