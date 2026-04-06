/**
 * Marketplace integration panel.
 *
 * Renders in the Apps settings tab and exposes:
 * - Teacher workflow: register account, copy join code, "Browse Marketplace" handoff
 * - Student workflow: enter teacher's join code to start receiving deployed plugins
 *
 * The panel reads and writes a handful of marketplace-related fields on
 * the plugin settings slice: marketplaceApiUrl, marketplaceWebUrl, and the
 * teacher / student tokens.
 */
import {
	Alert,
	Button,
	Card,
	CopyButton,
	Divider,
	Group,
	PasswordInput,
	Stack,
	Text,
	TextInput,
	Title,
	Tooltip,
} from '@mantine/core'
import { useState } from 'react'
import { settingsStore } from '@/stores/settingsStore'
import { generateExchangeCode, registerTeacher } from '@/packages/plugin-catalog/marketplace-client'
import platform from '@/platform'
import { logPluginEvent } from '@/packages/plugin-logger/logger'
import { useStore } from 'zustand'

const DEFAULT_API_URL = 'http://localhost:8787'
const DEFAULT_WEB_URL = 'http://localhost:5174'

interface MarketplacePanelProps {
	role: 'teacher' | 'student'
}

export function MarketplacePanel({ role }: MarketplacePanelProps) {
	const settings = useStore(settingsStore, (s) => s.plugins)
	const setSettings = useStore(settingsStore, (s) => s.setSettings)

	const apiUrl = settings?.marketplaceApiUrl ?? DEFAULT_API_URL
	const webUrl = settings?.marketplaceWebUrl ?? DEFAULT_WEB_URL

	function updatePluginSettings(patch: Record<string, unknown>) {
		setSettings((state) => {
			state.plugins = { ...state.plugins, ...patch }
		})
	}

	return (
		<Card withBorder padding="md" radius="md">
			<Stack gap="md">
				<Title order={4}>ChatBridge Marketplace</Title>
				<Text size="sm" c="dimmed">
					Connect to the marketplace to browse and install community plugins.
				</Text>

				<Group grow>
					<TextInput
						label="Marketplace API URL"
						value={apiUrl}
						onChange={(e) => updatePluginSettings({ marketplaceApiUrl: e.currentTarget.value })}
						placeholder={DEFAULT_API_URL}
					/>
					<TextInput
						label="Marketplace web URL"
						value={webUrl}
						onChange={(e) => updatePluginSettings({ marketplaceWebUrl: e.currentTarget.value })}
						placeholder={DEFAULT_WEB_URL}
					/>
				</Group>

				<Divider />

				{role === 'teacher' ? (
					<TeacherSection apiUrl={apiUrl} webUrl={webUrl} />
				) : (
					<StudentSection apiUrl={apiUrl} />
				)}
			</Stack>
		</Card>
	)
}

function TeacherSection({ apiUrl, webUrl }: { apiUrl: string; webUrl: string }) {
	const settings = useStore(settingsStore, (s) => s.plugins)
	const setSettings = useStore(settingsStore, (s) => s.setSettings)

	const teacherId = settings?.marketplaceTeacherId
	const apiToken = settings?.marketplaceTeacherApiToken
	const joinCode = settings?.marketplaceTeacherJoinCode

	const [teacherName, setTeacherName] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function updatePluginSettings(patch: Record<string, unknown>) {
		setSettings((state) => {
			state.plugins = { ...state.plugins, ...patch }
		})
	}

	async function register() {
		if (!teacherName.trim()) {
			setError('Please enter your name')
			return
		}
		setBusy(true)
		setError(null)
		try {
			const result = await registerTeacher(apiUrl, teacherName.trim())
			updatePluginSettings({
				marketplaceTeacherId: result.teacherId,
				marketplaceTeacherApiToken: result.apiToken,
				marketplaceTeacherJoinCode: result.joinCode,
			})
			logPluginEvent('marketplace_register', 'system', { teacherId: result.teacherId })
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Registration failed')
		} finally {
			setBusy(false)
		}
	}

	async function browseMarketplace() {
		if (!apiToken) {
			setError('Register first to browse the marketplace')
			return
		}
		setBusy(true)
		setError(null)
		try {
			const { code } = await generateExchangeCode(apiUrl, apiToken)
			logPluginEvent('marketplace_exchange_code', 'system')
			const url = `${webUrl.replace(/\/$/, '')}/?code=${encodeURIComponent(code)}`
			await platform.openLink(url)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to open marketplace')
		} finally {
			setBusy(false)
		}
	}

	if (!teacherId) {
		return (
			<Stack gap="sm">
				<Text size="sm" fw={600}>
					Register as a teacher
				</Text>
				<Text size="xs" c="dimmed">
					Creates a marketplace account and generates a join code students can use to sync your deployed plugins.
				</Text>
				<TextInput
					label="Your name (shown to students)"
					value={teacherName}
					onChange={(e) => setTeacherName(e.currentTarget.value)}
					placeholder="Ms. Rivera"
				/>
				<Group justify="flex-end">
					<Button onClick={register} loading={busy}>
						Register
					</Button>
				</Group>
				{error && <Alert color="red">{error}</Alert>}
			</Stack>
		)
	}

	return (
		<Stack gap="sm">
			<Text size="sm" fw={600}>
				Teacher account
			</Text>
			<Text size="xs" c="dimmed">
				Signed in as <code>{teacherId}</code>
			</Text>

			{joinCode && (
				<Group align="flex-end">
					<TextInput label="Student join code" value={joinCode} readOnly style={{ flex: 1 }} />
					<CopyButton value={joinCode}>
						{({ copied, copy }) => (
							<Tooltip label={copied ? 'Copied!' : 'Copy'}>
								<Button variant="light" onClick={copy}>
									{copied ? 'Copied' : 'Copy'}
								</Button>
							</Tooltip>
						)}
					</CopyButton>
				</Group>
			)}

			{apiToken && (
				<PasswordInput label="API token (keep private)" value={apiToken} readOnly visible={false} />
			)}

			<Group>
				<Button onClick={browseMarketplace} loading={busy}>
					Browse Marketplace
				</Button>
			</Group>
			{error && <Alert color="red">{error}</Alert>}
		</Stack>
	)
}

function StudentSection({ apiUrl }: { apiUrl: string }) {
	const settings = useStore(settingsStore, (s) => s.plugins)
	const setSettings = useStore(settingsStore, (s) => s.setSettings)

	const currentJoinCode = settings?.marketplaceStudentJoinCode ?? ''
	const [joinCodeInput, setJoinCodeInput] = useState(currentJoinCode)
	const [error, setError] = useState<string | null>(null)

	function save() {
		const normalized = joinCodeInput.trim().toUpperCase()
		if (normalized && !/^[A-Z2-9]{6}$/.test(normalized)) {
			setError('Join code must be 6 characters (letters and digits).')
			return
		}
		setError(null)
		setSettings((state) => {
			state.plugins = {
				...state.plugins,
				marketplaceStudentJoinCode: normalized || undefined,
				marketplaceApiUrl: state.plugins?.marketplaceApiUrl ?? apiUrl,
			}
		})
	}

	function clear() {
		setJoinCodeInput('')
		setSettings((state) => {
			state.plugins = { ...state.plugins, marketplaceStudentJoinCode: undefined }
		})
	}

	return (
		<Stack gap="sm">
			<Text size="sm" fw={600}>
				Enter your teacher's join code
			</Text>
			<Text size="xs" c="dimmed">
				Your ChatBridge app will check the marketplace every minute for plugins your teacher has deployed.
			</Text>
			<Group align="flex-end">
				<TextInput
					label="Join code"
					value={joinCodeInput}
					onChange={(e) => setJoinCodeInput(e.currentTarget.value.toUpperCase())}
					placeholder="ALPHA1"
					maxLength={6}
					style={{ flex: 1 }}
				/>
				<Button onClick={save}>Save</Button>
				{currentJoinCode && (
					<Button variant="subtle" color="red" onClick={clear}>
						Clear
					</Button>
				)}
			</Group>
			{currentJoinCode && (
				<Text size="xs" c="dimmed">
					Currently connected to <code>{currentJoinCode}</code>
				</Text>
			)}
			{error && <Alert color="red">{error}</Alert>}
		</Stack>
	)
}
