/**
 * Cross-platform script to delete .map files from the build output.
 * Replaces the Unix `find` command that doesn't work on Windows.
 */
import { readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

function deleteMapFiles(dir: string): number {
	let count = 0
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name)
			if (entry.isDirectory()) {
				count += deleteMapFiles(fullPath)
			} else if (entry.name.endsWith('.map')) {
				unlinkSync(fullPath)
				count++
			}
		}
	} catch {
		// Directory may not exist yet
	}
	return count
}

const deleted = deleteMapFiles('release/app/dist')
console.log(`Deleted ${deleted} source map files`)
