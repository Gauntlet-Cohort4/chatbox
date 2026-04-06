/**
 * Admin guard: gates admin routes behind a token stored in sessionStorage.
 * The token entry UI lives on the admin page itself.
 */
import { Navigate } from 'react-router-dom'
import { apiClient } from '../api/client'

const ADMIN_TOKEN_KEY = 'marketplace.adminToken'

export function getStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    }
  } catch {
    // ignore — dev tools may block sessionStorage
  }
  apiClient.setAdminToken(token)
}

// Initialize API client on module load if token is already stored
const initial = getStoredAdminToken()
if (initial) apiClient.setAdminToken(initial)

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  // Unlike AuthGuard, admin does not redirect — the admin page itself
  // shows the token entry form when no token is set.
  return <>{children}</>
}

// Helper for components that want to redirect admin users elsewhere
export function RequireAdminToken({ children }: AdminGuardProps) {
  if (!getStoredAdminToken()) {
    return <Navigate to="/admin" replace />
  }
  return <>{children}</>
}
