import { ActionIcon, Loader, Paper, Text } from '@mantine/core'
import { IconX, IconAlertTriangle } from '@tabler/icons-react'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ensureBundle } from '@/packages/plugin-catalog/bundle-manager'
import { PluginBridge } from '@/packages/plugin-bridge'
import { pluginEventBus } from '@/packages/plugin-event-bus'
import { usePluginStore } from '@/stores/pluginStore'
import { pluginStore } from '@/stores/pluginStore'

const READY_TIMEOUT_MS = 15000

export const PluginSidePanel: FC = () => {
	const { t } = useTranslation()
	const activePluginId = usePluginStore((s) => s.activePluginId)
	const manifest = usePluginStore((s) => s.getActiveManifest())
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const bridgeRef = useRef<PluginBridge | null>(null)

	const [localUrl, setLocalUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [downloading, setDownloading] = useState(false)

	// Download bundle and get local URL
	useEffect(() => {
		if (!activePluginId || !manifest) {
			setLocalUrl(null)
			setLoading(false)
			setReady(false)
			setError(null)
			return
		}

		let cancelled = false
		setDownloading(true)
		setLoading(true)
		setReady(false)
		setError(null)

		ensureBundle(manifest.pluginId, manifest.bundle)
			.then((url) => {
				if (!cancelled) {
					setLocalUrl(url)
					setDownloading(false)
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(`Failed to load app: ${err.message}`)
					setDownloading(false)
					setLoading(false)
				}
			})

		return () => {
			cancelled = true
		}
	}, [activePluginId, manifest?.pluginId, manifest?.bundle.bundleVersion])

	// Bridge lifecycle
	useEffect(() => {
		if (!activePluginId || !manifest || !localUrl) return

		const bridge = new PluginBridge(iframeRef, manifest)
		bridge.init()
		bridgeRef.current = bridge

		return () => {
			bridge.destroy()
			bridgeRef.current = null
		}
	}, [activePluginId, manifest?.pluginId, localUrl])

	// iframe onload → sendAppInit
	const handleIframeLoad = useCallback(() => {
		if (bridgeRef.current) {
			bridgeRef.current.sendAppInit(crypto.randomUUID())
		}
	}, [])

	// Listen for plugin:ready
	useEffect(() => {
		if (!activePluginId) return

		const offReady = pluginEventBus.on('plugin:ready', ({ pluginId }) => {
			if (pluginId === activePluginId) {
				setReady(true)
				setLoading(false)
			}
		})

		// Ready timeout
		const timeout = setTimeout(() => {
			if (!ready) {
				setError('App took too long to respond. Try closing and reopening.')
				setLoading(false)
			}
		}, READY_TIMEOUT_MS)

		return () => {
			offReady()
			clearTimeout(timeout)
		}
	}, [activePluginId])

	// Listen for plugin:complete → close panel
	useEffect(() => {
		if (!activePluginId) return

		const offComplete = pluginEventBus.on('plugin:complete', ({ pluginId }) => {
			if (pluginId === activePluginId) {
				pluginStore.getState().setActivePlugin(null)
			}
		})

		return () => {
			offComplete()
		}
	}, [activePluginId])

	const handleClose = useCallback(() => {
		pluginStore.getState().setActivePlugin(null)
	}, [])

	const handleRetry = useCallback(() => {
		if (iframeRef.current && localUrl) {
			setLoading(true)
			setReady(false)
			setError(null)
			iframeRef.current.src = localUrl
		}
	}, [localUrl])

	if (!activePluginId || !manifest) {
		return null
	}

	const panelWidth = manifest.userInterface.defaultWidth || 420
	const iframeHeight = manifest.userInterface.defaultHeight || 500

	// Build sandbox attribute
	const catalogEntry = pluginStore.getState().catalog?.applications.find(
		(app) => app.pluginId === manifest.pluginId
	)
	const isVerified = catalogEntry?.isVerified ?? false
	const sandboxParts = ['allow-scripts']
	if (
		isVerified &&
		manifest.userInterface.sandboxPermissions.includes('allow-same-origin')
	) {
		sandboxParts.push('allow-same-origin')
	}
	const sandbox = sandboxParts.join(' ')

	return (
		<div
			className="flex-none border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"
			style={{
				width: panelWidth,
				transition: 'width 0.3s ease',
			}}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
				<Text size="sm" fw={600} truncate>
					{manifest.pluginName}
				</Text>
				<ActionIcon variant="subtle" size="sm" onClick={handleClose} aria-label="Close plugin">
					<IconX size={16} />
				</ActionIcon>
			</div>

			{/* Content area */}
			<div className="flex-1 relative overflow-hidden">
				{/* Download progress */}
				{downloading && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 z-10">
						<Loader size="md" />
						<Text size="sm" c="dimmed" mt="sm">
							{t('Downloading app...')}
						</Text>
					</div>
				)}

				{/* Loading overlay (waiting for app:ready) */}
				{!downloading && loading && localUrl && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
						<Loader size="md" />
						<Text size="sm" c="dimmed" mt="sm">
							{t('Loading...')}
						</Text>
					</div>
				)}

				{/* Error overlay */}
				{error && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 z-10 p-4">
						<IconAlertTriangle size={32} className="text-orange-500 mb-2" />
						<Text size="sm" c="dimmed" ta="center" mb="sm">
							{error}
						</Text>
						{localUrl && (
							<button
								type="button"
								onClick={handleRetry}
								className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
							>
								{t('Retry')}
							</button>
						)}
					</div>
				)}

				{/* iframe */}
				{localUrl && (
					<iframe
						ref={iframeRef}
						src={localUrl}
						sandbox={sandbox}
						onLoad={handleIframeLoad}
						style={{
							width: '100%',
							height: iframeHeight,
							border: 'none',
						}}
						title={manifest.pluginName}
					/>
				)}
			</div>
		</div>
	)
}
