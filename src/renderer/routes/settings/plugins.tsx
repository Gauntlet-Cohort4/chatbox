import { createFileRoute } from '@tanstack/react-router'
import { PluginStorePanel } from '@/components/settings/plugins/PluginStorePanel'

export const Route = createFileRoute('/settings/plugins')({
	component: RouteComponent,
})

export function RouteComponent() {
	return <PluginStorePanel />
}
