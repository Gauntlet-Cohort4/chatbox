/**
 * Web dev server for the built ChatBridge app.
 *
 * Handles:
 *   1. Static files from the web build (release/app/dist/renderer/)
 *   2. Plugin files from plugins/ directory (not SPA-rewritten)
 *   3. SPA fallback — unknown routes return index.html
 *
 * Usage: npx tsx scripts/serve-web.ts
 * First run: pnpm build:web
 */
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { resolve, join, extname } from 'path'

const PORT = Number(process.env.PORT) || 3001
const WEB_ROOT = resolve(__dirname, '../release/app/dist/renderer')
const PLUGINS_DIR = resolve(__dirname, '../plugins')
const INDEX_HTML = join(WEB_ROOT, 'index.html')

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.ico': 'image/x-icon',
	'.wasm': 'application/wasm',
}

function serveFile(res: any, filePath: string): boolean {
	if (!existsSync(filePath)) return false
	const content = readFileSync(filePath)
	const ext = extname(filePath)
	res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
	res.writeHead(200)
	res.end(content)
	return true
}

const server = createServer((req, res) => {
	const url = (req.url || '/').split('?')[0] // strip query params

	// CORS for plugin iframes
	res.setHeader('Access-Control-Allow-Origin', '*')

	// 1. Plugin files — serve directly from plugins/ source directory
	//    These MUST be checked before SPA fallback
	const pluginMatch = url.match(/^\/plugins\/([^/]+)\/(.+)$/)
	if (pluginMatch) {
		const [, pluginId, file] = pluginMatch
		const filePath = join(PLUGINS_DIR, pluginId, file)
		if (serveFile(res, filePath)) return
		res.writeHead(404)
		res.end('Plugin file not found')
		return
	}

	// 2. Static files from web build
	const staticPath = join(WEB_ROOT, url)
	if (url !== '/' && serveFile(res, staticPath)) return

	// 3. Try index file for directory paths
	if (url.endsWith('/')) {
		const indexPath = join(WEB_ROOT, url, 'index.html')
		if (serveFile(res, indexPath)) return
	}

	// 4. SPA fallback — return root index.html for client-side routes
	if (existsSync(INDEX_HTML)) {
		const content = readFileSync(INDEX_HTML)
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.writeHead(200)
		res.end(content)
		return
	}

	res.writeHead(404)
	res.end('Not found')
})

server.listen(PORT, () => {
	console.log(`ChatBridge web server running at http://localhost:${PORT}`)
	console.log(`  Web root: ${WEB_ROOT}`)
	console.log(`  Plugins:  ${PLUGINS_DIR}`)
	console.log(`  SPA fallback enabled`)
})
