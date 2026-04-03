import { Badge, Box, Card, Group, SegmentedControl, SimpleGrid, Switch, Text, TextInput, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { pluginStore } from '@/stores/pluginStore'
import type { PluginCatalogEntry } from '@shared/types/plugin'
import { PluginDetailModal } from './PluginDetailModal'

type CategoryFilter = 'All' | 'internal' | 'external-public' | 'external-authenticated'

const CATEGORY_COLORS: Record<string, string> = {
	internal: 'blue',
	'external-public': 'green',
	'external-authenticated': 'orange',
}

function truncateDescription(description: string, maxLength = 100): string {
	if (description.length <= maxLength) return description
	return `${description.slice(0, maxLength)}...`
}

function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

export function PluginStorePanel() {
	const catalog = usePluginStore((s) => s.catalog)
	const enabledPluginIds = usePluginStore((s) => s.enabledPluginIds)
	const [search, setSearch] = useState('')
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
	const [selectedEntry, setSelectedEntry] = useState<PluginCatalogEntry | null>(null)

	const filteredApps = useMemo(() => {
		if (!catalog) return []
		const lowerSearch = search.toLowerCase()
		return catalog.applications.filter((app) => {
			if (categoryFilter !== 'All' && app.category !== categoryFilter) return false
			if (lowerSearch) {
				const matchesName = app.pluginName.toLowerCase().includes(lowerSearch)
				const matchesDesc = app.description.toLowerCase().includes(lowerSearch)
				if (!matchesName && !matchesDesc) return false
			}
			return true
		})
	}, [catalog, search, categoryFilter])

	if (catalog == null) {
		return (
			<Box p="md">
				<Text>Loading app catalog...</Text>
			</Box>
		)
	}

	if (catalog.applications.length === 0) {
		return (
			<Box p="md">
				<Title order={5}>App Store</Title>
				<Text mt="md">No apps available</Text>
			</Box>
		)
	}

	const handleToggle = (pluginId: string, isCurrentlyEnabled: boolean) => {
		if (isCurrentlyEnabled) {
			pluginStore.getState().disablePlugin(pluginId)
		} else {
			pluginStore.getState().enablePlugin(pluginId)
		}
	}

	return (
		<Box p="md">
			<Title order={5}>App Store</Title>

			<Group mt="sm" justify="space-between">
				<Text size="xs" c="dimmed">
					Catalog v{catalog.catalogVersion} &middot; Last updated {formatTimestamp(catalog.lastUpdatedAt)}
				</Text>
			</Group>

			<Group mt="md" gap="sm">
				<TextInput
					placeholder="Search apps..."
					value={search}
					onChange={(e) => setSearch(e.currentTarget.value)}
					style={{ flex: 1 }}
				/>
				<SegmentedControl
					value={categoryFilter}
					onChange={(value) => setCategoryFilter(value as CategoryFilter)}
					data={[
						{ label: 'All', value: 'All' },
						{ label: 'Internal', value: 'internal' },
						{ label: 'External Public', value: 'external-public' },
						{ label: 'External Auth', value: 'external-authenticated' },
					]}
				/>
			</Group>

			<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mt="md" spacing="md">
				{filteredApps.map((app) => {
					const isEnabled = enabledPluginIds.includes(app.pluginId)
					return (
						<Card
							key={app.pluginId}
							shadow="sm"
							padding="md"
							radius="md"
							withBorder
							style={{ cursor: 'pointer' }}
							onClick={() => setSelectedEntry(app)}
						>
							<Group justify="space-between" mb="xs">
								<Text fw={600}>{app.pluginName}</Text>
								<Switch
									checked={isEnabled}
									onChange={(e) => {
										e.stopPropagation()
										handleToggle(app.pluginId, isEnabled)
									}}
									onClick={(e) => e.stopPropagation()}
								/>
							</Group>

							<Text size="sm" c="dimmed" mb="xs">
								{truncateDescription(app.description)}
							</Text>

							<Group gap="xs" mb="xs">
								<Badge color={CATEGORY_COLORS[app.category] ?? 'gray'} variant="light" size="sm">
									{app.category}
								</Badge>
								{app.isVerified && (
									<Badge color="teal" variant="light" size="sm">
										Verified
									</Badge>
								)}
								<Badge variant="outline" size="sm">
									{app.contentRating}
								</Badge>
							</Group>

							<Text size="xs" c="dimmed">
								{app.author}
							</Text>
						</Card>
					)
				})}
			</SimpleGrid>

			<PluginDetailModal entry={selectedEntry} opened={selectedEntry != null} onClose={() => setSelectedEntry(null)} />
		</Box>
	)
}
