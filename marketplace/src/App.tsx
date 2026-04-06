import { notifications } from '@mantine/notifications'
import { useCallback } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { Layout } from './components/Layout'
import { useAuth } from './hooks/useAuth'
import { useCodeExchange } from './hooks/useCodeExchange'
import { BrowsePage } from './pages/BrowsePage'
import { ClassroomPage } from './pages/ClassroomPage'
import { PluginDetailPage } from './pages/PluginDetailPage'
import { SubmitConfirmationPage } from './pages/SubmitConfirmationPage'
import { SubmitPage } from './pages/SubmitPage'

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
        <Route path="/" element={<BrowsePage />} />
        <Route path="/plugin/:pluginId" element={<PluginDetailPage auth={auth} />} />
        <Route
          path="/classroom"
          element={
            <AuthGuard auth={auth}>
              <ClassroomPage auth={auth} />
            </AuthGuard>
          }
        />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/submit/success" element={<SubmitConfirmationPage />} />
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
