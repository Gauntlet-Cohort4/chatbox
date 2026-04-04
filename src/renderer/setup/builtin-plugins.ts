/**
 * Built-in plugin bootstrap.
 *
 * Registers plugins that ship with the app so they appear in the store
 * without needing a remote catalog. The plugin HTML is fetched from the
 * app bundle and stored locally so the iframe can load it.
 *
 * For Electron: the main process chatbox-plugin:// protocol serves from
 * blob storage, so we store the HTML there.
 *
 * For web: blob URLs are created from the stored content.
 */
import type { PluginCatalog, PluginManifest } from '@shared/types/plugin'
import { pluginStore } from '@/stores/pluginStore'
import platform from '@/platform'

// Built-in plugin manifests — these ship with the app
const BUILTIN_CHESS_MANIFEST: PluginManifest = {
	pluginId: 'chess',
	pluginName: 'Chess',
	description:
		'Interactive chess game. Play against yourself or ask the AI for move suggestions and analysis.',
	version: '1.0.0',
	author: 'ChatBridge',
	category: 'internal',
	contentRating: 'safe',
	tools: [
		{ toolName: 'start_game', toolDescription: 'Start a new chess game. Resets the board to the initial position with white to move first.', parameters: [] },
		{
			toolName: 'make_move',
			toolDescription: "Make a move on the chess board using standard algebraic notation. Examples: 'e4' (pawn to e4), 'Nf3' (knight to f3), 'O-O' (kingside castle).",
			parameters: [
				{ parameterName: 'move', parameterType: 'string', parameterDescription: 'The move in standard algebraic notation', isRequired: true },
			],
		},
		{ toolName: 'get_board_state', toolDescription: 'Get the current board position as a FEN string, the complete move history in algebraic notation, and the current game status.', parameters: [] },
		{ toolName: 'resign', toolDescription: 'Resign the current game. The side whose turn it is loses immediately.', parameters: [] },
	],
	bundle: {
		bundleUrl: 'builtin://chess',
		bundleVersion: '1.0.0',
		bundleHash: 'builtin',
		entryFile: 'index.html',
	},
	userInterface: {
		defaultWidth: 420,
		defaultHeight: 520,
		sandboxPermissions: [],
		isPersistent: true,
	},
	authentication: { type: 'none' },
	contextPrompt:
		`This is an interactive chess game running in the side panel.

CRITICAL: To make ANY move on the board, you MUST call the make_move tool. Never just describe a move in text — the board only updates when you use the tool. If a user says "play e4" or "move the pawn", call make_move with the algebraic notation. If you want to start a new game, call start_game first.

You can see the board state as a FEN string and the full move history via get_board_state. You understand FEN notation.

When the user asks for help, analyze the current position and suggest moves with explanations suitable for a student learning chess. Focus on teaching concepts like piece development, controlling the center, king safety, and tactical patterns (forks, pins, skewers). When a game ends, discuss what went well and what could be improved.

The user can also click or drag pieces directly on the board. If the board state changes without you making a move, the user moved a piece manually.`,
	capabilities: {
		supportsScreenshot: true,
		supportsVerboseState: true,
		supportsEventLog: true,
	},
}

const BUILTIN_MANIFESTS: PluginManifest[] = [BUILTIN_CHESS_MANIFEST]

/**
 * Fetches a built-in plugin's HTML content.
 * In Electron: reads from the app's resources/plugins/ directory via IPC.
 * In web/dev: fetches from the relative path.
 */
async function fetchBuiltinPluginHtml(pluginId: string): Promise<string | null> {
	try {
		// Try fetching from a relative path (works in dev and web)
		const response = await fetch(`/plugins/${pluginId}/index.html`)
		if (response.ok) {
			return await response.text()
		}
	} catch {
		// Ignore — may not be served at this path
	}
	return null
}

export async function registerBuiltinPlugins(): Promise<void> {
	const store = pluginStore.getState()

	// Build a catalog from built-in manifests merged with any remote catalog
	const existingCatalog = store.catalog
	const builtinEntries = BUILTIN_MANIFESTS.map((m) => ({
		...m,
		isVerified: true,
		approvedAt: Date.now(),
	}))

	// Merge: built-in plugins + remote catalog plugins (remote takes precedence on ID collision)
	const remoteApps = existingCatalog?.applications ?? []
	const remoteIds = new Set(remoteApps.map((a) => a.pluginId))
	const mergedApps = [
		...builtinEntries.filter((b) => !remoteIds.has(b.pluginId)),
		...remoteApps,
	]

	const mergedCatalog: PluginCatalog = {
		catalogVersion: existingCatalog?.catalogVersion ?? 0,
		lastUpdatedAt: Date.now(),
		applications: mergedApps,
	}

	store.setCatalog(mergedCatalog)

	// For each built-in plugin, store the HTML locally if not already cached
	for (const manifest of BUILTIN_MANIFESTS) {
		const cached = store.localBundles[manifest.pluginId]
		if (cached?.bundleVersion === manifest.bundle.bundleVersion) {
			continue // Already cached
		}

		const html = await fetchBuiltinPluginHtml(manifest.pluginId)
		if (html) {
			await platform.setStoreBlob(`plugin-bundle:${manifest.pluginId}`, html)
			const localUrl =
				platform.type === 'desktop'
					? `chatbox-plugin://${manifest.pluginId}/${manifest.bundle.entryFile}`
					: URL.createObjectURL(new Blob([html], { type: 'text/html' }))
			store.setLocalBundle(manifest.pluginId, manifest.bundle.bundleVersion, localUrl)
			console.info(`[builtin-plugins] Registered built-in plugin: ${manifest.pluginName}`)
		} else {
			console.warn(`[builtin-plugins] Could not load HTML for built-in plugin: ${manifest.pluginId}`)
		}
	}

	// Set default approval status for built-in plugins
	// Chess ships as deployed, others start as not-approved
	for (const manifest of BUILTIN_MANIFESTS) {
		const currentStatus = store.pluginApprovalStatus[manifest.pluginId]
		if (!currentStatus) {
			if (manifest.pluginId === 'chess') {
				store.setApprovalStatus('chess', 'deployed')
			}
			// Other built-in plugins default to 'not-approved' (no action needed, that's the default)
		}
	}
}
