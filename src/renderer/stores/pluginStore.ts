import type { PluginCatalog, PluginManifest } from '@shared/types/plugin'
import { createStore, useStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const MAX_EVENT_LOG_ENTRIES = 50

interface PluginEventLogEntry {
	eventDescription: string
	eventData?: Record<string, unknown>
	eventTimestamp: number
}

interface PluginStoreState {
	catalog: PluginCatalog | null
	catalogVersion: number | null
	catalogLastFetched: number | null
	enabledPluginIds: string[]
	activePluginId: string | null
	pluginStates: Record<string, Record<string, unknown>>
	pluginStateDescriptions: Record<string, string>
	pluginEventLogs: Record<string, PluginEventLogEntry[]>
	pluginTokens: Record<string, { accessToken: string; refreshToken?: string; expiresAt?: number }>
	localBundles: Record<string, { bundleVersion: string; localUrl: string }>
	loading: boolean
	error: string | null
}

interface PluginStoreActions {
	setCatalog: (catalog: PluginCatalog) => void
	enablePlugin: (pluginId: string) => void
	disablePlugin: (pluginId: string) => void
	setActivePlugin: (pluginId: string | null) => void
	updatePluginState: (pluginId: string, state: Record<string, unknown>, description?: string) => void
	appendEventLog: (pluginId: string, entry: PluginEventLogEntry) => void
	clearEventLog: (pluginId: string) => void
	setPluginToken: (pluginId: string, token: { accessToken: string; refreshToken?: string; expiresAt?: number }) => void
	clearPluginToken: (pluginId: string) => void
	setLocalBundle: (pluginId: string, bundleVersion: string, localUrl: string) => void
	getEnabledManifests: () => PluginManifest[]
	getActiveManifest: () => PluginManifest | null
}

export const pluginStore = createStore<PluginStoreState & PluginStoreActions>()(
	subscribeWithSelector(
		immer((set, get) => ({
			// State
			catalog: null,
			catalogVersion: null,
			catalogLastFetched: null,
			enabledPluginIds: [],
			activePluginId: null,
			pluginStates: {},
			pluginStateDescriptions: {},
			pluginEventLogs: {},
			pluginTokens: {},
			localBundles: {},
			loading: false,
			error: null,

			// Actions
			setCatalog: (catalog) =>
				set((state) => {
					state.catalog = catalog
					state.catalogVersion = catalog.catalogVersion
					state.catalogLastFetched = Date.now()
				}),

			enablePlugin: (pluginId) =>
				set((state) => {
					if (!state.enabledPluginIds.includes(pluginId)) {
						state.enabledPluginIds.push(pluginId)
					}
				}),

			disablePlugin: (pluginId) =>
				set((state) => {
					state.enabledPluginIds = state.enabledPluginIds.filter((id) => id !== pluginId)
				}),

			setActivePlugin: (pluginId) =>
				set((state) => {
					state.activePluginId = pluginId
				}),

			updatePluginState: (pluginId, pluginState, description) =>
				set((state) => {
					state.pluginStates[pluginId] = pluginState
					if (description !== undefined) {
						state.pluginStateDescriptions[pluginId] = description
					}
				}),

			appendEventLog: (pluginId, entry) =>
				set((state) => {
					if (!state.pluginEventLogs[pluginId]) {
						state.pluginEventLogs[pluginId] = []
					}
					state.pluginEventLogs[pluginId].push(entry)
					if (state.pluginEventLogs[pluginId].length > MAX_EVENT_LOG_ENTRIES) {
						state.pluginEventLogs[pluginId] = state.pluginEventLogs[pluginId].slice(
							state.pluginEventLogs[pluginId].length - MAX_EVENT_LOG_ENTRIES
						)
					}
				}),

			clearEventLog: (pluginId) =>
				set((state) => {
					state.pluginEventLogs[pluginId] = []
				}),

			setPluginToken: (pluginId, token) =>
				set((state) => {
					state.pluginTokens[pluginId] = token
				}),

			clearPluginToken: (pluginId) =>
				set((state) => {
					delete state.pluginTokens[pluginId]
				}),

			setLocalBundle: (pluginId, bundleVersion, localUrl) =>
				set((state) => {
					state.localBundles[pluginId] = { bundleVersion, localUrl }
				}),

			getEnabledManifests: () => {
				const { catalog, enabledPluginIds } = get()
				if (!catalog) return []
				return catalog.applications.filter((app) => enabledPluginIds.includes(app.pluginId))
			},

			getActiveManifest: () => {
				const { catalog, activePluginId } = get()
				if (!activePluginId || !catalog) return null
				return catalog.applications.find((app) => app.pluginId === activePluginId) ?? null
			},
		}))
	)
)

export function usePluginStore<U>(selector: Parameters<typeof useStore<typeof pluginStore, U>>[1]) {
	return useStore<typeof pluginStore, U>(pluginStore, selector)
}

export type { PluginEventLogEntry }
