// Prepares a release: bumps llmflow and llmflow-sdk to <version> in lockstep, turns
// release-notes/UNRELEASED.md into release-notes/v<version>.md, commits and tags v<version>.
// It never pushes; pushing the tag starts .github/workflows/release.yml. See RELEASING.md.
//
//   bun run release <version> [--dry-run]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')
const MANIFESTS = ['apps/server/package.json', 'packages/sdk/package.json']
const UNRELEASED = 'release-notes/UNRELEASED.md'
const UNRELEASED_TEMPLATE = `# LLMFlow — Unreleased

<!-- Add user-visible changes here. \`just release <version>\` turns this file into release-notes/v<version>.md. -->
`

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const version = args.find((arg) => !arg.startsWith('--'))

function fail(message: string): never {
    console.error(`release: ${message}`)
    process.exit(1)
}

function git(...command: string[]) {
    const result = Bun.spawnSync(['git', ...command], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    if (result.exitCode !== 0)
        fail(`git ${command.join(' ')} failed: ${result.stderr.toString().trim()}`)
    return result.stdout.toString().trim()
}

const parse = (value: string) => value.split('.').map(Number)
function newer(candidate: string, current: string) {
    const [a, b] = [parse(candidate), parse(current)]
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
    return false
}

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) fail('usage: bun run release <X.Y.Z> [--dry-run]')

const current = JSON.parse(readFileSync(path.join(root, MANIFESTS[0]!), 'utf8')).version as string
if (!newer(version, current)) fail(`${version} is not newer than the current version ${current}`)
for (const manifest of MANIFESTS) {
    const own = JSON.parse(readFileSync(path.join(root, manifest), 'utf8')).version
    if (own !== current)
        fail(`${manifest} is ${own} but ${MANIFESTS[0]} is ${current}; they move in lockstep`)
}

// A dry run only previews, so repository-state problems are reported without stopping it.
const check = (ok: boolean, message: string) =>
    ok || (dryRun ? console.warn(`release: warning: ${message}`) : fail(message))
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
check(branch === 'main', `releases are cut from main (on ${branch})`)
check(!git('status', '--porcelain'), 'the working tree has uncommitted changes')
if (git('tag', '--list', `v${version}`)) fail(`tag v${version} already exists`)

const notesFile = `release-notes/v${version}.md`
if (existsSync(path.join(root, notesFile))) fail(`${notesFile} already exists`)
const unreleased = readFileSync(path.join(root, UNRELEASED), 'utf8')
const body = unreleased
    .replace(/^# .*\n/, '')
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    .trim()
if (!body) fail(`${UNRELEASED} is empty; record the release's changes there first`)
const notes = `# LLMFlow v${version}\n\n${body}\n`

console.log(`Release v${version} (from ${current}):`)
console.log(`  bump ${MANIFESTS.join(', ')}`)
console.log(`  write ${notesFile} from ${UNRELEASED} and reset ${UNRELEASED}`)
console.log(`  commit "Release v${version}" and tag v${version}`)
if (dryRun) {
    console.log('\n--dry-run: nothing changed. Notes preview:\n')
    console.log(notes)
    process.exit(0)
}

for (const manifest of MANIFESTS) {
    const file = path.join(root, manifest)
    const text = readFileSync(file, 'utf8')
    writeFileSync(file, text.replace(`"version": "${current}"`, `"version": "${version}"`))
}
// bun.lock records workspace versions.
const install = Bun.spawnSync(['bun', 'install'], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
})
if (install.exitCode !== 0) fail('bun install failed')
writeFileSync(path.join(root, notesFile), notes)
writeFileSync(path.join(root, UNRELEASED), UNRELEASED_TEMPLATE)

git('add', ...MANIFESTS, 'bun.lock', notesFile, UNRELEASED)
git('commit', '-m', `Release v${version}`)
git('tag', '-a', `v${version}`, '-m', `v${version}`)
console.log(
    `\nCommitted and tagged v${version}. Publish with:\n\n  git push origin main v${version}\n`,
)
