/**
 * Route guard that requires an authenticated teacher session.
 * Redirects to home with a toast if the user is not authenticated.
 */
import { Center, Loader } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import type { UseAuthResult } from '../hooks/useAuth'

interface AuthGuardProps {
  auth: UseAuthResult
  children: React.ReactNode
}

export function AuthGuard({ auth, children }: AuthGuardProps) {
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      notifications.show({
        title: 'Sign-in required',
        message: 'Open this page from the ChatBridge app to continue.',
        color: 'yellow',
      })
    }
  }, [auth.isLoading, auth.isAuthenticated])

  if (auth.isLoading) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    )
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
