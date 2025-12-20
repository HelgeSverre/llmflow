# Releasing LLMFlow

This document describes the release process for LLMFlow.

## Version Scheme

LLMFlow follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Pre-Release Checklist

Before creating a release:

1. **Run tests**
   ```bash
   npm test
   ```

2. **Test the demo**
   ```bash
   npm start &
   npm run demo
   ```

3. **Update version numbers**
   - `package.json` - main server version
   - `sdk/package.json` - SDK version (keep in sync)

4. **Update PLAN.md**
   - Mark completed features
   - Update "Current State" section

5. **Review README.md**
   - Ensure examples are up to date
   - Check all links work

## Creating a Release

### 1. Update Versions

```bash
# Update main package version
npm version minor  # or patch/major

# Update SDK version (keep in sync)
cd sdk
npm version minor
cd ..
```

### 2. Commit Changes

```bash
git add -A
git commit -m "chore: prepare release v0.X.X"
git push origin main
```

### 3. Create GitHub Release

```bash
# Create and push a tag
git tag v0.X.X
git push origin v0.X.X
```

Then on GitHub:
1. Go to [Releases](https://github.com/HelgeSverre/llmflow/releases)
2. Click "Draft a new release"
3. Select the tag you just pushed
4. Write release notes (see template below)
5. Publish release

### Release Notes Template

```markdown
## What's New

- Feature 1 description
- Feature 2 description

## Bug Fixes

- Fix 1 description

## Breaking Changes

- None (or list breaking changes)

## Upgrade Guide

```bash
git pull origin main
npm install
```

## Full Changelog

[v0.X.X...v0.Y.Y](https://github.com/HelgeSverre/llmflow/compare/v0.X.X...v0.Y.Y)
```

## Publishing the SDK to npm (Optional)

If you want to publish the SDK to npm:

```bash
cd sdk

# Login to npm (first time only)
npm login

# Publish
npm publish --access public
```

Then users can install via:
```bash
npm install llmflow-sdk
```

## SDK Installation Methods

Currently, users can install the SDK in three ways:

### 1. From GitHub (Recommended)

```bash
npm install github:HelgeSverre/llmflow#v0.X.X
```

### 2. Local Link (Development)

```bash
cd llmflow/sdk
npm link

cd your-project
npm link llmflow-sdk
```

### 3. Copy SDK Files

Copy `sdk/index.js` and `sdk/index.d.ts` to your project.

## Docker Release

Build and push Docker image:

```bash
# Build
docker build -t llmflow:v0.X.X .

# Tag for registry (if using Docker Hub)
docker tag llmflow:v0.X.X helgesverre/llmflow:v0.X.X
docker tag llmflow:v0.X.X helgesverre/llmflow:latest

# Push
docker push helgesverre/llmflow:v0.X.X
docker push helgesverre/llmflow:latest
```

## Post-Release

After releasing:

1. Announce on social media (if desired)
2. Update any documentation sites
3. Close related GitHub issues
4. Start planning next release
