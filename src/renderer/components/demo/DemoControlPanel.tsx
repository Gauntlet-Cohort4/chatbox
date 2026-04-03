import { Badge, Button, Paper } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import type { FC } from 'react'
import { useDemoStore } from '@/stores/demoStore'
import { createEmpty } from '@/stores/session/crud'

export const DemoControlPanel: FC = () => {
	const isDemoMode = useDemoStore((s) => s.isDemoMode)
	const demoRole = useDemoStore((s) => s.demoRole)
	const toggleDemoRole = useDemoStore((s) => s.toggleDemoRole)

	if (!isDemoMode) {
		return null
	}

	const handleClearSession = () => {
		createEmpty('chat')
	}

	return (
		<Paper
			shadow="md"
			p="xs"
			radius="md"
			className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm"
		>
			<Badge
				size="lg"
				variant="filled"
				color={demoRole === 'teacher' ? 'blue' : 'green'}
				className="cursor-pointer select-none"
				onClick={toggleDemoRole}
			>
				{demoRole === 'teacher' ? 'Teacher' : 'Student'}
			</Badge>
			<Button
				size="xs"
				variant="subtle"
				color="gray"
				leftSection={<IconRefresh size={14} />}
				onClick={handleClearSession}
			>
				Clear Session
			</Button>
		</Paper>
	)
}
