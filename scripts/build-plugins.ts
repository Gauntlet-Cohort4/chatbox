/**
 * Build script for plugins.
 *
 * For each plugin in plugins/:
 * 1. Reads index.html
 * 2. Computes SHA-256 hash
 * 3. Generates a dev catalog JSON at plugins/dev-catalog.json
 *
 * Usage: npx tsx scripts/build-plugins.ts
 */
import { createHash } from 'crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const PLUGINS_DIR = resolve(__dirname, '../plugins')
const DEV_SERVER_PORT = 9877
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

interface PluginManifest {
	pluginId: string
	pluginName: string
	[key: string]: unknown
	bundle: {
		bundleUrl: string
		bundleVersion: string
		bundleHash: string
		entryFile: string
	}
}

function computeHash(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}

function main() {
	const pluginDirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)

	const applications: Array<PluginManifest & { isVerified: boolean; approvedAt: number }> = []

	for (const dir of pluginDirs) {
		const manifestPath = join(PLUGINS_DIR, dir, 'manifest.json')
		const indexPath = join(PLUGINS_DIR, dir, 'index.html')

		if (!existsSync(manifestPath) || !existsSync(indexPath)) {
			console.warn(`Skipping ${dir}: missing manifest.json or index.html`)
			continue
		}

		const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
		const htmlContent = readFileSync(indexPath, 'utf-8')
		const hash = computeHash(htmlContent)

		// Update bundle info for dev serving
		manifest.bundle = {
			...manifest.bundle,
			bundleUrl: `${DEV_SERVER_URL}/plugins/${dir}/index.html`,
			bundleHash: hash,
		}

		applications.push({
			...manifest,
			isVerified: true,
			approvedAt: Date.now(),
		})

		console.log(`✓ ${manifest.pluginName} (${dir}) — hash: ${hash.slice(0, 12)}...`)
	}

	const catalog = {
		catalogVersion: Date.now(),
		lastUpdatedAt: Date.now(),
		applications,
	}

	const outputPath = join(PLUGINS_DIR, 'dev-catalog.json')
	writeFileSync(outputPath, JSON.stringify(catalog, null, 2))
	console.log(`\nCatalog written to ${outputPath} with ${applications.length} plugins`)
	console.log(`\nTo use: run "npx tsx scripts/serve-plugins.ts" and set catalogUrl to "${DEV_SERVER_URL}/catalog.json"`)
}

main()
