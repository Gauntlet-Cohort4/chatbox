import { notifications } from '@mantine/notifications'
import { useCallback } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { Layout } from './components/Layout'
import { useAuth } from './hooks/useAuth'
import { useCodeExchange } from './hooks/useCodeExchange'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>Coming soon...</p>
    </div>
  )
}

function AppInner() {
  const auth = useAuth()

  const onExchangeSuccess = useCallback(() => {
    notifications.show({
      title: 'Signed in',
      message: 'Welcome back!',
      color: 'green',
    })
    void auth.refresh()
  }, [auth])

  const onExchangeError = useCallback((message: string) => {
    notifications.show({
      title: 'Sign-in failed',
      message,
      color: 'red',
    })
  }, [])

  useCodeExchange(onExchangeSuccess, onExchangeError)

  return (
    <Layout auth={auth}>
      <Routes>
        <Route path="/" element={<PlaceholderPage title="Browse Marketplace" />} />
        <Route path="/plugin/:pluginId" element={<PlaceholderPage title="Plugin Detail" />} />
        <Route
          path="/classroom"
          element={
            <AuthGuard auth={auth}>
              <PlaceholderPage title="My Classroom" />
            </AuthGuard>
          }
        />
        <Route path="/submit" element={<PlaceholderPage title="Submit Plugin" />} />
        <Route path="/admin" element={<PlaceholderPage title="Admin Panel" />} />
      </Routes>
    </Layout>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
