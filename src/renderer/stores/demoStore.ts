import { createStore, useStore } from 'zustand'

interface DemoStoreState {
	demoRole: 'student' | 'teacher'
	isDemoMode: boolean
}

interface DemoStoreActions {
	setDemoRole: (role: 'student' | 'teacher') => void
	toggleDemoRole: () => void
	setDemoMode: (enabled: boolean) => void
}

export const demoStore = createStore<DemoStoreState & DemoStoreActions>()(
	(set, get) => ({
		demoRole: 'teacher',
		isDemoMode: true,
		setDemoRole: (role) => set({ demoRole: role }),
		toggleDemoRole: () => set({ demoRole: get().demoRole === 'student' ? 'teacher' : 'student' }),
		setDemoMode: (enabled) => set({ isDemoMode: enabled }),
	})
)

export function useDemoStore<U>(selector: (state: DemoStoreState & DemoStoreActions) => U) {
	return useStore(demoStore, selector)
}
