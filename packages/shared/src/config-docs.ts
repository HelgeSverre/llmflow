// Renders the environment variable documentation from SETTINGS. scripts/gen-env-docs.ts writes
// the output into .env.example, README.md and the llmflow launcher; a test asserts they match.
import { GROUP_NOTES, SETTINGS, type Group, type Setting } from './config'

const GROUPS = [...new Set(SETTINGS.map((setting) => setting.group))] as Group[]
const inGroup = (group: Group) => SETTINGS.filter((setting) => setting.group === group)
// AZURE_DEPLOYMENT_<MODEL> documents a family of variables, not one name.
const isPattern = (setting: Setting) => setting.name.includes('<')

export const GENERATED_NOTE =
    'Generated from packages/shared/src/config.ts by `bun run env:docs`; edit that list, not this block.'

export function renderEnvExample(): string {
    const lines = [
        '# LLMFlow environment variables',
        `# ${GENERATED_NOTE}`,
        '# Copy this file to .env and uncomment or fill in what you need. Commented values are the',
        '# defaults, or examples where the default is computed.',
        '# .env files are not shell-expanded: write absolute paths, never ~ or $HOME.',
    ]
    for (const group of GROUPS) {
        lines.push('', '# ===========================================', `# ${group}`)
        lines.push('# ===========================================')
        for (const note of GROUP_NOTES[group] ?? []) lines.push(`# ${note}`)
        for (const setting of inGroup(group)) {
            lines.push('', `# ${setting.description}`)
            for (const note of setting.notes ?? []) lines.push(`# ${note}`)
            if (isPattern(setting)) continue
            const value = setting.default ?? setting.example ?? ''
            lines.push(setting.fillIn ? `${setting.name}=` : `# ${setting.name}=${value}`)
        }
    }
    return lines.join('\n') + '\n'
}

export function renderReadmeTable(): string {
    const cell = (text: string) => text.replaceAll('|', '\\|')
    const lines = [`<!-- ${GENERATED_NOTE} -->`]
    for (const group of GROUPS) {
        lines.push(
            '',
            `**${group}**`,
            '',
            '| Variable | Default | Description |',
            '| --- | --- | --- |',
        )
        for (const setting of inGroup(group))
            lines.push(
                `| \`${setting.name}\` | ${setting.default ? `\`${cell(setting.default)}\`` : ''} | ${cell(setting.description)} |`,
            )
    }
    return lines.join('\n')
}

export function renderHelp(): string {
    const width = Math.max(...SETTINGS.map((setting) => setting.name.length)) + 2
    const lines = ['Environment (see .env.example):']
    for (const group of GROUPS) {
        lines.push(`  ${group}`)
        for (const setting of inGroup(group)) {
            const fallback = setting.default ? ` (default ${setting.default})` : ''
            lines.push(`    ${setting.name.padEnd(width)}${setting.description}${fallback}`)
        }
    }
    return lines.join('\n')
}

/** Replaces the text between `start` and `end` markers (exclusive) in `source`. */
export function replaceBlock(source: string, start: string, end: string, block: string): string {
    const from = source.indexOf(start)
    const to = source.indexOf(end, from)
    if (from < 0 || to < 0) throw new Error(`Markers ${start} ... ${end} not found`)
    return source.slice(0, from + start.length) + '\n' + block + '\n' + source.slice(to)
}

export const README_MARKERS = ['<!-- env:start -->', '<!-- env:end -->'] as const
export const HELP_MARKERS = ['// env-help:start', '// env-help:end'] as const

/** The launcher embeds the help text as a JS template literal. */
export function renderHelpBlock(): string {
    return `const ENVIRONMENT_HELP = ${JSON.stringify(renderHelp())}`
}
