import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PluginManifestSchema } from '@shared/types/plugin'

describe('Spotify Plugin Manifest', () => {
	const manifestPath = resolve(__dirname, '../../../plugins/spotify/manifest.json')
	const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf-8'))

	it('parses as a valid PluginManifest', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.pluginId).toBe('spotify')
		expect(result.pluginName).toBe('Spotify Playlist Creator')
	})

	it('has three tools: search_tracks, create_playlist, add_to_playlist', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.tools).toHaveLength(3)
		const toolNames = result.tools.map((t) => t.toolName)
		expect(toolNames).toContain('search_tracks')
		expect(toolNames).toContain('create_playlist')
		expect(toolNames).toContain('add_to_playlist')
	})

	it('has oauth2-pkce authentication', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.authentication.type).toBe('oauth2-pkce')
	})

	it('has correct category (external-authenticated)', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.category).toBe('external-authenticated')
	})

	it('is persistent', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.userInterface.isPersistent).toBe(true)
	})

	it('supports verbose state and event log', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.capabilities.supportsVerboseState).toBe(true)
		expect(result.capabilities.supportsEventLog).toBe(true)
		expect(result.capabilities.supportsScreenshot).toBe(false)
	})

	it('has a context prompt mentioning playlist', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.contextPrompt).toContain('playlist')
	})

	it('search_tracks has query parameter', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		const tool = result.tools.find((t) => t.toolName === 'search_tracks')!
		expect(tool.parameters).toHaveLength(1)
		expect(tool.parameters[0].parameterName).toBe('query')
	})

	it('create_playlist has required name and optional description', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		const tool = result.tools.find((t) => t.toolName === 'create_playlist')!
		expect(tool.parameters).toHaveLength(2)
		const nameParam = tool.parameters.find((p) => p.parameterName === 'playlistName')!
		const descParam = tool.parameters.find((p) => p.parameterName === 'description')!
		expect(nameParam.isRequired).toBe(true)
		expect(descParam.isRequired).toBe(false)
	})
})
