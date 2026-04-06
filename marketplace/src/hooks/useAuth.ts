/**
 * Auth state hook.
 *
 * On mount, calls `/auth/me` to check if there's a valid session cookie.
 * Listens for the `marketplace:auth-expired` custom event dispatched by
 * the API client on 401, clearing local state.
 */
import { useCallback, useEffect, useState } from 'react'
import { ApiClientError } from '../api/client'
import { authLogout, authMe } from '../api/endpoints'
import type { AuthMeResponse } from '../types/api'

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  teacher: AuthMeResponse | null
}

export interface UseAuthResult extends AuthState {
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    teacher: null,
  })

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const teacher = await authMe()
      setState({ isAuthenticated: true, isLoading: false, teacher })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setState({ isAuthenticated: false, isLoading: false, teacher: null })
      } else {
        // Non-401 errors: stay in a known state but not authenticated
        setState({ isAuthenticated: false, isLoading: false, teacher: null })
      }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authLogout()
    } catch {
      // best-effort — always clear local state
    }
    setState({ isAuthenticated: false, isLoading: false, teacher: null })
  }, [])

  useEffect(() => {
    void refresh()
    const onExpired = () => {
      setState({ isAuthenticated: false, isLoading: false, teacher: null })
    }
    window.addEventListener('marketplace:auth-expired', onExpired)
    return () => {
      window.removeEventListener('marketplace:auth-expired', onExpired)
    }
  }, [refresh])

  return { ...state, refresh, logout }
}
