import { describe, expect, it } from 'vitest'
import { buildPluginContextForLLM } from './builder'
import type { PluginManifest } from '@shared/types/plugin'
import type { PluginEventLogEntry } from '@/stores/pluginStore'

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
	return {
		pluginId: 'chess',
		pluginName: 'Chess',
		description: 'Play chess',
		version: '1.0.0',
		author: 'Test',
		category: 'internal',
		contentRating: 'safe',
		tools: [],
		bundle: {
			bundleUrl: 'https://example.com/chess.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc',
			entryFile: 'index.html',
		},
		userInterface: { sandboxPermissions: [], isPersistent: true },
		authentication: { type: 'none' },
		capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
		contextPrompt: 'Help the student play chess.',
		...overrides,
	}
}

describe('buildPluginContextForLLM', () => {
	it('includes "[Active App: {pluginName}]" header', () => {
		const result = buildPluginContextForLLM(createTestManifest(), null, [], null)
		expect(result).toContain('[Active App: Chess]')
	})

	it('includes contextPrompt text when manifest has one', () => {
		const result = buildPluginContextForLLM(createTestManifest(), null, [], null)
		expect(result).toContain('Help the student play chess.')
	})

	it('omits contextPrompt section when manifest has none', () => {
		const manifest = createTestManifest({ contextPrompt: undefined })
		const result = buildPluginContextForLLM(manifest, null, [], null)
		expect(result).not.toContain('Help the student')
	})

	it('includes "Current app state:" with stateDescription when both provided', () => {
		const state = { fen: 'some-fen' }
		const result = buildPluginContextForLLM(createTestManifest(), state, [], 'White played e4')
		expect(result).toContain('Current app state: White played e4')
	})

	it('includes "Current app state:" with JSON stringified state when no description', () => {
		const state = { fen: 'some-fen' }
		const result = buildPluginContextForLLM(createTestManifest(), state, [], null)
		expect(result).toContain('Current app state:')
		expect(result).toContain('"fen"')
	})

	it('omits state section when state is null', () => {
		const result = buildPluginContextForLLM(createTestManifest(), null, [], null)
		expect(result).not.toContain('Current app state:')
	})

	it('includes "Recent app events" section with formatted entries', () => {
		const eventLog: PluginEventLogEntry[] = [
			{ eventDescription: 'Pawn to e4', eventTimestamp: Date.now() - 5000 },
			{ eventDescription: 'Pawn to e5', eventTimestamp: Date.now() - 2000 },
		]
		const result = buildPluginContextForLLM(createTestManifest(), null, eventLog, null)
		expect(result).toContain('Recent app events')
		expect(result).toContain('Pawn to e4')
		expect(result).toContain('Pawn to e5')
	})

	it('orders event log entries newest first', () => {
		const eventLog: PluginEventLogEntry[] = [
			{ eventDescription: 'First event', eventTimestamp: 1000 },
			{ eventDescription: 'Second event', eventTimestamp: 2000 },
		]
		const result = buildPluginContextForLLM(createTestManifest(), null, eventLog, null)
		const firstIdx = result.indexOf('Second event')
		const secondIdx = result.indexOf('First event')
		expect(firstIdx).toBeLessThan(secondIdx)
	})

	it('omits event section when eventLog is empty', () => {
		const result = buildPluginContextForLLM(createTestManifest(), null, [], null)
		expect(result).not.toContain('Recent app events')
	})

	it('handles all-null/empty inputs (returns just header and contextPrompt)', () => {
		const result = buildPluginContextForLLM(createTestManifest(), null, [], null)
		expect(result).toContain('[Active App: Chess]')
		expect(result).toContain('Help the student play chess.')
		expect(result).not.toContain('Current app state:')
		expect(result).not.toContain('Recent app events')
	})

	it('formats timestamps as readable values', () => {
		const eventLog: PluginEventLogEntry[] = [
			{ eventDescription: 'Test event', eventTimestamp: Date.now() - 3000 },
		]
		const result = buildPluginContextForLLM(createTestManifest(), null, eventLog, null)
		// Should contain some time indicator (seconds ago or timestamp)
		expect(result).toMatch(/\d/)
	})
})
