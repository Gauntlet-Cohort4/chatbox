import type { PluginManifest } from '@shared/types/plugin'
import type { PluginEventLogEntry } from '@/stores/pluginStore'

function formatRelativeTime(timestamp: number): string {
	const now = Date.now()
	const diffMs = now - timestamp
	const diffS = Math.floor(diffMs / 1000)

	if (diffS < 60) return `${diffS}s ago`
	if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`
	return `${Math.floor(diffS / 3600)}h ago`
}

export function buildPluginContextForLLM(
	manifest: PluginManifest,
	state: Record<string, unknown> | null,
	eventLog: PluginEventLogEntry[],
	stateDescription: string | null
): string {
	const lines: string[] = []

	lines.push(`[Active App: ${manifest.pluginName}]`)

	if (manifest.contextPrompt) {
		lines.push(manifest.contextPrompt)
	}

	if (state !== null) {
		if (stateDescription !== null) {
			lines.push(`\nCurrent app state: ${stateDescription}`)
		} else {
			lines.push(`\nCurrent app state: ${JSON.stringify(state)}`)
		}
	}

	if (eventLog.length > 0) {
		lines.push('\nRecent app events (newest first):')
		const reversed = [...eventLog].reverse()
		for (const entry of reversed) {
			lines.push(`- [${formatRelativeTime(entry.eventTimestamp)}] ${entry.eventDescription}`)
		}
	}

	return lines.join('\n')
}
