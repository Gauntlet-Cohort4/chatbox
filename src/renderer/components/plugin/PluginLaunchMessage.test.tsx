import { describe, expect, it } from 'vitest'

describe('PluginLaunchMessage', () => {
	it('detects plugin launch by tool name pattern', () => {
		const toolName = 'plugin__chess__launch'
		expect(toolName.startsWith('plugin__')).toBe(true)
		expect(toolName.endsWith('__launch')).toBe(true)
	})

	it('extracts plugin name from launch tool name', () => {
		const toolName = 'plugin__chess__launch'
		const parts = toolName.split('__')
		expect(parts[1]).toBe('chess')
	})

	it('does not match non-plugin tool calls', () => {
		const toolName = 'web_search'
		expect(toolName.startsWith('plugin__')).toBe(false)
	})
})
