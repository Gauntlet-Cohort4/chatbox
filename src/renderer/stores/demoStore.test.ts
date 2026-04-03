import { beforeEach, describe, expect, it } from 'vitest'
import { demoStore } from './demoStore'

beforeEach(() => {
	demoStore.setState({ demoRole: 'teacher', isDemoMode: true })
})

describe('demoStore', () => {
	it('initial state has demoRole teacher and isDemoMode true', () => {
		const state = demoStore.getState()
		expect(state.demoRole).toBe('teacher')
		expect(state.isDemoMode).toBe(true)
	})

	it('setDemoRole changes the role', () => {
		demoStore.getState().setDemoRole('student')
		expect(demoStore.getState().demoRole).toBe('student')
	})

	it('toggleDemoRole switches between student and teacher', () => {
		expect(demoStore.getState().demoRole).toBe('teacher')
		demoStore.getState().toggleDemoRole()
		expect(demoStore.getState().demoRole).toBe('student')
		demoStore.getState().toggleDemoRole()
		expect(demoStore.getState().demoRole).toBe('teacher')
	})

	it('setDemoMode enables/disables demo mode', () => {
		demoStore.getState().setDemoMode(false)
		expect(demoStore.getState().isDemoMode).toBe(false)
		demoStore.getState().setDemoMode(true)
		expect(demoStore.getState().isDemoMode).toBe(true)
	})
})
