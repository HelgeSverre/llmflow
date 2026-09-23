// Writes the environment variable docs generated from packages/shared/src/config.ts into
// .env.example, README.md and the llmflow launcher's --help. Run after editing SETTINGS.
import path from 'node:path'
import {
    HELP_MARKERS,
    README_MARKERS,
    renderEnvExample,
    renderHelpBlock,
    renderReadmeTable,
    replaceBlock,
} from '@llmflow/shared/config-docs'

const root = path.resolve(import.meta.dir, '..')
const update = async (file: string, render: (current: string) => string) => {
    const target = path.join(root, file)
    await Bun.write(target, render(await Bun.file(target).text()))
}

await Bun.write(path.join(root, '.env.example'), renderEnvExample())
await update('README.md', (text) => replaceBlock(text, ...README_MARKERS, renderReadmeTable()))
await update('apps/server/bin/llmflow.js', (text) =>
    replaceBlock(text, ...HELP_MARKERS, renderHelpBlock()),
)
console.log('Updated .env.example, README.md and apps/server/bin/llmflow.js')
