/**
 * Local dev server for plugin bundles and catalog.
 *
 * Serves:
 *   GET /catalog.json        → plugins/dev-catalog.json
 *   GET /plugins/:id/:file   → plugins/:id/:file
 *
 * Usage: npx tsx scripts/serve-plugins.ts
 * First run: npx tsx scripts/build-plugins.ts
 */
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { resolve, join, extname } from 'path'

const PORT = 9877
const PLUGINS_DIR = resolve(__dirname, '../plugins')

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
}

const server = createServer((req, res) => {
	const url = req.url || '/'

	// CORS headers for cross-origin iframe loading
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET')

	if (url === '/catalog.json') {
		const catalogPath = join(PLUGINS_DIR, 'dev-catalog.json')
		if (!existsSync(catalogPath)) {
			res.writeHead(404)
			res.end('Catalog not found. Run "npx tsx scripts/build-plugins.ts" first.')
			return
		}
		const content = readFileSync(catalogPath, 'utf-8')
		// ETag support for 304 responses
		const etag = `"${Buffer.from(content).length}-${Date.now()}"` // simplified
		res.setHeader('ETag', etag)
		res.setHeader('Content-Type', 'application/json')
		res.writeHead(200)
		res.end(content)
		return
	}

	// Serve plugin files: /plugins/:pluginId/:file
	const pluginMatch = url.match(/^\/plugins\/([^/]+)\/(.+)$/)
	if (pluginMatch) {
		const [, pluginId, file] = pluginMatch
		const filePath = join(PLUGINS_DIR, pluginId, file)
		if (!existsSync(filePath)) {
			res.writeHead(404)
			res.end('File not found')
			return
		}
		const content = readFileSync(filePath)
		const ext = extname(file)
		res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
		res.writeHead(200)
		res.end(content)
		return
	}

	res.writeHead(404)
	res.end('Not found')
})

server.listen(PORT, () => {
	console.log(`Plugin dev server running at http://localhost:${PORT}`)
	console.log(`  Catalog: http://localhost:${PORT}/catalog.json`)
	console.log(`  Plugins: http://localhost:${PORT}/plugins/{pluginId}/index.html`)
	console.log(`\nSet catalogUrl in settings to: http://localhost:${PORT}/catalog.json`)
})
