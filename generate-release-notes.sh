#!/bin/bash

# RexCloud Release Notes Generator
# Generates formatted release notes for GitHub releases from git commits

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📝 RexCloud Release Notes Generator"
echo "===================================="
echo ""

# Get version range
if [ -n "$1" ] && [ -n "$2" ]; then
  FROM_TAG="$1"
  TO_TAG="$2"
  echo -e "${BLUE}Generating release notes from ${FROM_TAG} to ${TO_TAG}${NC}"
elif [ -n "$1" ]; then
  TO_TAG="$1"
  # Get previous tag
  FROM_TAG=$(git describe --tags --abbrev=0 ${TO_TAG}^ 2>/dev/null || echo "")
  if [ -z "$FROM_TAG" ]; then
    echo -e "${YELLOW}No previous tag found, using all commits up to ${TO_TAG}${NC}"
    FROM_TAG=$(git rev-list --max-parents=0 HEAD)
  fi
else
  # Use latest tag
  TO_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD")
  FROM_TAG=$(git describe --tags --abbrev=0 ${TO_TAG}^ 2>/dev/null || echo "")
  
  if [ "$TO_TAG" = "HEAD" ]; then
    echo -e "${YELLOW}No tags found. Please create a tag first.${NC}"
    exit 1
  fi
  
  if [ -z "$FROM_TAG" ]; then
    echo -e "${YELLOW}No previous tag found, using all commits up to ${TO_TAG}${NC}"
    FROM_TAG=$(git rev-list --max-parents=0 HEAD)
  fi
fi

echo -e "${BLUE}📌 From: ${FROM_TAG}${NC}"
echo -e "${BLUE}📌 To: ${TO_TAG}${NC}"
echo ""

# Get commits in range
if [ "$FROM_TAG" = "$TO_TAG" ]; then
  echo -e "${RED}Error: FROM_TAG and TO_TAG are the same${NC}"
  exit 1
fi

COMMITS=$(git log ${FROM_TAG}..${TO_TAG} --oneline --no-merges)

if [ -z "$COMMITS" ]; then
  echo -e "${YELLOW}No commits found in range${NC}"
  exit 0
fi

# Initialize arrays for categorized commits
declare -a breaking_changes=()
declare -a features=()
declare -a fixes=()
declare -a performance=()
declare -a documentation=()
declare -a styling=()
declare -a refactoring=()
declare -a tests=()
declare -a dependencies=()
declare -a other=()

# Parse commits and categorize
while IFS= read -r commit; do
  commit_hash=$(echo "$commit" | cut -d' ' -f1)
  commit_msg=$(echo "$commit" | cut -d' ' -f2-)
  commit_full=$(git log --format=%B -n 1 "$commit_hash")
  
  # Clean commit message (remove conventional commit prefix for display)
  clean_msg=$(echo "$commit_msg" | sed -E 's/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\(.+\))?!?:\s*//')
  
  # Extract scope if present
  scope=""
  if echo "$commit_msg" | grep -qE '^\w+\(.+\):'; then
    scope=$(echo "$commit_msg" | sed -E 's/^\w+\((.+)\):.*/\1/')
    scope="**${scope}**: "
  fi
  
  # Check for breaking changes
  if echo "$commit_msg" | grep -qiE "^(feat|fix|chore|refactor)(\(.+\))?!:" || \
     echo "$commit_full" | grep -q "BREAKING CHANGE:"; then
    breaking_changes+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Features
  elif echo "$commit_msg" | grep -qE "^feat(\(.+\))?:"; then
    features+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Bug fixes
  elif echo "$commit_msg" | grep -qE "^fix(\(.+\))?:"; then
    fixes+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Performance
  elif echo "$commit_msg" | grep -qE "^perf(\(.+\))?:"; then
    performance+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Documentation
  elif echo "$commit_msg" | grep -qE "^docs(\(.+\))?:"; then
    documentation+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Styling
  elif echo "$commit_msg" | grep -qE "^style(\(.+\))?:"; then
    styling+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Refactoring
  elif echo "$commit_msg" | grep -qE "^refactor(\(.+\))?:"; then
    refactoring+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Tests
  elif echo "$commit_msg" | grep -qE "^test(\(.+\))?:"; then
    tests+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Dependencies
  elif echo "$commit_msg" | grep -qE "^(build|deps|chore)\(.*(deps|dependencies|package)\)?:"; then
    dependencies+=("- ${scope}${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  # Other
  else
    other+=("- ${clean_msg} ([${commit_hash}](../../commit/${commit_hash}))")
  fi
done <<< "$COMMITS"

# Generate release notes
OUTPUT_FILE="RELEASE_NOTES_${TO_TAG}.md"

cat > "$OUTPUT_FILE" << EOF
# Release ${TO_TAG}

## What's Changed

EOF

# Add breaking changes (highest priority)
if [ ${#breaking_changes[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### ⚠️ BREAKING CHANGES

${breaking_changes[@]}

EOF
  printf '%s\n' "${breaking_changes[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add features
if [ ${#features[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### ✨ New Features

EOF
  printf '%s\n' "${features[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add bug fixes
if [ ${#fixes[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### 🐛 Bug Fixes

EOF
  printf '%s\n' "${fixes[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add performance improvements
if [ ${#performance[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### ⚡ Performance Improvements

EOF
  printf '%s\n' "${performance[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add refactoring
if [ ${#refactoring[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### ♻️ Code Refactoring

EOF
  printf '%s\n' "${refactoring[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add documentation
if [ ${#documentation[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### 📚 Documentation

EOF
  printf '%s\n' "${documentation[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add styling
if [ ${#styling[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### 💄 Styling

EOF
  printf '%s\n' "${styling[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add tests
if [ ${#tests[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### ✅ Tests

EOF
  printf '%s\n' "${tests[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add dependencies
if [ ${#dependencies[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### 📦 Dependencies

EOF
  printf '%s\n' "${dependencies[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add other changes
if [ ${#other[@]} -gt 0 ]; then
  cat >> "$OUTPUT_FILE" << EOF
### 🔧 Other Changes

EOF
  printf '%s\n' "${other[@]}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Add footer
cat >> "$OUTPUT_FILE" << EOF
---

**Full Changelog**: https://github.com/yourusername/rexcloud/compare/${FROM_TAG}...${TO_TAG}
EOF

# Display results
echo -e "${GREEN}✅ Release notes generated successfully!${NC}"
echo ""
echo "📄 File: ${OUTPUT_FILE}"
echo ""
echo "📊 Statistics:"
echo "  - Breaking Changes: ${#breaking_changes[@]}"
echo "  - Features: ${#features[@]}"
echo "  - Bug Fixes: ${#fixes[@]}"
echo "  - Performance: ${#performance[@]}"
echo "  - Refactoring: ${#refactoring[@]}"
echo "  - Documentation: ${#documentation[@]}"
echo "  - Styling: ${#styling[@]}"
echo "  - Tests: ${#tests[@]}"
echo "  - Dependencies: ${#dependencies[@]}"
echo "  - Other: ${#other[@]}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$OUTPUT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
  echo -e "${BLUE}GitHub CLI detected!${NC}"
  read -p "Create GitHub release? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if tag exists remotely
    if git ls-remote --tags origin | grep -q "refs/tags/${TO_TAG}"; then
      gh release create "$TO_TAG" --notes-file "$OUTPUT_FILE" --title "Release ${TO_TAG}"
      echo -e "${GREEN}✅ GitHub release created!${NC}"
    else
      echo -e "${YELLOW}⚠️  Tag ${TO_TAG} not found on remote. Push it first with: git push origin ${TO_TAG}${NC}"
    fi
  fi
else
  echo -e "${YELLOW}💡 Tip: Install GitHub CLI (gh) to create releases automatically${NC}"
  echo "   https://cli.github.com/"
fi

echo ""
echo "Next steps:"
echo "  1. Review the release notes in ${OUTPUT_FILE}"
echo "  2. Edit if needed"
echo "  3. Create GitHub release manually or with: gh release create ${TO_TAG} --notes-file ${OUTPUT_FILE}"
echo ""
