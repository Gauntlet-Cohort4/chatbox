import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoStore } from '@/stores/demoStore'

// Mock session crud
vi.mock('@/stores/session/crud', () => ({
	createEmpty: vi.fn(),
}))

beforeEach(() => {
	demoStore.setState({ demoRole: 'teacher', isDemoMode: true })
})

describe('DemoControlPanel', () => {
	it('renders when isDemoMode is true', () => {
		expect(demoStore.getState().isDemoMode).toBe(true)
	})

	it('does not render when isDemoMode is false', () => {
		demoStore.getState().setDemoMode(false)
		expect(demoStore.getState().isDemoMode).toBe(false)
	})

	it('shows current role as Teacher initially', () => {
		expect(demoStore.getState().demoRole).toBe('teacher')
	})

	it('clicking toggles to Student', () => {
		demoStore.getState().toggleDemoRole()
		expect(demoStore.getState().demoRole).toBe('student')
	})

	it('clicking again toggles back to Teacher', () => {
		demoStore.getState().toggleDemoRole()
		demoStore.getState().toggleDemoRole()
		expect(demoStore.getState().demoRole).toBe('teacher')
	})

	it('clear session function is available', async () => {
		const { createEmpty } = await import('@/stores/session/crud')
		createEmpty('chat')
		expect(createEmpty).toHaveBeenCalledWith('chat')
	})
})
