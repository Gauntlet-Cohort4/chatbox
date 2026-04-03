import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PluginManifestSchema } from '@shared/types/plugin'

describe('Weather Plugin Manifest', () => {
	const manifestPath = resolve(__dirname, '../../../plugins/weather/manifest.json')
	const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf-8'))

	it('parses as a valid PluginManifest', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.pluginId).toBe('weather')
		expect(result.pluginName).toBe('Weather Dashboard')
	})

	it('has the lookup_weather tool', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.tools).toHaveLength(1)
		expect(result.tools[0].toolName).toBe('lookup_weather')
	})

	it('has correct category and content rating', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.category).toBe('external-public')
		expect(result.contentRating).toBe('safe')
	})

	it('is not persistent (one-shot display)', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.userInterface.isPersistent).toBe(false)
	})

	it('has no screenshot/state/event capabilities', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.capabilities.supportsScreenshot).toBe(false)
		expect(result.capabilities.supportsVerboseState).toBe(false)
		expect(result.capabilities.supportsEventLog).toBe(false)
	})

	it('has a context prompt', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		expect(result.contextPrompt).toBeDefined()
		expect(result.contextPrompt).toContain('weather')
	})

	it('lookup_weather tool has location parameter', () => {
		const result = PluginManifestSchema.parse(manifestJson)
		const tool = result.tools[0]
		expect(tool.parameters).toHaveLength(1)
		expect(tool.parameters[0].parameterName).toBe('location')
		expect(tool.parameters[0].parameterType).toBe('string')
		expect(tool.parameters[0].isRequired).toBe(true)
	})
})
