import { Badge, Box, Button, Collapse, Group, List, Modal, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { pluginStore } from '@/stores/pluginStore'
import type { PluginCatalogEntry } from '@shared/types/plugin'

const CATEGORY_COLORS: Record<string, string> = {
	internal: 'blue',
	'external-public': 'green',
	'external-authenticated': 'orange',
}

interface PluginDetailModalProps {
	readonly entry: PluginCatalogEntry | null
	readonly opened: boolean
	readonly onClose: () => void
}

export function PluginDetailModal({ entry, opened, onClose }: PluginDetailModalProps) {
	const enabledPluginIds = usePluginStore((s) => s.enabledPluginIds)
	const [contextPromptOpen, setContextPromptOpen] = useState(false)

	if (!entry) return null

	const isEnabled = enabledPluginIds.includes(entry.pluginId)

	const handleToggle = () => {
		if (isEnabled) {
			pluginStore.getState().disablePlugin(entry.pluginId)
		} else {
			pluginStore.getState().enablePlugin(entry.pluginId)
		}
	}

	return (
		<Modal opened={opened} onClose={onClose} title={entry.pluginName} size="lg">
			<Stack gap="md">
				<Text>{entry.description}</Text>

				<Group gap="xs">
					<Badge color={CATEGORY_COLORS[entry.category] ?? 'gray'} variant="light">
						{entry.category}
					</Badge>
					{entry.isVerified && (
						<Badge color="teal" variant="light">
							Verified
						</Badge>
					)}
					<Badge variant="outline">{entry.contentRating}</Badge>
				</Group>

				<Group gap="lg">
					<Box>
						<Text size="xs" c="dimmed">
							Author
						</Text>
						<Text size="sm">{entry.author}</Text>
					</Box>
					<Box>
						<Text size="xs" c="dimmed">
							Version
						</Text>
						<Text size="sm">{entry.version}</Text>
					</Box>
					<Box>
						<Text size="xs" c="dimmed">
							Authentication
						</Text>
						<Text size="sm">{entry.authentication.type}</Text>
					</Box>
				</Group>

				{entry.authentication.type === 'oauth2-pkce' && (
					<Box>
						<Text size="xs" c="dimmed">
							OAuth Scopes
						</Text>
						<Group gap="xs" mt={4}>
							{entry.authentication.scopes.map((scope) => (
								<Badge key={scope} variant="outline" size="sm">
									{scope}
								</Badge>
							))}
						</Group>
					</Box>
				)}

				<Box>
					<Title order={6} mb="xs">
						Tools
					</Title>
					<List spacing="xs">
						{entry.tools.map((tool) => (
							<List.Item key={tool.toolName}>
								<Text size="sm" fw={500}>
									{tool.toolName}
								</Text>
								<Text size="xs" c="dimmed">
									{tool.toolDescription}
								</Text>
							</List.Item>
						))}
					</List>
				</Box>

				<Box>
					<Text size="xs" c="dimmed">
						Sandbox Permissions
					</Text>
					<Group gap="xs" mt={4}>
						{entry.userInterface.sandboxPermissions.length > 0 ? (
							entry.userInterface.sandboxPermissions.map((perm) => (
								<Badge key={perm} variant="outline" size="sm">
									{perm}
								</Badge>
							))
						) : (
							<Text size="xs">None</Text>
						)}
					</Group>
				</Box>

				<Box>
					<Text size="xs" c="dimmed">
						Capabilities
					</Text>
					<Group gap="xs" mt={4}>
						{entry.capabilities.supportsScreenshot && (
							<Badge variant="light" size="sm">
								Screenshot
							</Badge>
						)}
						{entry.capabilities.supportsVerboseState && (
							<Badge variant="light" size="sm">
								Verbose State
							</Badge>
						)}
						{entry.capabilities.supportsEventLog && (
							<Badge variant="light" size="sm">
								Event Log
							</Badge>
						)}
					</Group>
				</Box>

				{entry.contextPrompt != null && (
					<Box>
						<Text
							size="xs"
							c="dimmed"
							style={{ cursor: 'pointer' }}
							onClick={() => setContextPromptOpen((o) => !o)}
						>
							Context Prompt {contextPromptOpen ? '▲' : '▼'}
						</Text>
						<Collapse in={contextPromptOpen}>
							<Box mt={4} p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 4 }}>
								<Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
									{entry.contextPrompt}
								</Text>
							</Box>
						</Collapse>
					</Box>
				)}

				<Group gap="sm">
					<Box>
						<Text size="xs" c="dimmed">
							Bundle Version
						</Text>
						<Text size="xs">{entry.bundle.bundleVersion}</Text>
					</Box>
				</Group>

				<Button onClick={handleToggle} color={isEnabled ? 'red' : 'blue'} variant={isEnabled ? 'outline' : 'filled'}>
					{isEnabled ? 'Disable' : 'Enable'}
				</Button>
			</Stack>
		</Modal>
	)
}
