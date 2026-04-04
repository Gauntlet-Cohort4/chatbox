/**
 * Copies built-in plugin HTML files into the web build output directory
 * so they can be fetched by the builtin-plugins bootstrap.
 *
 * Usage: npx tsx scripts/copy-plugins-to-web.ts
 * Run after: pnpm build:web
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

const PLUGINS_DIR = resolve(__dirname, '../plugins')
const WEB_OUTPUT = resolve(__dirname, '../release/app/dist/renderer/plugins')

const pluginDirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)

for (const dir of pluginDirs) {
	const indexPath = join(PLUGINS_DIR, dir, 'index.html')
	if (!existsSync(indexPath)) continue

	const outDir = join(WEB_OUTPUT, dir)
	mkdirSync(outDir, { recursive: true })
	copyFileSync(indexPath, join(outDir, 'index.html'))
	console.log(`Copied ${dir}/index.html → ${outDir}/`)
}

console.log(`Done. ${pluginDirs.length} plugins copied to web build.`)
