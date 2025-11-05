# Conventional Commits Guide for RexCloud

This guide explains how to write commit messages that work with our automatic versioning system.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

### Version Bumps

- **feat:** A new feature (triggers **MINOR** version bump: 0.x.0)
- **fix:** A bug fix (triggers **PATCH** version bump: 0.0.x)
- **BREAKING CHANGE:** or `!` after type (triggers **MAJOR** version bump: x.0.0)

### No Version Bump

- **docs:** Documentation only changes
- **style:** Code style changes (formatting, missing semi-colons, etc)
- **refactor:** Code refactoring without adding features or fixing bugs
- **perf:** Performance improvements
- **test:** Adding or updating tests
- **chore:** Changes to build process or auxiliary tools

## Examples

### Feature (Minor Version Bump)

```bash
git commit -m "feat: add automatic backup system"
git commit -m "feat(dns): add AutoDNS support"
```

Result: `v1.2.0` → `v1.3.0`

### Bug Fix (Patch Version Bump)

```bash
git commit -m "fix: resolve database connection timeout"
git commit -m "fix(auth): correct JWT token expiration"
```

Result: `v1.2.0` → `v1.2.1`

### Breaking Change (Major Version Bump)

Option 1: Using `!` after type
```bash
git commit -m "feat!: change API authentication method"
```

Option 2: Using footer
```bash
git commit -m "feat: change API authentication method

BREAKING CHANGE: API now requires OAuth2 instead of API keys"
```

Result: `v1.2.0` → `v2.0.0`

### No Version Bump

```bash
git commit -m "docs: update installation guide"
git commit -m "style: format code with prettier"
git commit -m "refactor: simplify database queries"
git commit -m "chore: update dependencies"
```

Result: No new version tag created

## Using the Auto-Versioning Script

After making commits, create a new version:

```bash
chmod +x create-version.sh
./create-version.sh
```

The script will:
1. Analyze all commits since the last version tag
2. Determine the version bump type
3. Generate release notes automatically
4. Create an annotated Git tag
5. Optionally push the tag to remote

## Manual Versioning

You can also create version tags manually:

```bash
# Create annotated tag with message
git tag -a v1.2.3 -m "Release v1.2.3

### New Features
- Added backup system
- Improved DNS management

### Bug Fixes
- Fixed connection timeout
- Resolved authentication issue"

# Push tag to remote
git push origin v1.2.3
```

## Best Practices

1. **Be descriptive**: Write clear commit messages
   ```bash
   # Good
   git commit -m "feat(mail): add mailbox quota management"
   
   # Bad
   git commit -m "feat: add stuff"
   ```

2. **Use scopes**: Add context to your commits
   ```bash
   feat(proxmox): add VM snapshot support
   fix(dns): resolve zone update timing issue
   docs(api): add authentication examples
   ```

3. **Breaking changes**: Always document what breaks
   ```bash
   git commit -m "feat!: upgrade to Node.js 20
   
   BREAKING CHANGE: Node.js 18 is no longer supported.
   Please upgrade to Node.js 20 before updating."
   ```

4. **Keep it atomic**: One logical change per commit
   - Good: Separate commits for feature + tests
   - Bad: One commit mixing features, fixes, and refactoring

## Versioning Strategy

RexCloud follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes (backward compatible)

### Pre-releases

For beta or release candidate versions:

```bash
git tag -a v2.0.0-beta.1 -m "Beta release"
git tag -a v2.0.0-rc.1 -m "Release candidate"
```

## Changelog Generation

### Automatic Release Notes

RexCloud includes a release notes generator that creates formatted GitHub release notes:

```bash
# Generate release notes for latest tag
./generate-release-notes.sh

# Generate release notes for specific tag
./generate-release-notes.sh v1.2.3

# Generate release notes between two tags
./generate-release-notes.sh v1.2.0 v1.2.3
```

The generator automatically categorizes commits:
- ⚠️ **Breaking Changes**: `feat!:`, `fix!:`, or commits with `BREAKING CHANGE:`
- ✨ **New Features**: `feat:` commits
- 🐛 **Bug Fixes**: `fix:` commits
- ⚡ **Performance**: `perf:` commits
- ♻️ **Refactoring**: `refactor:` commits
- 📚 **Documentation**: `docs:` commits
- 💄 **Styling**: `style:` commits
- ✅ **Tests**: `test:` commits
- 📦 **Dependencies**: `build:`, `deps:`, `chore(deps):` commits

### Publishing to GitHub

If you have the [GitHub CLI](https://cli.github.com/) installed:

```bash
# Publish release to GitHub
chmod +x publish-release.sh
./publish-release.sh v1.2.3
```

This will:
1. Generate release notes automatically
2. Create a GitHub release
3. Upload release notes
4. Provide a link to the release

### Manual Changelog

You should also maintain a `CHANGELOG.md`:

```markdown
# Changelog

## [1.3.0] - 2024-01-15

### Added
- Automatic backup system with configurable schedule
- Mailbox quota management
- VM snapshot support

### Fixed
- Database connection timeout issue
- JWT token expiration bug

### Changed
- Improved DNS zone update performance

## [1.2.1] - 2024-01-10

### Fixed
- Authentication flow for OAuth2
```

## CI/CD Integration

You can automate version creation in your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Create Release
on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump type'
        required: true
        default: 'patch'
        type: choice
        options:
        - major
        - minor
        - patch

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Create version tag
        run: |
          chmod +x create-version.sh
          ./create-version.sh
```

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
