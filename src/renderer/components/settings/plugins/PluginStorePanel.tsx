import { Badge, Box, Button, Card, Group, SegmentedControl, SimpleGrid, Text, TextInput, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { pluginStore, type PluginApprovalStatus } from '@/stores/pluginStore'
import type { PluginCatalogEntry } from '@shared/types/plugin'
import { PluginDetailModal } from './PluginDetailModal'

type CategoryFilter = 'All' | 'internal' | 'external-public' | 'external-authenticated'

const CATEGORY_COLORS: Record<string, string> = {
	internal: 'blue',
	'external-public': 'green',
	'external-authenticated': 'orange',
}

const STATUS_CONFIG: Record<PluginApprovalStatus, { label: string; color: string; actionLabel: string; nextStatus: PluginApprovalStatus }> = {
	'not-approved': { label: 'NOT APPROVED', color: 'red', actionLabel: 'Approve', nextStatus: 'approved' },
	approved: { label: 'APPROVED', color: 'yellow', actionLabel: 'Deploy', nextStatus: 'deployed' },
	deployed: { label: 'DEPLOYED', color: 'green', actionLabel: 'Revoke', nextStatus: 'approved' },
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
	const approvalStatus = usePluginStore((s) => s.pluginApprovalStatus)
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

	const handleStatusAction = (pluginId: string, e: React.MouseEvent) => {
		e.stopPropagation()
		const currentStatus = approvalStatus[pluginId] ?? 'not-approved'
		const config = STATUS_CONFIG[currentStatus]
		pluginStore.getState().setApprovalStatus(pluginId, config.nextStatus)
	}

	const handleRevoke = (pluginId: string, e: React.MouseEvent) => {
		e.stopPropagation()
		pluginStore.getState().setApprovalStatus(pluginId, 'not-approved')
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
					const status = approvalStatus[app.pluginId] ?? 'not-approved'
					const config = STATUS_CONFIG[status]
					return (
						<Card
							key={app.pluginId}
							shadow="sm"
							padding="md"
							radius="md"
							withBorder
							style={{ cursor: 'pointer', opacity: status === 'not-approved' ? 0.7 : 1 }}
							onClick={() => setSelectedEntry(app)}
						>
							<Group justify="space-between" mb="xs">
								<Text fw={600}>{app.pluginName}</Text>
								<Badge color={config.color} variant="filled" size="sm">
									{config.label}
								</Badge>
							</Group>

							<Text size="sm" c="dimmed" mb="xs">
								{truncateDescription(app.description)}
							</Text>

							<Group gap="xs" mb="sm">
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

							<Group gap="xs" justify="space-between">
								<Text size="xs" c="dimmed">
									{app.author}
								</Text>
								<Group gap="xs">
									<Button
										size="xs"
										variant={status === 'deployed' ? 'light' : 'filled'}
										color={status === 'deployed' ? 'red' : config.color === 'red' ? 'blue' : 'green'}
										onClick={(e) => handleStatusAction(app.pluginId, e)}
									>
										{config.actionLabel}
									</Button>
									{status === 'deployed' && (
										<Button
											size="xs"
											variant="subtle"
											color="red"
											onClick={(e) => handleRevoke(app.pluginId, e)}
										>
											Unapprove
										</Button>
									)}
								</Group>
							</Group>
						</Card>
					)
				})}
			</SimpleGrid>

			<PluginDetailModal entry={selectedEntry} opened={selectedEntry != null} onClose={() => setSelectedEntry(null)} />
		</Box>
	)
}
