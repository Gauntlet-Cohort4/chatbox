import { Group, Loader, Text } from '@mantine/core'
import { IconPuzzle } from '@tabler/icons-react'
import type { FC } from 'react'

interface PluginLaunchMessageProps {
	toolName: string
}

function isPluginLaunchTool(toolName: string): boolean {
	return toolName.startsWith('plugin__') && toolName.endsWith('__launch')
}

function extractPluginName(toolName: string): string {
	const parts = toolName.split('__')
	return parts.length >= 2 ? parts[1] : 'App'
}

export const PluginLaunchMessage: FC<PluginLaunchMessageProps> = ({ toolName }) => {
	if (!isPluginLaunchTool(toolName)) {
		return null
	}

	const pluginName = extractPluginName(toolName)

	return (
		<Group gap="xs" py={4}>
			<IconPuzzle size={16} className="text-blue-500" />
			<Text size="sm" c="dimmed">
				Opening {pluginName}...
			</Text>
			<Loader size="xs" />
		</Group>
	)
}

export { isPluginLaunchTool }
