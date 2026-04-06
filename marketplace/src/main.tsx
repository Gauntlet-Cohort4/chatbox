import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles/global.css'

import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  defaultRadius: 'md',
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    {/*
      Force light color scheme for now. The previous "auto" setting picked up
      the OS dark mode preference, but our custom global.css only declared
      dark variables under a `.dark` class that Mantine never applies (Mantine
      uses [data-mantine-color-scheme="dark"] on <html>). The result was dark
      Mantine components rendered on a white body background with low-contrast
      text and light-on-light Alerts. Locking to light avoids the half-broken
      mismatch; a proper dark theme can be added later.
    */}
    <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>
)
