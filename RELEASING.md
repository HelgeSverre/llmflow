# Releasing LLMFlow

This document describes the complete release process for LLMFlow.

## Version Scheme

LLMFlow follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Quick Release Checklist

```bash
# 1. Run tests
npm test

# 2. Update version in package.json
# Edit package.json: "version": "0.X.X"

# 3. Create release notes
# Create RELEASE_NOTES_v0.X.X.md

# 4. Commit and tag
git add -A
git commit -m "chore: release v0.X.X"
git tag v0.X.X
git push origin main --tags

# 5. Build and push Docker
docker build --platform linux/amd64,linux/arm64 -t helgesverre/llmflow:v0.X.X -t helgesverre/llmflow:latest --push .

# 6. Publish to npm
npm publish

# 7. Create GitHub Release (via web UI)
```

---

## Detailed Release Process

### Step 1: Pre-Release Testing

Before creating a release, ensure everything works:

```bash
# Run unit tests
npm test

# Run E2E tests (requires Playwright)
npm run test:e2e

# Test the server manually
npm start &
sleep 2

# Test with demo
npm run demo

# Test passthrough (requires API key)
curl http://localhost:8080/passthrough/openai/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}'

# Check dashboard
open http://localhost:3000

# Stop server
pkill -f "node server.js"
```

### Step 2: Update Version Numbers

Edit `package.json`:

```json
{
  "version": "0.X.X"
}
```

If releasing SDK changes, also update `sdk/package.json`:

```json
{
  "version": "0.X.X"
}
```

### Step 3: Create Release Notes

Create a file `RELEASE_NOTES_v0.X.X.md` with:

```markdown
# Release Notes - LLMFlow v0.X.X

**Release Date:** YYYY-MM-DD

## What's New
- Feature 1
- Feature 2

## Bug Fixes
- Fix 1
- Fix 2

## Breaking Changes
- None (or list them)

## Upgrade Guide
\`\`\`bash
npx llmflow@latest
\`\`\`

## Full Changelog
[v0.X.X...v0.Y.Y](https://github.com/HelgeSverre/llmflow/compare/v0.X.X...v0.Y.Y)
```

### Step 4: Commit and Push

```bash
# Stage all changes
git add -A

# Commit with release message
git commit -m "chore: release v0.X.X

- Brief summary of changes
- Another change"

# Push to main
git push origin main
```

### Step 5: Create Git Tag

```bash
# Create annotated tag
git tag -a v0.X.X -m "Release v0.X.X"

# Push tag to remote
git push origin v0.X.X

# Or push all tags
git push origin --tags
```

### Step 6: Build and Push Docker Image

#### Prerequisites

1. **Docker Buildx** (for multi-platform builds):
   ```bash
   docker buildx create --name multiarch --use
   docker buildx inspect --bootstrap
   ```

2. **Docker Hub Login**:
   ```bash
   docker login
   # Enter: helgesverre / <password or token>
   ```

#### Build Commands

**Option A: Multi-platform build (Recommended)**

Builds for both AMD64 (Intel/AMD) and ARM64 (Apple Silicon, AWS Graviton):

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t helgesverre/llmflow:v0.X.X \
  -t helgesverre/llmflow:latest \
  --push \
  .
```

**Option B: Single platform build**

If you don't need multi-platform:

```bash
# Build
docker build -t helgesverre/llmflow:v0.X.X .

# Tag as latest
docker tag helgesverre/llmflow:v0.X.X helgesverre/llmflow:latest

# Push both tags
docker push helgesverre/llmflow:v0.X.X
docker push helgesverre/llmflow:latest
```

#### Verify Docker Image

```bash
# Pull and test the image
docker run --rm -p 8080:8080 -p 3000:3000 helgesverre/llmflow:v0.X.X

# In another terminal, test it
curl http://localhost:8080/health
curl http://localhost:3000/api/health
```

### Step 7: Publish to npm

```bash
# Ensure you're logged in
npm whoami
# Should show: helgesverre

# If not logged in:
npm login

# Publish (from repo root)
npm publish

# Verify
npm info llmflow
```

Users can then install via:

```bash
npx llmflow@0.X.X
# or
npx llmflow@latest
```

### Step 8: Create GitHub Release

1. Go to [Releases](https://github.com/HelgeSverre/llmflow/releases)
2. Click **"Draft a new release"**
3. Select the tag `v0.X.X`
4. Title: `v0.X.X`
5. Copy content from `RELEASE_NOTES_v0.X.X.md`
6. Click **"Publish release"**

---

## SDK Release (Optional)

If SDK changes were made:

```bash
cd sdk

# Ensure version is updated
cat package.json | grep version

# Publish
npm publish --access public

cd ..
```

---

## Rollback Procedure

If a release has critical issues:

### npm Rollback

```bash
# Deprecate the bad version
npm deprecate llmflow@0.X.X "Critical bug - use 0.X.Y instead"

# Users will see a warning but can still install
# To completely unpublish (within 72 hours only):
npm unpublish llmflow@0.X.X
```

### Docker Rollback

```bash
# Point latest to previous good version
docker tag helgesverre/llmflow:v0.X.Y helgesverre/llmflow:latest
docker push helgesverre/llmflow:latest
```

### Git Rollback

```bash
# Delete remote tag (use sparingly)
git push origin :refs/tags/v0.X.X

# Delete local tag
git tag -d v0.X.X
```

---

## Environment Setup

### Required Accounts

| Service | Purpose | URL |
|---------|---------|-----|
| npm | Package registry | https://www.npmjs.com/ |
| Docker Hub | Container registry | https://hub.docker.com/ |
| GitHub | Source & releases | https://github.com/ |

### Required Tools

```bash
# Check Node.js (18+)
node --version

# Check npm
npm --version

# Check Docker
docker --version
docker buildx version

# Check Git
git --version
```

### Environment Variables

For automated releases, you may want these:

```bash
# npm token (for CI)
NPM_TOKEN=npm_xxxxx

# Docker Hub credentials (for CI)
DOCKER_USERNAME=helgesverre
DOCKER_PASSWORD=xxxxx
```

---

## Troubleshooting

### Docker build fails on ARM

Ensure buildx is set up for multi-platform:

```bash
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

### npm publish fails with 403

Check you're logged in and have publish rights:

```bash
npm whoami
npm access list packages helgesverre
```

### Tag already exists

If you need to move a tag:

```bash
# Delete remote tag
git push origin :refs/tags/v0.X.X

# Delete local tag
git tag -d v0.X.X

# Re-create and push
git tag v0.X.X
git push origin v0.X.X
```

---

## Post-Release Checklist

After releasing:

- [ ] Verify npm package: `npm info llmflow`
- [ ] Verify Docker image: `docker pull helgesverre/llmflow:latest`
- [ ] Verify GitHub release page
- [ ] Test fresh install: `npx llmflow@latest`
- [ ] Close related GitHub issues
- [ ] Update DOCKER_HUB.md if needed
- [ ] Announce release (Twitter, Discord, etc.)
