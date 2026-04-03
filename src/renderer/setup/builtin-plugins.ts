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
		'This is an interactive chess game. The user plays on the board in the side panel. You can see the board state as a FEN string and the full move history. When the user asks for help, analyze the current position and suggest moves with explanations suitable for a student learning chess. Focus on teaching chess concepts like piece development, controlling the center, king safety, and recognizing tactical patterns (forks, pins, skewers) rather than just giving the optimal engine move. When a game ends, discuss what went well and what could be improved. You understand FEN notation and can read board positions from it.',
	capabilities: {
		supportsScreenshot: true,
		supportsVerboseState: true,
		supportsEventLog: true,
	},
}

const UNHINGED_MATH_MANIFEST: PluginManifest = {
	pluginId: 'unhinged-math',
	pluginName: 'Unhinged Math',
	description:
		'A chaotic math tutor that teaches algebra, geometry, and calculus through absurd word problems and over-the-top reactions. Makes math memorable by being wildly enthusiastic about numbers.',
	version: '0.9.0',
	author: 'MathChaos Labs',
	category: 'external-public',
	contentRating: 'educational',
	tools: [
		{
			toolName: 'generate_problem',
			toolDescription: 'Generate a wild math problem at the specified difficulty level.',
			parameters: [
				{ parameterName: 'topic', parameterType: 'string', parameterDescription: 'Math topic (algebra, geometry, calculus)', isRequired: true },
				{ parameterName: 'difficulty', parameterType: 'string', parameterDescription: 'easy, medium, or hard', isRequired: false },
			],
		},
		{
			toolName: 'check_answer',
			toolDescription: 'Check if the student answer is correct and provide dramatic feedback.',
			parameters: [
				{ parameterName: 'problemId', parameterType: 'string', parameterDescription: 'The problem ID to check', isRequired: true },
				{ parameterName: 'answer', parameterType: 'string', parameterDescription: 'The student answer', isRequired: true },
			],
		},
	],
	bundle: {
		bundleUrl: 'builtin://unhinged-math',
		bundleVersion: '0.9.0',
		bundleHash: 'mock',
		entryFile: 'index.html',
	},
	userInterface: {
		defaultWidth: 400,
		defaultHeight: 500,
		sandboxPermissions: [],
		isPersistent: true,
	},
	authentication: { type: 'none' },
	contextPrompt:
		'This is Unhinged Math — a chaotic but educational math tutor. Generate absurd word problems and give over-the-top reactions to answers.',
	capabilities: {
		supportsScreenshot: false,
		supportsVerboseState: true,
		supportsEventLog: false,
	},
}

const BUILTIN_MANIFESTS: PluginManifest[] = [BUILTIN_CHESS_MANIFEST, UNHINGED_MATH_MANIFEST]

/**
 * Fetches a built-in plugin's HTML content.
 * In Electron: reads from the app's resources/plugins/ directory via IPC.
 * In web/dev: fetches from the relative path.
 */
async function fetchBuiltinPluginHtml(pluginId: string): Promise<string | null> {
	try {
		// Try fetching from a relative path (works in dev and web)
		const response = await fetch(`./plugins/${pluginId}/index.html`)
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
