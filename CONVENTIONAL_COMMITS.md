# Conventional Commits Guide

Dieses Projekt verwendet [Conventional Commits](https://www.conventionalcommits.org/) für **automatisches Semantic Versioning** via GitHub Actions.

## 🚀 Automatische Versionierung

Bei jedem Push auf `main` wird automatisch:
1. Die Commit-Messages analysiert
2. Die passende neue Version berechnet
3. Ein Git-Tag mit kategorisiertem Changelog erstellt
4. Ein GitHub Release erstellt

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Version Bumps

### 🚨 BREAKING CHANGE (Major: 1.0.0 → 2.0.0)


Breaking Changes führen zu einer **Major-Version-Erhöhung**:

```bash
# Option 1: Mit ! im Type
feat!: neue API mit breaking changes

# Option 2: Im Footer
feat: neue API

BREAKING CHANGE: Die alte API ist nicht mehr kompatibel

# Option 3: Im Body
feat: neue API

BREAKING: Die alte API wurde entfernt
```

**Ergebnis:** `v1.2.3` → `v2.0.0`

### ✨ feat: (Minor: 1.0.0 → 1.1.0)

Neue Features führen zu einer **Minor-Version-Erhöhung**:

```bash
feat: Benutzer können jetzt Tags hinzufügen
feat(api): neue Endpoint für Authentifizierung
feat(ui): Dark Mode hinzugefügt
```

**Ergebnis:** `v1.2.3` → `v1.3.0`

### 🐛 fix: (Patch: 1.0.0 → 1.0.1)

Bug Fixes führen zu einer **Patch-Version-Erhöhung**:

```bash
fix: Button-Klick funktioniert jetzt korrekt
fix(auth): Token-Validierung repariert
fix(ui): Layout-Problem im Header behoben
```

**Ergebnis:** `v1.2.3` → `v1.2.4`

### 📦 Andere Types (Patch: 1.0.0 → 1.0.1)

Andere Änderungen führen standardmäßig zu einer **Patch-Version-Erhöhung**:

```bash
docs: README aktualisiert
style: Code-Formatierung verbessert
refactor: Funktion umstrukturiert
perf: Performance-Optimierung
test: Tests hinzugefügt
chore: Dependencies aktualisiert
```

**Ergebnis:** `v1.2.3` → `v1.2.4`

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

RexCloud automatically generates and maintains `CHANGELOG.md` using git tags:

```bash
# Generate/update CHANGELOG.md from all version tags
chmod +x update-changelog.sh
./update-changelog.sh
```

This will:
1. Scan all version tags in your repository
2. Categorize commits between versions
3. Generate a formatted CHANGELOG.md in "Keep a Changelog" format
4. Create backup of existing CHANGELOG.md

The CHANGELOG.md follows the [Keep a Changelog](https://keepachangelog.com/) format with categories:
- **⚠️ BREAKING CHANGES**: Breaking changes
- **Added**: New features (`feat:`)
- **Changed**: Refactoring and improvements (`refactor:`, `perf:`)
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes (`fix:`)
- **Security**: Security improvements (`security:`)

Example CHANGELOG.md entry:

```markdown
## [1.3.0] - 2024-01-15

### Added
- **backup**: Automatic backup system with configurable schedule
- **mail**: Mailbox quota management
- **proxmox**: VM snapshot support

### Fixed
- **database**: Connection timeout issue
- **auth**: JWT token expiration bug

### Changed
- **dns**: Improved zone update performance
```

### Automatic Updates

When you create a new version with `create-version.sh`, you'll be prompted to update CHANGELOG.md automatically.

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
