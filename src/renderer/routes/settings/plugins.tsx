import { Stack } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { MarketplacePanel } from '@/components/settings/plugins/MarketplacePanel'
import { PluginStorePanel } from '@/components/settings/plugins/PluginStorePanel'
import { useDemoStore } from '@/stores/demoStore'

export const Route = createFileRoute('/settings/plugins')({
	component: RouteComponent,
})

export function RouteComponent() {
	const role = useDemoStore((s) => s.demoRole)
	return (
		<Stack gap="lg" p="md">
			<MarketplacePanel role={role} />
			<PluginStorePanel />
		</Stack>
	)
}
